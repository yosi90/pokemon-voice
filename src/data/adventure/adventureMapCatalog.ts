import type {
  AdventureMapManifestEntryV1,
  AdventureMapManifestV1,
} from '../../../packages/contracts/src/index.js';

let adventureMaps = new Map<string, AdventureMapManifestEntryV1>([[
  'map:tegueste:camphor-forest',
  {
    schemaVersion: 1,
    mapId: 'map:tegueste:camphor-forest',
    title: 'Bosque de Tegueste',
    documentPath: 'assets/adventure/maps/tegueste-forest/tegueste-forest.adventure.json',
    sectors: [{ sectorId: 'sector:tegueste-forest:02-04', label: '02-04' }],
  },
]]);

function absoluteAssetUrl(path: string, baseUrl: string) {
  const normalized = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  return new URL(path, new URL(normalized, window.location.href)).href;
}

export async function loadAdventureMapCatalog(baseUrl: string) {
  const response = await fetch(absoluteAssetUrl(
    'assets/adventure/maps/manifest.v1.json',
    baseUrl,
  ));
  if (!response.ok) throw new Error(`No se pudo cargar el catálogo de mapas (${response.status}).`);
  const manifest = await response.json() as AdventureMapManifestV1;
  if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.maps)) {
    throw new Error('El manifiesto global de mapas no es válido.');
  }
  adventureMaps = new Map(manifest.maps.map(map => [map.mapId, map]));
  return manifest.maps;
}

export function getAdventureMapEntry(mapId: string) {
  return adventureMaps.get(mapId);
}
