import { useMemo, useState } from 'react';
import type { LoadedAdventureMapBundle } from '../../domain/maps/loadAdventureBundle.js';
import {
  auditPokeDiscoverEditorProject,
  type PokeDiscoverEditorDiagnosticCategory,
} from '../../domain/tools/pokeDiscoverEditorDiagnostics.js';
import { analyzePokeDiscoverEditorEconomy } from '../../domain/tools/pokeDiscoverEditorEconomyAnalysis.js';

const CATEGORY_LABELS: Record<PokeDiscoverEditorDiagnosticCategory, string> = {
  duplicateId: 'IDs duplicados',
  brokenReference: 'Referencias rotas',
  circularDependency: 'Dependencias circulares',
  inaccessibleObjective: 'Objetivos inaccesibles',
  missingVoiceFallback: 'Fallback de voz',
  insufficientExperience: 'Experiencia insuficiente',
  mandatoryPurchase: 'Compras obligatorias',
  invalidData: 'Contrato inválido',
};

export function ProjectDiagnosticsPanel({ bundle }: { bundle: LoadedAdventureMapBundle }) {
  const [category, setCategory] = useState<PokeDiscoverEditorDiagnosticCategory | 'all'>('all');
  const [severity, setSeverity] = useState<'error' | 'warning' | 'all'>('all');
  const diagnostics = useMemo(() => auditPokeDiscoverEditorProject(bundle), [bundle]);
  const economy = useMemo(() => analyzePokeDiscoverEditorEconomy(bundle.adventure), [bundle.adventure]);
  const visible = diagnostics.filter(item => (category === 'all' || item.category === category) && (severity === 'all' || item.severity === severity));
  const errors = diagnostics.filter(item => item.severity === 'error').length;
  const warnings = diagnostics.length - errors;

  return <section className="editor-diagnostics" aria-labelledby="editor-diagnostics-title">
    <header><div><span className="editor-eyebrow">Validación cruzada</span><h2 id="editor-diagnostics-title">Diagnóstico integral</h2></div><span className={errors ? 'has-errors' : ''}>{errors ? `${errors} errores` : 'Sin errores'}</span></header>
    <div className="editor-diagnostics__summary" role="status"><div><strong>{errors}</strong><span>errores</span></div><div><strong>{warnings}</strong><span>advertencias</span></div><div><strong>{diagnostics.length}</strong><span>incidencias totales</span></div></div>
    <div className="editor-diagnostics__economy" aria-label="Balance económico declarado"><div><strong>{economy.trainerExperience}</strong><span>EXP declarada</span></div><div><strong>{economy.reachableTrainerLevel}</strong><span>nivel alcanzable</span></div><div><strong>{economy.discoveryPoints}</strong><span>PD declarados</span></div><div><strong>{economy.mandatoryPurchaseCost}</strong><span>PD obligatorios</span></div></div>
    <div className="editor-diagnostics__filters">
      <label><span>Categoría</span><select value={category} onChange={event => setCategory(event.target.value as typeof category)}><option value="all">Todas</option>{Object.entries(CATEGORY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label><span>Severidad</span><select value={severity} onChange={event => setSeverity(event.target.value as typeof severity)}><option value="all">Todas</option><option value="error">Errores</option><option value="warning">Advertencias</option></select></label>
    </div>
    {visible.length ? <ul className="editor-diagnostics__list">{visible.map(item => <li key={item.diagnosticId} className={`is-${item.severity}`} data-category={item.category}>
      <div><span>{CATEGORY_LABELS[item.category]}</span><b>{item.severity === 'error' ? 'Error' : 'Advertencia'}</b></div>
      <strong>{item.sourceId}</strong>
      <p>{item.message}</p>
    </li>)}</ul> : <div className="editor-diagnostics__clean"><span aria-hidden="true">✓</span><div><strong>{diagnostics.length ? 'Nada en este filtro' : 'Proyecto coherente'}</strong><p>{diagnostics.length ? 'Cambia los filtros para revisar otras incidencias.' : 'No se han detectado problemas estructurales ni lógicos.'}</p></div></div>}
  </section>;
}
