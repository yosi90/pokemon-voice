import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicRoot = path.join(root, 'public');
const mapsRoot = path.join(publicRoot, 'assets', 'adventure', 'maps');
const outputPath = path.join(publicRoot, 'assets', 'adventure', 'missions', 'manifest.v1.json');
const narrativeManifestPath = path.join(
  publicRoot,
  'assets',
  'adventure',
  'narratives',
  'manifest.v1.json',
);
const mapManifestPath = path.join(mapsRoot, 'manifest.v1.json');
const findFiles = (directory, suffix) => fs.readdirSync(directory, { withFileTypes: true })
  .flatMap(entry => {
    const entryPath = path.join(directory, entry.name);
    return entry.isDirectory()
      ? findFiles(entryPath, suffix)
      : entry.name.endsWith(suffix) ? [entryPath] : [];
  });
const readJson = filePath => JSON.parse(fs.readFileSync(filePath, 'utf8'));
const writeJson = (filePath, value) => fs.writeFileSync(
  filePath,
  `${JSON.stringify(value, null, 2)}\n`,
  'utf8',
);
const missionFiles = findFiles(mapsRoot, '.missions.json');
const entries = [];
const usedIds = new Set();
const globalNarrativeIds = fs.existsSync(narrativeManifestPath)
  ? new Set(readJson(narrativeManifestPath).conversations.map(entry => entry.conversationId))
  : new Set();
const globalMapIds = fs.existsSync(mapManifestPath)
  ? new Set(readJson(mapManifestPath).maps.map(entry => entry.mapId))
  : new Set();

const flowTargets = node => {
  if (node.kind === 'conversation') {
    return [...Object.values(node.outcomes ?? {}), ...(node.defaultNextNodeId ? [node.defaultNextNodeId] : [])];
  }
  if (node.kind === 'expedition') return Object.values(node.outcomes ?? {});
  if (node.kind === 'condition') return [node.whenTrueNodeId, node.whenFalseNodeId];
  if (node.kind === 'effect') return [node.nextNodeId];
  if (node.kind === 'travel') return [node.expeditionNodeId];
  return [];
};

const validateFlow = (mission, flow) => {
  const nodeIds = new Set();
  for (const node of flow.nodes ?? []) {
    if (!node.nodeId || nodeIds.has(node.nodeId)) {
      throw new Error(`${mission.missionId}: nodo de flujo duplicado o vacío.`);
    }
    nodeIds.add(node.nodeId);
    if (node.kind === 'conversation' && !globalNarrativeIds.has(node.conversationId)) {
      throw new Error(`${mission.missionId}: conversación global inexistente ${node.conversationId}.`);
    }
    if (node.kind === 'expedition' && !globalMapIds.has(node.mapId)) {
      throw new Error(`${mission.missionId}: mapa de expedición inexistente ${node.mapId}.`);
    }
  }
  if (!nodeIds.has(flow.initialNodeId)) {
    throw new Error(`${mission.missionId}: nodo inicial inexistente ${flow.initialNodeId}.`);
  }
  const byId = new Map(flow.nodes.map(node => [node.nodeId, node]));
  for (const node of flow.nodes) {
    for (const target of flowTargets(node)) {
      if (!nodeIds.has(target)) throw new Error(`${node.nodeId}: destino inexistente ${target}.`);
    }
  }
  for (const node of flow.nodes) {
    if (node.kind === 'travel' && byId.get(node.expeditionNodeId)?.kind !== 'expedition') {
      throw new Error(`${mission.missionId}: ${node.nodeId} debe conducir a una expedición.`);
    }
  }
  const visiting = new Set();
  const visited = new Set();
  const visit = nodeId => {
    if (visiting.has(nodeId)) return true;
    if (visited.has(nodeId)) return false;
    visiting.add(nodeId);
    const node = byId.get(nodeId);
    const cycle = node && node.kind !== 'terminal' && flowTargets(node).some(visit);
    visiting.delete(nodeId);
    visited.add(nodeId);
    return cycle;
  };
  if (visit(flow.initialNodeId)) throw new Error(`${mission.missionId}: ciclo automático en el flujo.`);
};

