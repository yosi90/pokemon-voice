import { useEffect, useState } from 'react';
import type {
  AdventureMapV3,
  CharacterSpriteAssetV1,
  PmdSpriteAssetV1,
  PokemonTypeId,
} from '../../../packages/contracts/src/index.js';
import type { LoadedAdventureMapBundle } from '../../domain/maps/loadAdventureBundle.js';
import {
  MINIMUM_POKEMON_ASSETS_PER_SECTOR,
  synchronizeAdventureRequiredAssetIds,
  validateAdventureSectorRoster,
} from '../../domain/expeditions/adventureMapV3.js';
import {
  DEFAULT_POKEDISCOVER_RANDOM_FILTERS,
  POKEDISCOVER_RANDOM_CANDIDATES,
  POKEMON_TYPE_LABELS,
  POKEMON_TYPE_OPTIONS,
  filterPokeDiscoverCandidates,
  type PokeDiscoverRandomCandidate,
  type PokeDiscoverRandomFilters,
} from '../../domain/tools/pokeDiscoverRandomizer.js';
import { inferPokemonRosterFromAnchorNames } from '../../domain/tools/pokeDiscoverRosterInference.js';
import { CharacterAnimationPreview } from './CharacterAnimationPreview.js';
import { PmdAnimationPreview } from './PmdAnimationPreview.js';

const GENERATIONS = Object.freeze([1, 2, 3, 4, 5, 6, 7, 8, 9]);
const MAX_VISIBLE_RESULTS = 5;

function appendUnique(values: string[], value: string) {
  return value && !values.includes(value) ? [...values, value] : values;
}

const POKEMON_CANDIDATE_BY_FORM_ID = new Map(
  POKEDISCOVER_RANDOM_CANDIDATES.map(candidate => [candidate.candidateId, candidate]),
);

function candidateForPmdAsset(asset: PmdSpriteAssetV1): PokeDiscoverRandomCandidate | undefined {
  const candidate = POKEMON_CANDIDATE_BY_FORM_ID.get(asset.formId);
  return candidate ? { ...candidate, assetId: asset.assetId } : undefined;
}

function npcDisplayName(assetId: string) {
  const known: Record<string, string> = {
    'character:npc:professor-alcanfor': 'Profesor Alcanfor',
    'character:npc:professor-alcanfor-fallen': 'Profesor Alcanfor caído',
    'character:npc:scientist': 'Científico',
  };
  return known[assetId] ?? assetId.split(':').at(-1)!
    .split('-')
    .map(word => word.charAt(0).toLocaleUpperCase('es') + word.slice(1))
    .join(' ');
}

function PokemonRosterCard({
  asset,
  candidate,
  action,
  disabled,
  onClick,
}: {
  asset?: PmdSpriteAssetV1;
  candidate?: PokeDiscoverRandomCandidate;
  action: 'add' | 'remove';
  disabled?: boolean;
  onClick: () => void;
}) {
  const animation = asset?.animations.find(value => value.name === 'Idle')
    ?? asset?.animations[0];
  const displayName = candidate?.displayName ?? asset?.assetId ?? 'Asset no disponible';
  const actionLabel = action === 'add' ? 'Añadir' : 'Quitar';
  return <button
    type="button"
    className={`editor-roster-card is-${action}`}
    disabled={disabled}
    aria-label={`${actionLabel} ${displayName}`}
    title={disabled ? 'No puede quitarse porque una colocación utiliza este asset.' : undefined}
    onClick={onClick}
  >
    {animation ? <PmdAnimationPreview animation={animation} label={`${displayName} Idle`} /> : (
      <span className="editor-roster-card__missing" aria-hidden="true">?</span>
    )}
    <strong>{displayName}</strong>
  </button>;
}

function NpcRosterCard({
  asset,
  action,
  disabled,
  onClick,
}: {
  asset?: CharacterSpriteAssetV1;
  action: 'add' | 'remove';
  disabled?: boolean;
  onClick: () => void;
}) {
  const displayName = asset ? npcDisplayName(asset.assetId) : 'Asset NPC no disponible';
  const actionLabel = action === 'add' ? 'Añadir' : 'Quitar';
  return <button
    type="button"
    className={`editor-roster-card is-${action}`}
    disabled={disabled}
    aria-label={`${actionLabel} ${displayName}`}
    title={disabled ? 'No puede quitarse porque una colocación utiliza este NPC.' : undefined}
    onClick={onClick}
  >
    {asset ? <CharacterAnimationPreview asset={asset} label={displayName} /> : (
      <span className="editor-roster-card__missing" aria-hidden="true">?</span>
    )}
    <strong>{displayName}</strong>
  </button>;
}

