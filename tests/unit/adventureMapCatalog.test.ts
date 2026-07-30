import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getAdventureMapEntry,
  loadAdventureMapCatalog,
} from '../../src/data/adventure/adventureMapCatalog.js';

describe('catálogo global de mapas', () => {
  afterEach(() => vi.restoreAllMocks());

  it('descubre mapas y sectores utilizables por expediciones de otras aventuras', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      schemaVersion: 1,
      maps: [{
        schemaVersion: 1,
        mapId: 'map:other',
        title: 'Otra aventura',
        documentPath: 'assets/adventure/maps/other/other.adventure.json',
        sectors: [{ sectorId: 'sector:other:start', label: 'Inicio' }],
      }],
    }), { status: 200 }));
    await loadAdventureMapCatalog('./');
    expect(getAdventureMapEntry('map:other')).toEqual(expect.objectContaining({
      documentPath: 'assets/adventure/maps/other/other.adventure.json',
      sectors: [{ sectorId: 'sector:other:start', label: 'Inicio' }],
    }));
  });
});
