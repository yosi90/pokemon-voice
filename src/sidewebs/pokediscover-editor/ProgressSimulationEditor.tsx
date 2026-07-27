import { useMemo, useState } from 'react';
import type { AdventureMapV3, ExpressionInputMethod, JsonValue, RequirementAtomV1 } from '../../../packages/contracts/src/index.js';
import { POKE_DISCOVER_FIELD_TOOLS } from '../../data/adventure/pokeDiscoverShop.js';
import { POKEDISCOVER_EDITOR_CATALOG } from '../../domain/tools/pokeDiscoverEditorCatalog.js';
import {
  simulatePokeDiscoverEditorRequirements,
  type PokeDiscoverEditorSimulationConfig,
} from '../../domain/tools/pokeDiscoverEditorSimulation.js';

function integerList(value: string) {
  return [...new Set(value.split(',').map(item => Number(item.trim())).filter(item => Number.isSafeInteger(item) && item > 0))];
}

function stringList(value: string) {
  return [...new Set(value.split(',').map(item => item.trim()).filter(Boolean))];
}

function parseFlags(value: string): Record<string, JsonValue> {
  const flags: Record<string, JsonValue> = {};
  for (const item of value.split(',').map(candidate => candidate.trim()).filter(Boolean)) {
    const separator = item.indexOf('=');
    if (separator < 0) continue;
    const key = item.slice(0, separator).trim();
    const raw = item.slice(separator + 1).trim();
    if (!key) continue;
    if (raw === 'true' || raw === 'false') flags[key] = raw === 'true';
    else if (raw === 'null') flags[key] = null;
    else if (raw !== '' && Number.isFinite(Number(raw))) flags[key] = Number(raw);
    else flags[key] = raw;
  }
  return flags;
}

function atomSummary(atom: RequirementAtomV1) {
  const details = Object.entries(atom)
    .filter(([key]) => key !== 'kind')
    .map(([key, value]) => `${key}=${String(value)}`)
    .join(' · ');
  return `${atom.kind}${details ? ` · ${details}` : ''}`;
}

const INITIAL_CONFIG: PokeDiscoverEditorSimulationConfig = {
  trainerLevel: 1,
  registeredSpeciesIds: [],
  sightedSpeciesIds: [],
  inventoryItemIds: [],
  worldFlags: {},
  inputMethod: 'text',
};

export function ProgressSimulationEditor({ adventure }: { adventure: AdventureMapV3 }) {
  const [config, setConfig] = useState(INITIAL_CONFIG);
  const [filter, setFilter] = useState<'all' | 'available' | 'blocked'>('all');
  const [registeredText, setRegisteredText] = useState('');
  const [sightedText, setSightedText] = useState('');
  const [itemsText, setItemsText] = useState('');
  const [flagsText, setFlagsText] = useState('');
  const results = useMemo(() => simulatePokeDiscoverEditorRequirements(adventure, config), [adventure, config]);
  const visibleResults = results.filter(result => filter === 'all' || (filter === 'available' ? result.available : !result.available));
  const availableCount = results.filter(result => result.available).length;

  return <section className="editor-simulation" aria-labelledby="editor-simulation-title">
    <header><div><span className="editor-eyebrow">Partida efímera</span><h2 id="editor-simulation-title">Simulador de progreso</h2></div><span>Sin persistencia</span></header>
    <div className="editor-simulation__layout">
      <form className="editor-simulation__form" onSubmit={event => event.preventDefault()}>
        <label><span>Nivel de entrenador</span><input type="number" min="1" value={config.trainerLevel} onChange={event => setConfig(current => ({ ...current, trainerLevel: Math.max(1, Math.round(Number(event.target.value) || 1)) }))} /></label>
        <label><span>Especies registradas (# separadas por comas)</span><input value={registeredText} placeholder="19, 25, 130" onChange={event => { setRegisteredText(event.target.value); setConfig(current => ({ ...current, registeredSpeciesIds: integerList(event.target.value) })); }} /></label>
        <label><span>Especies avistadas (# separadas por comas)</span><input value={sightedText} placeholder="151, 251" onChange={event => { setSightedText(event.target.value); setConfig(current => ({ ...current, sightedSpeciesIds: integerList(event.target.value) })); }} /></label>
        <label><span>Compañero</span><select value={config.companionVariantId ?? ''} onChange={event => setConfig(current => ({ ...current, companionVariantId: event.target.value || undefined }))}>
          <option value="">Sin compañero</option>{POKEDISCOVER_EDITOR_CATALOG.map(entry => <option key={entry.variantId} value={entry.variantId}>#{entry.species.speciesId} · {entry.displayName}</option>)}
        </select></label>
        <label><span>Herramienta</span><select value={config.toolId ?? ''} disabled={!config.companionVariantId} onChange={event => setConfig(current => ({ ...current, toolId: event.target.value || undefined }))}>
          <option value="">Sin herramienta</option>{POKE_DISCOVER_FIELD_TOOLS.map(tool => <option key={tool.toolId} value={tool.toolId}>{tool.displayName}</option>)}
        </select></label>
        <label><span>Objetos del inventario (IDs)</span><input value={itemsText} placeholder="key-item:dragon-scale" onChange={event => { setItemsText(event.target.value); setConfig(current => ({ ...current, inventoryItemIds: stringList(event.target.value) })); }} /></label>
        <label><span>Flags del mundo (id=valor)</span><input value={flagsText} placeholder="night=true, trust=2" onChange={event => { setFlagsText(event.target.value); setConfig(current => ({ ...current, worldFlags: parseFlags(event.target.value) })); }} /></label>
        <label><span>Método de entrada</span><select value={config.inputMethod} onChange={event => setConfig(current => ({ ...current, inputMethod: event.target.value as ExpressionInputMethod }))}><option value="voice">Voz</option><option value="text">Texto</option><option value="contextAction">Acción contextual</option></select></label>
      </form>
      <div className="editor-simulation__results">
        <div className="editor-simulation__summary"><strong>{availableCount}/{results.length}</strong><span>definiciones disponibles</span><div role="group" aria-label="Filtrar simulación">{(['all','available','blocked'] as const).map(value => <button type="button" key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{value === 'all' ? 'Todas' : value === 'available' ? 'Disponibles' : 'Bloqueadas'}</button>)}</div></div>
        <ul>{visibleResults.map(result => <li key={result.targetKey} className={result.available ? 'is-available' : 'is-blocked'}>
          <div><span>{result.target.source}</span><strong>{result.target.label}</strong></div>
          <b>{result.available ? 'Disponible' : !result.requirementMet ? 'Requisito pendiente' : 'Método no admitido'}</b>
          {!result.methodAvailable ? <small>El trigger no admite {config.inputMethod}.</small> : null}
          {result.unmetAtoms.length ? <ul aria-label={`Condiciones pendientes de ${result.target.label}`}>{result.unmetAtoms.map((atom, index) => <li key={`${atom.kind}:${index}`}>{atomSummary(atom)}</li>)}</ul> : null}
        </li>)}</ul>
        {!visibleResults.length ? <p className="editor-catalog__empty-field">No hay definiciones en este filtro.</p> : null}
      </div>
    </div>
  </section>;
}
