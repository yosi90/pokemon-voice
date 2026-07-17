import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const spriteRoot = join(root, 'public', 'assets', 'sprites', 'pokemon', 'pmd');
const outputPath = join(spriteRoot, 'manifest.v1.json');

function tag(xml, name) {
  return xml.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`))?.[1]?.trim();
}

function integerTag(xml, name, required = false) {
  const value = tag(xml, name);
  if (value === undefined) {
    if (required) throw new Error(`Falta <${name}> en AnimData.xml.`);
    return undefined;
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw new Error(`<${name}> inválido: ${value}.`);
  return parsed;
}

function pngSize(path) {
  const buffer = readFileSync(path);
  if (buffer.length < 24 || buffer.toString('hex', 0, 8) !== '89504e470d0a1a0a') {
    throw new Error(`${path} no es un PNG válido.`);
  }
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

function publicPath(path) {
  return relative(join(root, 'public'), path).split(sep).join('/');
}

function readAnimations(formDirectory) {
  const xmlPath = join(formDirectory, 'AnimData.xml');
  const xml = readFileSync(xmlPath, 'utf8');
  const shadowSize = integerTag(xml, 'ShadowSize', true);
  const blocks = [...xml.matchAll(/<Anim>([\s\S]*?)<\/Anim>/g)].map(match => match[1]);
  const raw = blocks.map(block => ({
    name: tag(block, 'Name'),
    index: integerTag(block, 'Index'),
    copyOf: tag(block, 'CopyOf'),
    frameWidth: integerTag(block, 'FrameWidth'),
    frameHeight: integerTag(block, 'FrameHeight'),
    durationTicks: [...(tag(block, 'Durations') ?? '').matchAll(/<Duration>(\d+)<\/Duration>/g)]
      .map(match => Number(match[1])),
    rushFrame: integerTag(block, 'RushFrame'),
    hitFrame: integerTag(block, 'HitFrame'),
    returnFrame: integerTag(block, 'ReturnFrame'),
  }));
  const byName = new Map(raw.map(animation => [animation.name, animation]));

  const resolveAnimation = (animation, trail = []) => {
    if (!animation.name) throw new Error(`${xmlPath}: animación sin nombre.`);
    if (!animation.copyOf) return animation;
    if (trail.includes(animation.name)) throw new Error(`${xmlPath}: ciclo CopyOf en ${animation.name}.`);
    const source = byName.get(animation.copyOf);
    if (!source) throw new Error(`${xmlPath}: ${animation.name} copia una animación inexistente.`);
    const resolved = resolveAnimation(source, [...trail, animation.name]);
    return {
      ...resolved,
      name: animation.name,
      index: animation.index ?? resolved.index,
      copyOf: animation.copyOf,
    };
  };

  const animations = raw.map(candidate => {
    const animation = resolveAnimation(candidate);
    const sourceName = animation.copyOf ? animation.copyOf : animation.name;
    const source = resolveAnimation(byName.get(sourceName));
    const frameWidth = source.frameWidth;
    const frameHeight = source.frameHeight;
    const durationTicks = source.durationTicks;
    if (!frameWidth || !frameHeight || !durationTicks.length) {
      throw new Error(`${xmlPath}: ${animation.name} no resuelve dimensiones y duraciones.`);
    }
    const animationSheet = join(formDirectory, `${source.name}-Anim.png`);
    const offsetsSheet = join(formDirectory, `${source.name}-Offsets.png`);
    const shadowSheet = join(formDirectory, `${source.name}-Shadow.png`);
    for (const path of [animationSheet, offsetsSheet, shadowSheet]) {
      if (!existsSync(path)) throw new Error(`${xmlPath}: falta ${path}.`);
    }
    const size = pngSize(animationSheet);
    if (size.width % frameWidth || size.height % frameHeight) {
      throw new Error(`${animationSheet}: dimensiones incompatibles con frames ${frameWidth}x${frameHeight}.`);
    }
    const frameCount = size.width / frameWidth;
    const directionCount = size.height / frameHeight;
    if (frameCount !== durationTicks.length) {
      throw new Error(`${animationSheet}: ${frameCount} frames pero ${durationTicks.length} duraciones.`);
    }
    return {
      name: animation.name,
      index: animation.index,
      frameWidth,
      frameHeight,
      frameCount,
      directionCount,
      durationTicks,
      ...(animation.copyOf ? { copyOf: animation.copyOf } : {}),
      animationSheetPath: publicPath(animationSheet),
      offsetsSheetPath: publicPath(offsetsSheet),
      shadowSheetPath: publicPath(shadowSheet),
      ...(source.rushFrame !== undefined ? { rushFrame: source.rushFrame } : {}),
      ...(source.hitFrame !== undefined ? { hitFrame: source.hitFrame } : {}),
      ...(source.returnFrame !== undefined ? { returnFrame: source.returnFrame } : {}),
    };
  });
  return { shadowSize, animations };
}

const assets = readdirSync(spriteRoot, { withFileTypes: true })
  .filter(entry => entry.isDirectory() && /^\d{4}-/.test(entry.name))
  .sort((a, b) => a.name.localeCompare(b.name))
  .flatMap(speciesEntry => {
    const match = speciesEntry.name.match(/^(\d{4})-(.+)$/);
    const speciesId = Number(match[1]);
    const speciesDirectory = join(spriteRoot, speciesEntry.name);
    return readdirSync(speciesDirectory, { withFileTypes: true })
      .filter(entry => entry.isDirectory() && existsSync(join(speciesDirectory, entry.name, 'AnimData.xml')))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(formEntry => {
        const formDirectory = join(speciesDirectory, formEntry.name);
        const parsed = readAnimations(formDirectory);
        return {
          schemaVersion: 1,
          assetId: `pmd:${speciesEntry.name}:${formEntry.name}`,
          speciesId,
          formId: `pokemon-form:${speciesId}:${formEntry.name}`,
          source: 'PMDCollab',
          basePath: publicPath(formDirectory),
          shadowSize: parsed.shadowSize,
          animations: parsed.animations,
          creditIds: [],
        };
      });
  });

if (!assets.length) throw new Error('No se encontraron paquetes PMD con AnimData.xml.');
const manifest = { schemaVersion: 1, tickRate: 60, assets };
writeFileSync(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
console.log(`Manifiesto PMD generado: ${assets.length} assets, ${assets.reduce((sum, asset) => sum + asset.animations.length, 0)} animaciones.`);
