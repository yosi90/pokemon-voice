import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { AdventureMapV3 } from '../../packages/contracts/src/index.js';
import pmdManifest from '../../public/assets/sprites/pokemon/pmd/manifest.v1.json';
import characterManifest from '../../public/assets/sprites/characters/manifest.v1.json';
import type { LoadedAdventureMapBundle } from '../../src/domain/maps/loadAdventureBundle.js';
import { SectorRosterEditor } from '../../src/sidewebs/pokediscover-editor/SectorRosterEditor.js';

const INITIAL_POKEMON = [
  'pmd:0001-bulbasaur:default',
  'pmd:0004-charmander:default',
  'pmd:0007-squirtle:default',
  'pmd:0019-rattata:default',
];

function adventure(): AdventureMapV3 {
  return {
    schemaVersion: 3,
    mapId: 'map:roster-test',
    title: 'Mapa',
    tiledMapAssets: [{
      schemaVersion: 1,
      assetId: 'tiled-map:roster-test:01',
      path: 'roster.tmj',
    }],
    sectors: [{
      schemaVersion: 1,
      sectorId: 'sector:roster-test:01',
      tiledMapAssetId: 'tiled-map:roster-test:01',
      staticCamera: true,
      spawnAnchorIds: [],
      roster: {
        schemaVersion: 1,
        pokemonAssetIds: INITIAL_POKEMON,
        npcAssetIds: [],
      },
    }],
    actorPlacements: [],
    characterPlacements: [],
    transitions: [],
    variants: [],
    missionIds: [],
    behaviorTriggers: [],
    expressionTriggers: [],
    ambientSequences: [],
    rareEncounters: [],
    requiredAssetIds: INITIAL_POKEMON,
  };
}

const bundle = {
  pmdManifest,
  characterManifest,
} as unknown as LoadedAdventureMapBundle;

describe('selector visual del reparto del sector', () => {
  it('explica el mínimo cuando se intenta continuar sin cinco Pokémon', async () => {
    const user = userEvent.setup();
    render(<SectorRosterEditor
      adventure={adventure()}
      bundle={bundle}
      sectorId="sector:roster-test:01"
      onChange={vi.fn()}
      dialogFlow
    />);

    await user.click(screen.getByRole('button', { name: 'Continuar a NPC' }));

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Selecciona al menos 5 Pokémon distintos para continuar. Te faltan 1.',
    );
    expect(screen.queryByText('Añade los personajes previstos')).not.toBeInTheDocument();
  });

  it('muestra como máximo cinco resultados y filtra por texto antes de añadir', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<SectorRosterEditor
      adventure={adventure()}
      bundle={bundle}
      sectorId="sector:roster-test:01"
      onChange={onChange}
    />);

    expect(within(screen.getByLabelText('Primeros Pokémon encontrados'))
      .getAllByRole('button')).toHaveLength(5);

    await user.type(screen.getByRole('searchbox', {
      name: 'Buscar Pokémon para el reparto',
    }), 'pikachu');
    const pikachu = within(screen.getByLabelText('Primeros Pokémon encontrados'))
      .getByRole('button', { name: /^Añadir Pikachu$/u });
    await user.click(pikachu);

    expect(onChange).not.toHaveBeenCalled();
    expect(within(screen.getByLabelText('Pokémon elegidos'))
      .getByRole('button', { name: 'Quitar Pikachu' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Continuar a NPC' }));
    expect(within(screen.getByLabelText('NPC encontrados'))
      .getAllByRole('button').length).toBeGreaterThan(0);
    await user.click(screen.getByRole('button', { name: 'Finalizar sin NPC' }));

    const updated = onChange.mock.lastCall?.[0] as AdventureMapV3;
    expect(updated.sectors[0].roster.pokemonAssetIds)
      .toContain('pmd:0025-pikachu:default');
    expect(updated.requiredAssetIds).toContain('pmd:0025-pikachu:default');
  });

  it('muestra los elegidos con Idle y permite quitarlos pulsando su tarjeta', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<SectorRosterEditor
      adventure={adventure()}
      bundle={bundle}
      sectorId="sector:roster-test:01"
      onChange={onChange}
    />);

    const selected = screen.getByLabelText('Pokémon elegidos');
    expect(within(selected).getAllByLabelText(/Preview animada:/u)).toHaveLength(4);
    await user.click(within(selected).getByRole('button', { name: 'Quitar Bulbasaur' }));

    expect(within(selected)
      .queryByRole('button', { name: 'Quitar Bulbasaur' })).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('permite previsualizar y añadir NPC en el segundo paso opcional', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const validAdventure = adventure();
    validAdventure.sectors[0].roster.pokemonAssetIds.push('pmd:0025-pikachu:default');
    render(<SectorRosterEditor
      adventure={validAdventure}
      bundle={bundle}
      sectorId="sector:roster-test:01"
      onChange={onChange}
    />);

    await user.click(screen.getByRole('button', { name: 'Continuar a NPC' }));
    const results = screen.getByLabelText('NPC encontrados');
    expect(within(results).getAllByLabelText(/Preview animada:/u).length).toBeGreaterThan(0);
    await user.click(within(results).getByRole('button', { name: 'Añadir Profesor Alcanfor' }));
    await user.click(screen.getByRole('button', { name: 'Guardar reparto y continuar' }));

    const updated = onChange.mock.lastCall?.[0] as AdventureMapV3;
    expect(updated.sectors[0].roster.npcAssetIds)
      .toContain('character:npc:professor-alcanfor');
  });
});
