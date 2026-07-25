import { useMemo, useState } from 'react';
import type { AdventureMapV2, ResearchContributionKind, ResearchFieldKey } from '../../../packages/contracts/src/index.js';
import {
  createPokeDiscoverResearchMatrix,
  RESEARCH_MATRIX_FIELDS,
} from '../../domain/tools/pokeDiscoverEditorResearchMatrix.js';

const FIELD_LABELS: Record<ResearchFieldKey, string> = {
  biometrics: 'Biometría', behavior: 'Conducta', habitat: 'Hábitat', exceptional: 'Excepcional',
};
const CONTRIBUTION_LABELS: Record<ResearchContributionKind, string> = {
  observation: 'Observación', fieldCompletion: 'Completa campo', additionalNote: 'Nota adicional',
};

function normalize(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es');
}

function isAdventure(value: unknown): value is AdventureMapV2 {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<AdventureMapV2>;
  return candidate.schemaVersion === 2
    && typeof candidate.mapId === 'string'
    && typeof candidate.title === 'string'
    && (candidate.researchFacts === undefined || Array.isArray(candidate.researchFacts));
}

export function ResearchCoverageMatrix({ adventure }: { adventure: AdventureMapV2 }) {
  const [additional, setAdditional] = useState<AdventureMapV2[]>([]);
  const [fileSummary, setFileSummary] = useState('Ningún proyecto adicional');
  const [fileError, setFileError] = useState('');
  const [query, setQuery] = useState('');
  const [generation, setGeneration] = useState<number | 'all'>('all');
  const [coverage, setCoverage] = useState<'all' | 'covered' | 'empty'>('all');
  const matrix = useMemo(() => createPokeDiscoverResearchMatrix([
    ...additional.filter(candidate => candidate.mapId !== adventure.mapId),
    adventure,
  ]), [additional, adventure]);
  const rows = matrix.rows.filter(row => {
    const queryMatches = !query.trim() || normalize(`${row.speciesId} ${row.displayName}`).includes(normalize(query.trim()));
    const generationMatches = generation === 'all' || row.generation === generation;
    const coverageMatches = coverage === 'all' || (coverage === 'covered' ? row.hasCoverage : !row.hasCoverage);
    return queryMatches && generationMatches && coverageMatches;
  });
  const visibleRows = rows.slice(0, 80);

  const loadSidecars = async (files: FileList | null) => {
    if (!files?.length) return;
    setFileError('');
    const loaded: AdventureMapV2[] = [];
    const errors: string[] = [];
    for (const file of [...files]) {
      try {
        const value = JSON.parse(await file.text()) as unknown;
        if (!isAdventure(value)) throw new Error('no cumple AdventureMapV2');
        loaded.push(value);
      } catch (cause) {
        errors.push(`${file.name}: ${cause instanceof Error ? cause.message : 'JSON inválido'}`);
      }
    }
    setAdditional(loaded);
    setFileSummary(loaded.length ? `${loaded.length} proyecto${loaded.length === 1 ? '' : 's'} adicional${loaded.length === 1 ? '' : 'es'}` : 'Ningún proyecto adicional');
    setFileError(errors.join(' · '));
  };

  return <section className="editor-research-matrix" aria-labelledby="editor-research-matrix-title">
    <header><div><span className="editor-eyebrow">Planificación distribuida</span><h2 id="editor-research-matrix-title">Matriz de cobertura de investigación</h2></div><span>{matrix.maps.length} mapa{matrix.maps.length === 1 ? '' : 's'}</span></header>
    <div className="editor-research-matrix__stats">
      <div><strong>{matrix.coveredSpeciesCount}</strong>{' '}<span>especies con contenido</span></div>
      <div><strong>{matrix.factCount}</strong>{' '}<span>hechos colocados</span></div>
      <div><strong>{matrix.companionReservationCount}</strong>{' '}<span>reservas de convivencia</span></div>
      <div className={matrix.warningCount ? 'has-warning' : ''}><strong>{matrix.warningCount}</strong>{' '}<span>alertas de planificación</span></div>
      <label><span>Comparar otros proyectos</span><strong>{fileSummary}</strong><input type="file" multiple accept=".json,.adventure.json,application/json" data-testid="research-sidecars" onChange={event => void loadSidecars(event.target.files)} /></label>
    </div>
    {fileError ? <p className="editor-catalog__empty-field is-error" role="alert">{fileError}</p> : null}
    {matrix.unknownSpeciesFacts.length ? <p className="editor-catalog__empty-field is-error" role="alert">{matrix.unknownSpeciesFacts.length} hechos apuntan a especies ausentes del catálogo local.</p> : null}
    <div className="editor-research-matrix__filters">
      <label><span>Buscar especie</span><input type="search" value={query} placeholder="Rattata o #19" onChange={event => setQuery(event.target.value)} /></label>
      <label><span>Generación</span><select value={generation} onChange={event => setGeneration(event.target.value === 'all' ? 'all' : Number(event.target.value))}><option value="all">Todas</option>{[1,2,3,4,5,6,7,8,9].map(value => <option key={value} value={value}>Gen. {value}</option>)}</select></label>
      <label><span>Cobertura</span><select value={coverage} onChange={event => setCoverage(event.target.value as typeof coverage)}><option value="all">Todas</option><option value="covered">Con contenido</option><option value="empty">Sin contenido</option></select></label>
    </div>
    <p className="editor-research-matrix__count">{rows.length} especies · mostrando {visibleRows.length}</p>
    {matrix.warningCount ? <section className="editor-research-matrix__warnings" aria-label="Alertas de planificación"><h3>Revisiones necesarias</h3><ul>{matrix.rows.flatMap(row => row.warnings.map((warning, index) => <li key={`${row.speciesId}:${warning.kind}:${index}`}>
      <strong>#{row.speciesId} · {row.displayName}</strong>
      <span>{warning.kind === 'fourRequiredPlacements'
        ? `Depende de fieldCompletion colocados en los cuatro campos: ${warning.factIds.join(', ')}.`
        : `Duplica el cierre de ${FIELD_LABELS[warning.field]}: ${warning.sourceIds.join(', ')}.`}</span>
    </li>))}</ul></section> : null}
    <div className="editor-research-matrix__scroll">
      <table>
        <thead><tr><th rowSpan={2}>Especie</th><th rowSpan={2}>Convivencia</th>{matrix.maps.map(map => <th key={map.mapId} colSpan={4} title={map.mapId}>{map.title}</th>)}</tr><tr>{matrix.maps.flatMap(map => RESEARCH_MATRIX_FIELDS.map(field => <th key={`${map.mapId}:${field}`}>{FIELD_LABELS[field]}</th>))}</tr></thead>
        <tbody>{visibleRows.map(row => <tr key={row.speciesId}>
          <th scope="row"><span>#{String(row.speciesId).padStart(4, '0')}</span><strong>{row.displayName}</strong><small>Gen. {row.generation}{row.warnings.length ? ` · ⚠ ${row.warnings.length}` : ''}</small></th>
          <td aria-label={`${row.displayName}, Convivencia`} className={row.companionResearch ? 'has-companion' : ''}>{row.companionResearch ? <span className="is-companion" title={`${row.companionResearch.factId} · ${row.companionResearch.text}`}><strong>{FIELD_LABELS[row.companionResearch.field]}</strong><small>{row.companionResearch.contentStatus} · {row.companionResearch.factId}</small></span> : <i aria-label="Sin reserva de convivencia">—</i>}</td>
          {matrix.maps.flatMap(map => RESEARCH_MATRIX_FIELDS.map(field => {
            const facts = row.factsByMap[map.mapId][field];
            return <td key={`${map.mapId}:${field}`} aria-label={`${row.displayName}, ${map.title}, ${FIELD_LABELS[field]}`} className={facts.length ? 'has-facts' : ''}>
              {facts.length ? facts.map(fact => <span key={fact.factId} className={`is-${fact.contribution}`} title={`${fact.factId} · ${fact.text}`}><strong>{CONTRIBUTION_LABELS[fact.contribution]}</strong><small>{fact.factId}</small></span>) : <i aria-label="Sin contenido">—</i>}
            </td>;
          }))}
        </tr>)}</tbody>
      </table>
    </div>
    {rows.length > visibleRows.length ? <small className="editor-research-matrix__limit">Mostrando las primeras 80 especies. Usa los filtros para acotar la matriz.</small> : null}
  </section>;
}
