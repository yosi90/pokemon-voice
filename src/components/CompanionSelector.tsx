import { useMemo, useState } from 'react';
import type { PokemonCatalogRecord } from '../domain/catalog/pokemonCatalogModel.js';
import type { CompanionCandidate } from '../domain/companions/companionCandidates.js';
import { getCompanionCandidates } from '../domain/companions/companionCandidates.js';
import type { CompanionCategoryId } from '../../packages/contracts/src/index.js';
import {
  COMPANION_CATEGORY_LABELS,
  COMPANION_CATEGORY_ORDER,
  getCompanionArtworkUrl,
} from '../domain/companions/companionGameplayCatalog.js';
import {
  POKEMON_GENERATION_REGIONS,
  getPokemonGenerationId,
  type PokemonGenerationId,
} from '../domain/catalog/pokemonGeneration.js';
import { getBrowserPokeVoiceSave, selectBrowserCompanion } from '../store/browserPokeVoiceSaveStore.js';

const STATUS_LABELS = Object.freeze({
  eligible: 'Disponible',
  ineligible: 'Aún no quiere',
});
const PAGE_SIZE = 24;
const COMPANION_GENERATIONS = Object.keys(POKEMON_GENERATION_REGIONS).map(Number) as PokemonGenerationId[];

export function CompanionSelector({
  catalog,
  onSaveChange,
}: {
  catalog: readonly PokemonCatalogRecord[];
  onSaveChange?: (save: ReturnType<typeof getBrowserPokeVoiceSave>) => void;
}) {
  const [save, setSave] = useState(getBrowserPokeVoiceSave);
  const [feedback, setFeedback] = useState('');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<'all' | CompanionCategoryId>('all');
  const [generation, setGeneration] = useState<'all' | PokemonGenerationId>('all');
  const [page, setPage] = useState(0);
  const candidates = useMemo(() => getCompanionCandidates(catalog, save), [catalog, save]);
  const selected = candidates.find(candidate => candidate.selected);
  const categoryCounts = useMemo(() => {
    const counts = new Map<CompanionCategoryId, number>();
    for (const candidate of candidates) counts.set(candidate.category, (counts.get(candidate.category) ?? 0) + 1);
    return counts;
  }, [candidates]);
  const availableCategories = COMPANION_CATEGORY_ORDER.filter(candidate => categoryCounts.has(candidate));
  const generationCounts = useMemo(() => {
    const counts = new Map<PokemonGenerationId, number>();
    for (const candidate of candidates) {
      const candidateGeneration = getPokemonGenerationId(candidate.record.species.speciesId);
      if (candidateGeneration) counts.set(candidateGeneration, (counts.get(candidateGeneration) ?? 0) + 1);
    }
    return counts;
  }, [candidates]);
  const availableGenerations = COMPANION_GENERATIONS.filter(generationId => generationCounts.has(generationId));
  const filteredCandidates = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('es');
    return candidates.filter(candidate => (
      (category === 'all' || candidate.category === category)
      && (generation === 'all' || getPokemonGenerationId(candidate.record.species.speciesId) === generation)
      && (!normalized
        || candidate.displayName.toLocaleLowerCase('es').includes(normalized)
        || candidate.record.species.slug.replaceAll('-', ' ').includes(normalized)
        || candidate.form.slug.replaceAll('-', ' ').includes(normalized)
        || String(candidate.record.species.speciesId) === normalized.replace(/^#/, ''))
    ));
  }, [candidates, category, generation, query]);
  const pageCount = Math.max(1, Math.ceil(filteredCandidates.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const visibleCandidates = filteredCandidates.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  const choose = (candidate: CompanionCandidate) => {
    const result = selectBrowserCompanion(candidate, catalog);
    if (result.status === 'selected') {
      setSave(result.save);
      onSaveChange?.(result.save);
      setFeedback(`${candidate.displayName} te acompañará en la próxima expedición.`);
    } else if (result.status === 'expeditionActive') {
      setFeedback('Debes regresar de la expedición antes de cambiar de compañero.');
    } else {
      setFeedback(result.eligibility.rejectionText ?? 'Este Pokémon todavía no quiere acompañarte.');
    }
  };

  return (
    <section className="companion-selector" aria-labelledby="companion-selector-title">
      <header className="companion-selector__intro">
        <div>
          <span>Preparación de expedición</span>
          <h4 id="companion-selector-title">Elige compañero</h4>
          <p>Solo puedes llevar uno. Para cambiarlo durante una expedición tendrás que regresar.</p>
        </div>
        <div className="companion-selector__trainer-level" aria-label={`Nivel de entrenador ${save.pokeDiscover.trainerLevel}`}>
          <small>Nivel</small>
          <strong>{save.pokeDiscover.trainerLevel}</strong>
        </div>
      </header>

      {selected && (
        <div className="companion-selector__current">
          <span>Compañero actual</span>
          <strong>{selected.displayName}</strong>
        </div>
      )}

      {feedback && <p className="companion-selector__feedback" role="status">{feedback}</p>}

      <div className="companion-selector__filters">
        <div className="companion-selector__filter-controls">
          <label>
            <span>Buscar candidato</span>
            <input
              type="search"
              value={query}
              placeholder="Nombre o número"
              onChange={event => {
                setQuery(event.target.value);
                setPage(0);
              }}
            />
          </label>
          <label>
            <span>Categoría</span>
            <select
              value={category}
              onChange={event => {
                setCategory(event.target.value as 'all' | CompanionCategoryId);
                setPage(0);
              }}
            >
              <option value="all">Todos ({candidates.length})</option>
              {availableCategories.map(categoryId => (
                <option key={categoryId} value={categoryId}>
                  {COMPANION_CATEGORY_LABELS[categoryId]} ({categoryCounts.get(categoryId)})
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Generación</span>
            <select
              aria-label="Filtrar por generación"
              value={generation}
              onChange={event => {
                setGeneration(event.target.value === 'all' ? 'all' : Number(event.target.value) as PokemonGenerationId);
                setPage(0);
              }}
            >
              <option value="all">Todas ({candidates.length})</option>
              {availableGenerations.map(generationId => (
                <option key={generationId} value={generationId}>
                  {POKEMON_GENERATION_REGIONS[generationId]} · Gen. {generationId} ({generationCounts.get(generationId)})
                </option>
              ))}
            </select>
          </label>
        </div>
        <span>{filteredCandidates.length} candidatos</span>
      </div>

      <div className="companion-selector__grid">
        {visibleCandidates.map(candidate => {
          const id = candidate.record.species.speciesId;
          const status = candidate.eligibility.status;
          const name = candidate.displayName;
          return (
            <article
              key={candidate.variantId}
              className={`companion-card companion-card--${status}${candidate.selected ? ' is-selected' : ''}`}
            >
              <div className="companion-card__art">
                <img src={getCompanionArtworkUrl(candidate.assetId, id)} alt="" loading="lazy" />
                <span>#{String(id).padStart(4, '0')}</span>
              </div>
              <div className="companion-card__body">
                <h5>{name}</h5>
                <span className="companion-card__status">
                  {candidate.selected ? 'Te acompaña' : STATUS_LABELS[status as keyof typeof STATUS_LABELS]}
                </span>
                <p>
                  {candidate.selected
                    ? 'Está preparado para el próximo encargo.'
                    : status === 'eligible'
                      ? 'Aceptaría salir de expedición contigo.'
                      : candidate.eligibility.rejectionText}
                </p>
                <button
                  type="button"
                  disabled={status !== 'eligible' || candidate.selected}
                  onClick={() => choose(candidate)}
                >
                  {candidate.selected ? 'Seleccionado' : 'Elegir'}
                </button>
              </div>
            </article>
          );
        })}
      </div>
      {filteredCandidates.length === 0 && (
        <p className="companion-selector__empty">No hay candidatos conocidos con ese nombre.</p>
      )}
      {pageCount > 1 && (
        <nav className="companion-selector__pagination" aria-label="Páginas de acompañantes">
          <button type="button" disabled={safePage === 0} onClick={() => setPage(current => Math.max(0, current - 1))}>Anterior</button>
          <span>{safePage + 1} / {pageCount}</span>
          <button type="button" disabled={safePage === pageCount - 1} onClick={() => setPage(current => Math.min(pageCount - 1, current + 1))}>Siguiente</button>
        </nav>
      )}
    </section>
  );
}