for (const filePath of missionFiles) {
  const document = readJson(filePath);
  if (![1, 2].includes(document.schemaVersion) || typeof document.mapId !== 'string'
    || !Array.isArray(document.missions) || !Array.isArray(document.narrativeSequences)) {
    throw new Error(`${path.relative(root, filePath)} no cumple AdventureMissionDocumentV1.`);
  }
  const narrativeIds = new Set();
  for (const sequence of document.narrativeSequences) {
    if (sequence.schemaVersion !== 1 || !sequence.sequenceId || narrativeIds.has(sequence.sequenceId)
      || !Array.isArray(sequence.pages) || !sequence.pages.some(page => page.pageId === sequence.initialPageId)) {
      throw new Error(`${path.relative(root, filePath)} contiene una secuencia narrativa inválida.`);
    }
    narrativeIds.add(sequence.sequenceId);
    const pageIds = new Set(sequence.pages.map(page => page.pageId));
    for (const page of sequence.pages) {
      if (!page.pageId || !page.speakerName || typeof page.text !== 'string'
        || (page.nextPageId && !pageIds.has(page.nextPageId))) {
        throw new Error(`${sequence.sequenceId}: página narrativa o enlace inválido.`);
      }
    }
  }
  for (const mission of document.missions) {
    if (![1, 2].includes(mission.schemaVersion) || typeof mission.missionId !== 'string'
      || mission.mapId !== document.mapId || !mission.title || !mission.loadingText
      || !Array.isArray(mission.objectives) || !Array.isArray(mission.rewards)) {
      throw new Error(`${path.relative(root, filePath)} contiene una misión inválida.`);
    }
    for (const sequenceId of Object.values(mission.schemaVersion === 1 ? mission.narratives ?? {} : {})) {
      if (sequenceId && !narrativeIds.has(sequenceId) && !globalNarrativeIds.has(sequenceId)) {
        throw new Error(`${mission.missionId}: la narrativa ${sequenceId} no existe.`);
      }
    }
    if (mission.schemaVersion === 2 && !['draft', 'published', 'archived'].includes(mission.publicationStatus)) {
      throw new Error(`${mission.missionId}: estado editorial inválido.`);
    }
    if (mission.flow) validateFlow(mission, mission.flow);
    if (mission.schemaVersion === 2 && mission.publicationStatus === 'draft') continue;
    if (usedIds.has(mission.missionId)) throw new Error(`Misión duplicada: ${mission.missionId}.`);
    usedIds.add(mission.missionId);
    entries.push({
      schemaVersion: 2,
      missionId: mission.missionId,
      mapId: mission.mapId,
      documentPath: path.relative(publicRoot, filePath).replaceAll(path.sep, '/'),
      publicationStatus: mission.schemaVersion === 2 ? mission.publicationStatus : 'published',
    });
  }
  const adventurePath = filePath.replace(/\.missions\.json$/iu, '.adventure.json');
  if (fs.existsSync(adventurePath)) {
    const adventure = readJson(adventurePath);
    const declared = new Set(adventure.missionIds ?? []);
    const documented = new Set(document.missions
      .filter(mission => mission.schemaVersion !== 2 || mission.publicationStatus !== 'draft')
      .map(mission => mission.missionId));
    const mismatch = [...declared].some(id => !documented.has(id))
      || [...documented].some(id => !declared.has(id));
    if (mismatch) {
      throw new Error(`${path.relative(root, filePath)} y ${path.relative(root, adventurePath)} no comparten missionIds.`);
    }
  }
}

entries.sort((left, right) => left.missionId.localeCompare(right.missionId));
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
writeJson(outputPath, { schemaVersion: 2, missions: entries });
console.log(`Manifiesto de misiones: ${entries.length} entradas.`);
