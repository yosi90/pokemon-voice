import type { AdventureMapV3 } from '../../../packages/contracts/src/index.js';
import type { LoadedAdventureMapBundle } from '../../domain/maps/loadAdventureBundle.js';
import {
  MINIMUM_POKEMON_ASSETS_PER_SECTOR,
  synchronizeAdventureRequiredAssetIds,
  validateAdventureSectorRoster,
} from '../../domain/expeditions/adventureMapV3.js';

function appendUnique(values: string[], value: string) {
  return value && !values.includes(value) ? [...values, value] : values;
}

export function SectorRosterEditor({
  adventure,
  bundle,
  sectorId,
  onChange,
}: {
  adventure: AdventureMapV3;
  bundle: LoadedAdventureMapBundle;
  sectorId: string;
  onChange: (adventure: AdventureMapV3) => void;
}) {
  const sector = adventure.sectors.find(candidate => candidate.sectorId === sectorId);
  if (!sector) return <p role="alert">No existe el sector seleccionado.</p>;
  const pokemonAssets = bundle.pmdManifest.assets;
  const npcAssets = bundle.characterManifest.assets.filter(asset => asset.role === 'npc');
  const errors = validateAdventureSectorRoster(sector, {
    pokemonAssetIds: new Set(pokemonAssets.map(asset => asset.assetId)),
    npcAssetIds: new Set(npcAssets.map(asset => asset.assetId)),
  });
  const currentlyManagedAssets = new Set([
    ...adventure.sectors.flatMap(candidate => [
      ...candidate.roster.pokemonAssetIds,
      ...candidate.roster.npcAssetIds,
    ]),
    ...adventure.actorPlacements.map(placement => placement.assetId),
    ...adventure.characterPlacements.map(placement => placement.assetId),
  ]);
  const unrelatedRequiredAssets = adventure.requiredAssetIds.filter(
    assetId => !currentlyManagedAssets.has(assetId),
  );
  const updateRoster = (roster: typeof sector.roster) => onChange(
    synchronizeAdventureRequiredAssetIds({
      ...adventure,
      sectors: adventure.sectors.map(candidate => candidate.sectorId === sectorId
        ? { ...candidate, roster }
        : candidate),
    }, { preserveAssetIds: unrelatedRequiredAssets }),
  );
  const usedPokemon = new Set(adventure.actorPlacements
    .filter(placement => placement.sectorId === sectorId)
    .map(placement => placement.assetId));
  const usedNpcs = new Set(adventure.characterPlacements
    .filter(placement => placement.sectorId === sectorId && !placement.controllable)
    .map(placement => placement.assetId));

  return <section className="editor-form-section" aria-label="Reparto del sector">
    <header><div><span>Prerrequisito de autoría</span><strong>Reparto del sector</strong></div></header>
    <p>Declara los recursos previstos antes de crear entradas, anclas o contenido. Las formas y apariencias cuentan individualmente.</p>
    <p><strong>{sector.roster.pokemonAssetIds.length}/{MINIMUM_POKEMON_ASSETS_PER_SECTOR}</strong> Pokémon · <strong>{sector.roster.npcAssetIds.length}</strong> NPC</p>
    {errors.length ? <ul>{errors.map(error => <li key={error}>{error}</li>)}</ul> : <p>El reparto es válido para crear contenido.</p>}

    <label><span>Añadir Pokémon del catálogo</span><select
      value=""
      onChange={event => {
        updateRoster({
          ...sector.roster,
          pokemonAssetIds: appendUnique(sector.roster.pokemonAssetIds, event.target.value),
        });
      }}
    >
      <option value="">Seleccionar…</option>
      {pokemonAssets.filter(asset => !sector.roster.pokemonAssetIds.includes(asset.assetId))
        .map(asset => <option key={asset.assetId} value={asset.assetId}>{asset.assetId}</option>)}
    </select></label>
    <ul>
      {sector.roster.pokemonAssetIds.map(assetId => <li key={assetId}>
        <code>{assetId}</code>
        <button type="button" disabled={usedPokemon.has(assetId)} title={usedPokemon.has(assetId)
          ? 'No puede quitarse: hay una colocación que lo utiliza.'
          : undefined} onClick={() => updateRoster({
          ...sector.roster,
          pokemonAssetIds: sector.roster.pokemonAssetIds.filter(value => value !== assetId),
        })}>Quitar</button>
      </li>)}
    </ul>

    <label><span>Añadir NPC del catálogo</span><select
      value=""
      onChange={event => {
        updateRoster({
          ...sector.roster,
          npcAssetIds: appendUnique(sector.roster.npcAssetIds, event.target.value),
        });
      }}
    >
      <option value="">Seleccionar…</option>
      {npcAssets.filter(asset => !sector.roster.npcAssetIds.includes(asset.assetId))
        .map(asset => <option key={asset.assetId} value={asset.assetId}>{asset.assetId}</option>)}
    </select></label>
    <ul>
      {sector.roster.npcAssetIds.map(assetId => <li key={assetId}>
        <code>{assetId}</code>
        <button type="button" disabled={usedNpcs.has(assetId)} title={usedNpcs.has(assetId)
          ? 'No puede quitarse: hay una colocación que lo utiliza.'
          : undefined} onClick={() => updateRoster({
          ...sector.roster,
          npcAssetIds: sector.roster.npcAssetIds.filter(value => value !== assetId),
        })}>Quitar</button>
      </li>)}
    </ul>
  </section>;
}
