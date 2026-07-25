import { useEffect, useMemo, useState } from 'react';
import type { PmdAnimationManifestV1 } from '../../../packages/contracts/src/index.js';
import {
  FIELD_CAPABILITY_LABELS,
  filterPokeDiscoverEditorCatalog,
  type PokeDiscoverEditorVariantKind,
  POKEDISCOVER_EDITOR_CATALOG,
} from '../../domain/tools/pokeDiscoverEditorCatalog.js';
import {
  findPmdAssetForCatalogEntry,
  getPmdAnimations,
} from '../../domain/tools/pokeDiscoverEditorPmd.js';
import { PmdAnimationPreview } from './PmdAnimationPreview.js';

const GENERATIONS = Object.freeze([1, 2, 3, 4, 5, 6, 7, 8, 9]);
const PAGE_SIZE = 24;
const VARIANT_KIND_OPTIONS: ReadonlyArray<{ id: PokeDiscoverEditorVariantKind; label: string }> = Object.freeze([
  { id: 'baseForm', label: 'Forma base' },
  { id: 'alternativeForm', label: 'Forma alternativa' },
  { id: 'appearance', label: 'Skin / apariencia' },
]);

interface CatalogExplorerProps {
  pmdManifest?: PmdAnimationManifestV1;
  pmdError?: string;
  selectionMode?: boolean;
  onSelect?: (selection: { assetId: string; animation: string }) => void;
}

