import { useMemo, useState } from 'react';
import type { PokemonSizeClass, PokemonTypeId } from '../../../packages/contracts/src/index.js';
import { getCompanionArtworkUrl } from '../../domain/companions/companionGameplayCatalog.js';
import {
  DEFAULT_POKEDISCOVER_RANDOM_FILTERS,
  POKEDISCOVER_RANDOM_CANDIDATES,
  POKEMON_SIZE_LABELS,
  POKEMON_SIZE_OPTIONS,
  POKEMON_TYPE_LABELS,
  POKEMON_TYPE_OPTIONS,
  filterPokeDiscoverCandidates,
  pickRandomPokeDiscoverCandidate,
  type PokeDiscoverRandomCandidate,
  type PokeDiscoverRandomFilters,
} from '../../domain/tools/pokeDiscoverRandomizer.js';

const GENERATIONS = Object.freeze([1, 2, 3, 4, 5, 6, 7, 8, 9]);

function TypeBadge({ type }: { type: PokemonTypeId }) {
  return <span className={`randomizer-type randomizer-type--${type}`}>{POKEMON_TYPE_LABELS[type]}</span>;
}

export function PokeDiscoverRandomizer() {
  const [filters, setFilters] = useState<PokeDiscoverRandomFilters>({ ...DEFAULT_POKEDISCOVER_RANDOM_FILTERS });
  const [result, setResult] = useState<PokeDiscoverRandomCandidate | null>(null);
  const [imageFailed, setImageFailed] = useState(false);
  const matches = useMemo(() => filterPokeDiscoverCandidates(filters), [filters]);

  const changeFilter = <Key extends keyof PokeDiscoverRandomFilters>(
    key: Key,
    value: PokeDiscoverRandomFilters[Key],
  ) => {
    setFilters(current => ({ ...current, [key]: value }));
    setResult(null);
    setImageFailed(false);
  };

  const randomize = () => {
    setResult(pickRandomPokeDiscoverCandidate(matches, result?.candidateId));
    setImageFailed(false);
  };

  return (
    <main className="randomizer-shell">
      <section className="randomizer-panel" aria-labelledby="randomizer-title">
        <header className="randomizer-header">
          <span className="randomizer-eyebrow">Herramienta PokeDiscover</span>
          <h1 id="randomizer-title">Pokémon aleatorio</h1>
          <p>Filtra el catálogo y deja que Alcanfor elija el próximo posible hallazgo.</p>
        </header>

        <div className="randomizer-filters" aria-label="Filtros del sorteo">
          <label>
            <span>Buscar</span>
            <input
              aria-label="Buscar Pokémon"
              type="search"
              value={filters.query}
              placeholder="Nombre, número o asset…"
              onChange={event => changeFilter('query', event.target.value)}
            />
          </label>
          <label>
            <span>Tipo principal</span>
            <select
              aria-label="Tipo principal"
              value={filters.primaryType}
              onChange={event => changeFilter('primaryType', event.target.value as PokemonTypeId | 'all')}
            >
              <option value="all">Todos</option>
              {POKEMON_TYPE_OPTIONS.map(type => <option key={type} value={type}>{POKEMON_TYPE_LABELS[type]}</option>)}
            </select>
          </label>
          <label>
            <span>Tipo secundario</span>
            <select
              aria-label="Tipo secundario"
              value={filters.secondaryType}
              onChange={event => changeFilter('secondaryType', event.target.value as PokemonTypeId | 'all' | 'none')}
            >
              <option value="all">Todos</option>
              <option value="none">Sin tipo secundario</option>
              {POKEMON_TYPE_OPTIONS.map(type => <option key={type} value={type}>{POKEMON_TYPE_LABELS[type]}</option>)}
            </select>
          </label>
          <label>
            <span>Generación</span>
            <select
              aria-label="Generación"
              value={filters.generation}
              onChange={event => changeFilter('generation', event.target.value === 'all' ? 'all' : Number(event.target.value))}
            >
              <option value="all">Todas</option>
              {GENERATIONS.map(generation => <option key={generation} value={generation}>Generación {generation}</option>)}
            </select>
          </label>
          <label>
            <span>Tamaño</span>
            <select
              aria-label="Tamaño"
              value={filters.sizeClass}
              onChange={event => changeFilter('sizeClass', event.target.value as PokemonSizeClass | 'all')}
            >
              <option value="all">Todos</option>
              {POKEMON_SIZE_OPTIONS.map(size => <option key={size} value={size}>{POKEMON_SIZE_LABELS[size]}</option>)}
            </select>
          </label>
        </div>

        <div className="randomizer-action-row">
          <span aria-live="polite">{matches.length.toLocaleString('es-ES')} candidatos posibles</span>
          <button type="button" onClick={randomize} disabled={matches.length === 0}>Randomizar</button>
        </div>

        <div className="randomizer-result" aria-live="polite" data-testid="randomizer-result">
          {result ? (
            <article className="randomizer-pokemon-card">
              <div className="randomizer-artwork" aria-hidden="true">
                {!imageFailed && (
                  <img
                    src={getCompanionArtworkUrl(result.assetId, result.speciesId)}
                    alt=""
                    onError={() => setImageFailed(true)}
                  />
                )}
                {imageFailed && <span>?</span>}
              </div>
              <div className="randomizer-result-copy">
                <span className="randomizer-number">#{String(result.speciesId).padStart(4, '0')}</span>
                <h2>{result.displayName}</h2>
                {result.displayName !== result.speciesName && <p>Variante de {result.speciesName}</p>}
                <div className="randomizer-types">
                  <TypeBadge type={result.primaryType} />
                  {result.secondaryType && <TypeBadge type={result.secondaryType} />}
                </div>
                <dl>
                  <div><dt>Generación</dt><dd>{result.generation}</dd></div>
                  <div><dt>Tamaño</dt><dd>{POKEMON_SIZE_LABELS[result.sizeClass]}</dd></div>
                  <div><dt>Altura</dt><dd>{result.heightMeters.toLocaleString('es-ES')} m</dd></div>
                </dl>
              </div>
            </article>
          ) : (
            <p className="randomizer-empty">
              {matches.length > 0 ? 'Pulsa Randomizar para obtener un Pokémon.' : 'No hay Pokémon que cumplan todos esos filtros.'}
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