export function SectorRosterEditor({
  adventure,
  bundle,
  sectorId,
  onChange,
  showValidationMessages = true,
  dialogFlow = false,
  onStepChange,
}: {
  adventure: AdventureMapV3;
  bundle: LoadedAdventureMapBundle;
  sectorId: string;
  onChange: (adventure: AdventureMapV3) => void;
  showValidationMessages?: boolean;
  dialogFlow?: boolean;
  onStepChange?: (step: 'pokemon' | 'npc') => void;
}) {
  const sector = adventure.sectors.find(candidate => candidate.sectorId === sectorId);
  const inferredPokemon = sector?.roster.pokemonAssetIds.length === 0
    ? inferPokemonRosterFromAnchorNames(
      bundle.sectors.find(candidate => candidate.sector.sectorId === sectorId)?.tilemap,
      bundle.pmdManifest,
    )
    : [];
  const initialPokemonAssetIds = sector?.roster.pokemonAssetIds.length
    ? sector.roster.pokemonAssetIds
    : inferredPokemon.map(candidate => candidate.assetId);
  const [step, setStep] = useState<'pokemon' | 'npc'>('pokemon');
  const [pokemonAssetIds, setPokemonAssetIds] = useState<string[]>(
    initialPokemonAssetIds,
  );
  const [npcAssetIds, setNpcAssetIds] = useState<string[]>(
    sector?.roster.npcAssetIds ?? [],
  );
  const [filters, setFilters] = useState<PokeDiscoverRandomFilters>({
    ...DEFAULT_POKEDISCOVER_RANDOM_FILTERS,
  });
  const [npcQuery, setNpcQuery] = useState('');
  const [pokemonContinueAttempted, setPokemonContinueAttempted] = useState(false);

  useEffect(() => {
    setStep('pokemon');
    setPokemonAssetIds(sector?.roster.pokemonAssetIds.length
      ? sector.roster.pokemonAssetIds
      : inferredPokemon.map(candidate => candidate.assetId));
    setNpcAssetIds(sector?.roster.npcAssetIds ?? []);
    setFilters({ ...DEFAULT_POKEDISCOVER_RANDOM_FILTERS });
    setNpcQuery('');
    setPokemonContinueAttempted(false);
  }, [sectorId]);

  if (!sector) return <p role="alert">No existe el sector seleccionado.</p>;
  const pokemonAssets = bundle.pmdManifest.assets;
  const npcAssets = bundle.characterManifest.assets.filter(asset => asset.role === 'npc');
  const pokemonAssetById = new Map(pokemonAssets.map(asset => [asset.assetId, asset]));
  const npcAssetById = new Map(npcAssets.map(asset => [asset.assetId, asset]));
  const manifestPokemonIds = new Set(pokemonAssetById.keys());
  const manifestNpcIds = new Set(npcAssetById.keys());
  const draftRoster = {
    ...sector.roster,
    pokemonAssetIds,
    npcAssetIds,
  };
  const errors = validateAdventureSectorRoster({ ...sector, roster: draftRoster }, {
    pokemonAssetIds: manifestPokemonIds,
    npcAssetIds: manifestNpcIds,
  });
  const validPokemonStep = new Set(pokemonAssetIds).size >= MINIMUM_POKEMON_ASSETS_PER_SECTOR
    && pokemonAssetIds.every(assetId => manifestPokemonIds.has(assetId));
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
  const finishRoster = () => onChange(synchronizeAdventureRequiredAssetIds({
    ...adventure,
    sectors: adventure.sectors.map(candidate => candidate.sectorId === sectorId
      ? { ...candidate, roster: draftRoster }
      : candidate),
  }, { preserveAssetIds: unrelatedRequiredAssets }));
  const usedPokemon = new Set(adventure.actorPlacements
    .filter(placement => placement.sectorId === sectorId)
    .map(placement => placement.assetId));
  const usedNpcs = new Set(adventure.characterPlacements
    .filter(placement => placement.sectorId === sectorId && !placement.controllable)
    .map(placement => placement.assetId));
  const candidates = pokemonAssets.flatMap(asset => {
    if (pokemonAssetIds.includes(asset.assetId)) return [];
    const candidate = candidateForPmdAsset(asset);
    return candidate ? [candidate] : [];
  });
  const availableCandidates = filterPokeDiscoverCandidates(filters, candidates);
  const visibleCandidates = availableCandidates.slice(0, MAX_VISIBLE_RESULTS);
  const visibleNpcs = npcAssets
    .filter(asset => !npcAssetIds.includes(asset.assetId))
    .filter(asset => npcDisplayName(asset.assetId).toLocaleLowerCase('es')
      .includes(npcQuery.trim().toLocaleLowerCase('es')))
    .slice(0, MAX_VISIBLE_RESULTS);
  const changeFilter = <Key extends keyof PokeDiscoverRandomFilters>(
    key: Key,
    value: PokeDiscoverRandomFilters[Key],
  ) => setFilters(current => ({ ...current, [key]: value }));
  const changeStep = (nextStep: 'pokemon' | 'npc') => {
    setStep(nextStep);
    onStepChange?.(nextStep);
  };
  const continueToNpc = () => {
    if (!validPokemonStep) {
      setPokemonContinueAttempted(true);
      return;
    }
    setPokemonContinueAttempted(false);
    changeStep('npc');
  };

  return <section className="editor-form-section editor-roster-editor" aria-label="Reparto del sector">
    <header><div><span>Prerrequisito de autoría</span><strong>Reparto del sector</strong></div></header>
    {!dialogFlow ? <nav className="editor-roster-steps" aria-label="Pasos del reparto">
      <button type="button" aria-current={step === 'pokemon' ? 'step' : undefined} onClick={() => setStep('pokemon')}>
        1. Pokémon
      </button>
      <button type="button" aria-current={step === 'npc' ? 'step' : undefined} disabled={!validPokemonStep} onClick={() => setStep('npc')}>
        2. NPC
      </button>
    </nav> : null}
    <p className="editor-roster-summary"><strong>{pokemonAssetIds.length}/{MINIMUM_POKEMON_ASSETS_PER_SECTOR}</strong> Pokémon · <strong>{npcAssetIds.length}</strong> NPC</p>

    {step === 'pokemon' ? <>
      <p className="editor-roster-copy">Elige al menos cinco Pokémon previstos para el sector. Las formas y apariencias cuentan individualmente.</p>
      {showValidationMessages && errors.length
        ? <ul>{errors.map(error => <li key={error}>{error}</li>)}</ul>
        : null}
      <div className="editor-roster-filters" aria-label="Filtros del catálogo Pokémon">
        <label>
          <span>Buscar por texto</span>
          <input
            type="search"
            aria-label="Buscar Pokémon para el reparto"
            placeholder="Nombre, número o asset…"
            value={filters.query}
            onChange={event => changeFilter('query', event.target.value)}
          />
        </label>
        <label><span>Tipo principal</span><select
          aria-label="Tipo principal"
          value={filters.primaryType}
          onChange={event => changeFilter(
            'primaryType',
            event.target.value as PokemonTypeId | 'all',
          )}
        >
          <option value="all">Todos</option>
          {POKEMON_TYPE_OPTIONS.map(value => (
            <option key={value} value={value}>{POKEMON_TYPE_LABELS[value]}</option>
          ))}
        </select></label>
        <label><span>Tipo secundario</span><select
          aria-label="Tipo secundario"
          value={filters.secondaryType}
          onChange={event => changeFilter(
            'secondaryType',
            event.target.value as PokemonTypeId | 'all' | 'none',
          )}
        >
          <option value="all">Todos</option>
          <option value="none">Sin tipo secundario</option>
          {POKEMON_TYPE_OPTIONS.map(value => (
            <option key={value} value={value}>{POKEMON_TYPE_LABELS[value]}</option>
          ))}
        </select></label>
        <label><span>Generación</span><select
          aria-label="Generación"
          value={filters.generation}
          onChange={event => changeFilter(
            'generation',
            event.target.value === 'all' ? 'all' : Number(event.target.value),
          )}
        >
          <option value="all">Todas</option>
          {GENERATIONS.map(value => <option key={value} value={value}>Generación {value}</option>)}
        </select></label>
      </div>
      <p className="editor-roster-results-summary">
        {availableCandidates.length} resultados. Se muestran como máximo los primeros cinco.
      </p>
      <div className="editor-roster-grid" aria-label="Primeros Pokémon encontrados">
        {visibleCandidates.map(candidate => (
          <PokemonRosterCard
            key={candidate.assetId}
            asset={pokemonAssetById.get(candidate.assetId)}
            candidate={candidate}
            action="add"
            onClick={() => setPokemonAssetIds(current => appendUnique(current, candidate.assetId))}
          />
        ))}
        {!visibleCandidates.length ? <p>No hay assets PMD disponibles que cumplan los filtros.</p> : null}
      </div>
      <h3>Pokémon elegidos para el sector</h3>
      <div className="editor-roster-grid is-selected" aria-label="Pokémon elegidos">
        {pokemonAssetIds.map(assetId => (
          <PokemonRosterCard
            key={assetId}
            asset={pokemonAssetById.get(assetId)}
            candidate={pokemonAssetById.get(assetId)
              ? candidateForPmdAsset(pokemonAssetById.get(assetId)!)
              : undefined}
            action="remove"
            disabled={usedPokemon.has(assetId)}
            onClick={() => setPokemonAssetIds(current => current.filter(value => value !== assetId))}
          />
        ))}
        {!pokemonAssetIds.length ? <p>Todavía no has elegido ningún Pokémon.</p> : null}
      </div>
      <div className="editor-roster-navigation">
        {pokemonContinueAttempted && !validPokemonStep ? <p role="alert">
          Selecciona al menos {MINIMUM_POKEMON_ASSETS_PER_SECTOR} Pokémon distintos para continuar.
          Te faltan {Math.max(
            0,
            MINIMUM_POKEMON_ASSETS_PER_SECTOR - new Set(pokemonAssetIds).size,
          )}.
        </p> : null}
        <button type="button" className="is-primary" onClick={continueToNpc}>
          Continuar a NPC
        </button>
      </div>
    </> : <>
      <p className="editor-roster-copy">Añade los personajes previstos para este sector o finaliza sin elegir ninguno.</p>
      <div className="editor-roster-filters is-npc" aria-label="Filtros del catálogo NPC">
        <label>
          <span>Buscar NPC</span>
          <input
            type="search"
            aria-label="Buscar NPC para el reparto"
            placeholder="Nombre del personaje…"
            value={npcQuery}
            onChange={event => setNpcQuery(event.target.value)}
          />
        </label>
      </div>
      <div className="editor-roster-grid" aria-label="NPC encontrados">
        {visibleNpcs.map(asset => (
          <NpcRosterCard
            key={asset.assetId}
            asset={asset}
            action="add"
            onClick={() => setNpcAssetIds(current => appendUnique(current, asset.assetId))}
          />
        ))}
        {!visibleNpcs.length ? <p>No hay NPC disponibles que cumplan la búsqueda.</p> : null}
      </div>
      <h3>NPC elegidos para el sector</h3>
      <div className="editor-roster-grid is-selected" aria-label="NPC elegidos">
        {npcAssetIds.map(assetId => (
          <NpcRosterCard
            key={assetId}
            asset={npcAssetById.get(assetId)}
            action="remove"
            disabled={usedNpcs.has(assetId)}
            onClick={() => setNpcAssetIds(current => current.filter(value => value !== assetId))}
          />
        ))}
        {!npcAssetIds.length ? <p>No hay NPC previstos. Puedes continuar así.</p> : null}
      </div>
      {showValidationMessages && errors.length
        ? <ul>{errors.map(error => <li key={error}>{error}</li>)}</ul>
        : null}
      <div className="editor-roster-navigation">
        <button type="button" onClick={() => changeStep('pokemon')}>Volver a Pokémon</button>
        <button type="button" className="is-primary" disabled={errors.length > 0} onClick={finishRoster}>
          {npcAssetIds.length ? 'Guardar reparto y continuar' : 'Finalizar sin NPC'}
        </button>
      </div>
    </>}
  </section>;
}