export function CatalogExplorer({
  pmdManifest,
  pmdError,
  selectionMode,
  onSelect,
}: CatalogExplorerProps) {
  const [query, setQuery] = useState('');
  const [generation, setGeneration] = useState<number | 'all'>('all');
  const [variantKinds, setVariantKinds] = useState<PokeDiscoverEditorVariantKind[]>(VARIANT_KIND_OPTIONS.map(option => option.id));
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState(POKEDISCOVER_EDITOR_CATALOG[0]?.variantId ?? '');
  const matches = useMemo(() => filterPokeDiscoverEditorCatalog(
    POKEDISCOVER_EDITOR_CATALOG,
    { query, generation, variantKinds },
  ), [generation, query, variantKinds]);
  const pageCount = Math.max(1, Math.ceil(matches.length / PAGE_SIZE));
  const visibleMatches = matches.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  useEffect(() => setPage(1), [generation, query, variantKinds]);
  const selected = POKEDISCOVER_EDITOR_CATALOG.find(entry => entry.variantId === selectedId)
    ?? matches[0];
  const selectedPmdAsset = selected && pmdManifest
    ? findPmdAssetForCatalogEntry(selected, pmdManifest)
    : undefined;
  const pmdAnimations = selectedPmdAsset && pmdManifest
    ? getPmdAnimations(selectedPmdAsset, pmdManifest.tickRate)
    : [];
  const [selectedAnimationName, setSelectedAnimationName] = useState('Idle');
  const selectedAnimation = pmdAnimations.find(animation => animation.name === selectedAnimationName)
    ?? pmdAnimations[0];
  return (
    <section className="editor-catalog" aria-labelledby="editor-catalog-title">
      <div className="editor-catalog__head">
        <h2 id="editor-catalog-title">Catálogo Pokémon</h2>
      </div>
      <div className="editor-catalog__filters">
        <label>
          <span>Buscar variante o capacidad</span>
          <input
            type="search"
            value={query}
            placeholder="Geodude, surf, #25…"
            onChange={event => setQuery(event.target.value)}
          />
        </label>
        <label>
          <span>Generación</span>
          <select
            value={generation}
            onChange={event => setGeneration(event.target.value === 'all' ? 'all' : Number(event.target.value))}
          >
            <option value="all">Todas</option>
            {GENERATIONS.map(value => <option key={value} value={value}>Gen. {value}</option>)}
          </select>
        </label>
        <fieldset className="editor-catalog__kind-filters">
          <legend>Incluir en la búsqueda</legend>
          {VARIANT_KIND_OPTIONS.map(option => <label key={option.id}>
            <input
              type="checkbox"
              checked={variantKinds.includes(option.id)}
              onChange={event => setVariantKinds(current => event.target.checked
                ? [...current, option.id]
                : current.filter(kind => kind !== option.id))}
            />
            <span>{option.label}</span>
          </label>)}
        </fieldset>
      </div>

      <div className="editor-catalog__matches" aria-live="polite">
        <div className="editor-catalog__list" role="listbox" aria-label="Variantes del catálogo">
          {visibleMatches.map(entry => (
            <button
              type="button"
              role="option"
              aria-selected={entry.variantId === selected?.variantId}
              key={entry.variantId}
              onClick={() => setSelectedId(entry.variantId)}
            >
              <span>#{String(entry.species.speciesId).padStart(4, '0')}</span>
              <strong>{entry.displayName}</strong>
              <small>{entry.appearance ? 'Apariencia' : entry.form.kind === 'default' ? 'Forma base' : 'Forma'}</small>
            </button>
          ))}
          {!matches.length ? <p>No hay variantes que coincidan.</p> : null}
        </div>
        {matches.length ? <nav className="editor-catalog__pagination" aria-label="Páginas del catálogo">
          <button type="button" disabled={page === 1} onClick={() => setPage(value => Math.max(1, value - 1))}>Anterior</button>
          <span>Página {page} de {pageCount} · {Math.min((page - 1) * PAGE_SIZE + 1, matches.length)}–{Math.min(page * PAGE_SIZE, matches.length)}</span>
          <button type="button" disabled={page === pageCount} onClick={() => setPage(value => Math.min(pageCount, value + 1))}>Siguiente</button>
        </nav> : null}
      </div>

      {selected ? (
        <article className="editor-catalog__detail" aria-label={`Detalle de ${selected.displayName}`}>
          <header>
            <div>
              <span>#{String(selected.species.speciesId).padStart(4, '0')} · Generación {selected.species.generation}</span>
              <h3>{selected.displayName}</h3>
              {selected.appearance ? <p>Apariencia de {selected.form.displayName}</p> : null}
            </div>
            <span className="editor-catalog__kind">{selected.appearance?.kind ?? selected.form.kind}</span>
          </header>
          <dl>
            <div><dt>Tipos</dt><dd>{selected.form.types.join(' · ')}</dd></div>
            <div><dt>Etapa</dt><dd>{selected.form.evolutionStage}</dd></div>
            <div><dt>Nivel narrativo</dt><dd>{selected.form.companion.minimumTrainerLevel}</dd></div>
            <div><dt>Seleccionable</dt><dd>{(selected.appearance?.selectableCompanion ?? selected.form.selectableCompanion) ? 'Sí' : 'No'}</dd></div>
          </dl>
          <section>
            <h4>Capacidades</h4>
            {selected.capabilities.length ? (
              <ul className="editor-catalog__capabilities">
                {selected.capabilities.map(capability => (
                  <li key={capability.id}>
                    <strong>{FIELD_CAPABILITY_LABELS[capability.id] ?? capability.id}</strong>
                    <span>{capability.source} · fuerza {capability.strength ?? 1}</span>
                    {capability.tags?.length ? <small>{capability.tags.join(' · ')}</small> : null}
                  </li>
                ))}
              </ul>
            ) : <p className="editor-catalog__empty-field">Sin capacidades de campo.</p>}
          </section>
          <section>
            <h4>Etiquetas narrativas</h4>
            <p className="editor-catalog__tags">{selected.narrativeTags.length ? selected.narrativeTags.join(' · ') : 'Sin etiquetas adicionales.'}</p>
          </section>
          <section className="editor-catalog__animations" aria-labelledby="editor-pmd-title">
            <div className="editor-catalog__section-head">
              <h4 id="editor-pmd-title">Animaciones disponibles</h4>
              {selectedPmdAsset ? <span>{pmdAnimations.length} disponibles</span> : null}
            </div>
            {!pmdManifest && !pmdError ? (
              <p className="editor-catalog__empty-field" role="status">Leyendo animaciones…</p>
            ) : null}
            {pmdError ? <p className="editor-catalog__empty-field is-error">{pmdError}</p> : null}
            {pmdManifest && !selectedPmdAsset ? (
              <p className="editor-catalog__empty-field">Esta forma todavía no tiene animaciones preparadas.</p>
            ) : null}
            {selectedPmdAsset && selectedAnimation ? (
              <div className="editor-animation-layout">
                <label className="editor-animation-select">
                  <span>Animación disponible</span>
                  <select
                    value={selectedAnimation.name}
                    onChange={event => setSelectedAnimationName(event.target.value)}
                  >
                    {pmdAnimations.map(animation => (
                      <option key={animation.name} value={animation.name}>{animation.name}</option>
                    ))}
                  </select>
                </label>
                <PmdAnimationPreview animation={selectedAnimation} label={`${selected.displayName} · ${selectedAnimation.name}`} />
                <dl className="editor-animation-meta">
                  <div><dt>Frames</dt><dd>{selectedAnimation.frameCount}</dd></div>
                  <div><dt>Direcciones</dt><dd>{selectedAnimation.directionCount}</dd></div>
                  <div><dt>Celda</dt><dd>{selectedAnimation.frameWidth}×{selectedAnimation.frameHeight}</dd></div>
                  <div><dt>Duración</dt><dd>{Math.round(selectedAnimation.durationMs)} ms</dd></div>
                </dl>
                <details className="editor-catalog__asset-id"><summary>Detalles avanzados</summary><code>{selectedPmdAsset.assetId}</code></details>
                {selectedAnimation.copyOf ? (
                  <p className="editor-catalog__alias">Alias de <strong>{selectedAnimation.copyOf}</strong></p>
                ) : null}
                {selectionMode ? (
                  <button
                    type="button"
                    className="editor-catalog__choose"
                    onClick={() => onSelect?.({
                      assetId: selectedPmdAsset.assetId,
                      animation: selectedAnimation.name,
                    })}
                  >Usar en la colocación</button>
                ) : null}
              </div>
            ) : null}
          </section>
        </article>
      ) : null}
    </section>
  );
}
