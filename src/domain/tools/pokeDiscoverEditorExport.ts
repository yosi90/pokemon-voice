import type {
  AdventureMapV3,
  CharacterSpriteManifestV1,
  PmdAnimationManifestV1,
} from '../../../packages/contracts/src/index.js';

export type PokeDiscoverEditorExportKind = 'sidecar' | 'pmdManifest' | 'characterManifest';

export interface PokeDiscoverEditorExportArtifact {
  kind: PokeDiscoverEditorExportKind;
  fileName: string;
  projectPath: string;
  content: string;
  mimeType: 'application/json';
}

export function serializePokeDiscoverEditorJson(value: unknown) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function verifyPokeDiscoverEditorExportRoundTrip(artifact: PokeDiscoverEditorExportArtifact) {
  try {
    return serializePokeDiscoverEditorJson(JSON.parse(artifact.content)) === artifact.content;
  } catch {
    return false;
  }
}

function sidecarDownloadName(sourceFileName: string, mapId: string) {
  const cleanName = sourceFileName.replaceAll('\\', '/').split('/').at(-1)?.trim();
  if (cleanName?.toLowerCase().endsWith('.adventure.json')) return cleanName;
  const mapSlug = mapId.split(':').at(-1)?.replace(/[^a-z0-9-]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'map';
  return `${mapSlug}.adventure.json`;
}

export function createPokeDiscoverEditorExportArtifacts({
  adventure,
  sidecarFileName,
  pmdManifest,
  characterManifest,
}: {
  adventure: AdventureMapV3;
  sidecarFileName: string;
  pmdManifest: PmdAnimationManifestV1;
  characterManifest: CharacterSpriteManifestV1;
}): PokeDiscoverEditorExportArtifact[] {
  const sidecarFile = sidecarDownloadName(sidecarFileName, adventure.mapId);
  const tiledPath = adventure.tiledMapAssets[0]?.path.replaceAll('\\', '/');
  const mapDirectory = tiledPath?.includes('/') ? tiledPath.slice(0, tiledPath.lastIndexOf('/')) : 'assets/adventure/maps';
  return [
    {
      kind: 'sidecar',
      fileName: sidecarFile,
      projectPath: `public/${mapDirectory}/${sidecarFile}`,
      content: serializePokeDiscoverEditorJson(adventure),
      mimeType: 'application/json',
    },
    {
      kind: 'pmdManifest',
      fileName: 'pmd-manifest.v1.json',
      projectPath: 'public/assets/sprites/pokemon/pmd/manifest.v1.json',
      content: serializePokeDiscoverEditorJson(pmdManifest),
      mimeType: 'application/json',
    },
    {
      kind: 'characterManifest',
      fileName: 'character-manifest.v1.json',
      projectPath: 'public/assets/sprites/characters/manifest.v1.json',
      content: serializePokeDiscoverEditorJson(characterManifest),
      mimeType: 'application/json',
    },
  ];
}
