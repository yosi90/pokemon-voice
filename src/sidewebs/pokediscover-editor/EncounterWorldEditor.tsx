import { useMemo, useState } from 'react';
import type { AdventureMapV3, RareEncounterDefinitionV1 } from '../../../packages/contracts/src/index.js';
import type { LoadedAdventureMapBundle, LoadedAdventureSectorBundle } from '../../domain/maps/loadAdventureBundle.js';
import { nextStableEditorId } from '../../domain/tools/pokeDiscoverEditorBeats.js';
import { POKEDISCOVER_EDITOR_CATALOG } from '../../domain/tools/pokeDiscoverEditorCatalog.js';
import {
  rareEncounterProbabilityForVisit,
  updateEditorDeterministicEncounter,
  upsertEditorMapVariant,
  upsertEditorRareEncounter,
  upsertEditorWorldEvent,
} from '../../domain/tools/pokeDiscoverEditorEncounters.js';
import { readPokeDiscoverEditorAnchors } from '../../domain/tools/pokeDiscoverEditorTiledReferences.js';

type Tab = 'deterministic' | 'rare' | 'variant' | 'event';
const DEFAULT_REQUIREMENT = { kind: 'trainerLevel', minimum: 1 } as const;

function commaList(value: string) {
  return value.split(',').map(item => item.trim()).filter(Boolean);
}

function targetList(value: string) {
  return value.split(',').map(item => item.trim()).filter(Boolean).flatMap(item => {
    const separator = item.indexOf('>');
    return separator < 0 ? [] : [{ mapId: item.slice(0, separator).trim(), id: item.slice(separator + 1).trim() }];
  }).filter(item => item.mapId && item.id);
}

function formatTargets(items: Array<{ mapId: string; id: string }>) {
  return items.map(item => `${item.mapId} > ${item.id}`).join(', ');
}

function parseFlags(value: string): Record<string, string | number | boolean> {
  const flags: Record<string, string | number | boolean> = {};
  for (const item of value.split(',').map(candidate => candidate.trim()).filter(Boolean)) {
    const separator = item.indexOf('=');
    if (separator < 0) continue;
    const key = item.slice(0, separator).trim();
    const raw = item.slice(separator + 1).trim();
    if (!key) continue;
    if (raw === 'true' || raw === 'false') {
      flags[key] = raw === 'true';
      continue;
    }
    const numericValue = Number(raw);
    flags[key] = raw !== '' && Number.isFinite(numericValue) ? numericValue : raw;
  }
  return flags;
}

export function EncounterWorldEditor({ bundle, room, onAdventureChange }: {
  bundle: LoadedAdventureMapBundle;
  room: LoadedAdventureSectorBundle;
  onAdventureChange: (adventure: AdventureMapV3) => void;
}) {
  const adventure = bundle.adventure;
  const [tab, setTab] = useState<Tab>('deterministic');
  const [placementId, setPlacementId] = useState('');
  const [rareId, setRareId] = useState('');
  const [variantId, setVariantId] = useState('');
  const [eventId, setEventId] = useState('');
  const anchors = useMemo(() => readPokeDiscoverEditorAnchors(room.tilemap)
    .filter(anchor => ['ActorAnchor', 'EncounterAnchor'].includes(anchor.anchorClass)), [room.tilemap]);
  const placements = adventure.actorPlacements.filter(item => item.sectorId === room.sector.sectorId);
  const placement = placements.find(item => item.placementId === placementId) ?? placements[0];
  const placementAsset = bundle.pmdManifest.assets.find(item => item.assetId === placement?.assetId);
  const rare = adventure.rareEncounters.find(item => item.encounterId === rareId) ?? adventure.rareEncounters[0];
  const variant = adventure.variants.find(item => item.variantId === variantId) ?? adventure.variants[0];
  const events = adventure.worldEvents ?? [];
  const worldEvent = events.find(item => item.eventId === eventId) ?? events[0];

  const createRare = () => {
    const entry = POKEDISCOVER_EDITOR_CATALOG[0];
    if (!entry) return;
    const encounterId = nextStableEditorId(`encounter:${adventure.mapId.split(':').at(-1)}:rare`, adventure.rareEncounters.map(item => item.encounterId));
    const definition: RareEncounterDefinitionV1 = {
      encounterId,
      speciesId: entry.species.speciesId,
      formId: entry.form.formId,
      ...(entry.appearance ? { appearanceId: entry.appearance.appearanceId } : {}),
      requirement: DEFAULT_REQUIREMENT,
      baseProbability: .15,
      guaranteedEligibleVisit: 3,
    };
    onAdventureChange(upsertEditorRareEncounter(adventure, definition));
    setRareId(encounterId);
  };
  const duplicateRare = () => {
    if (!rare) return;
    const encounterId = nextStableEditorId(
      `encounter:${adventure.mapId.split(':').at(-1)}:rare`,
      adventure.rareEncounters.map(item => item.encounterId),
    );
    onAdventureChange(upsertEditorRareEncounter(adventure, {
      ...structuredClone(rare),
      encounterId,
    }));
    setRareId(encounterId);
  };
  const createVariant = () => {
    const id = nextStableEditorId(`variant:${adventure.mapId.split(':').at(-1)}`, adventure.variants.map(item => item.variantId));
    onAdventureChange(upsertEditorMapVariant(adventure, { variantId: id, requirement: DEFAULT_REQUIREMENT }));
    setVariantId(id);
  };
  const duplicateVariant = () => {
    if (!variant) return;
    const variantId = nextStableEditorId(
      `variant:${adventure.mapId.split(':').at(-1)}`,
      adventure.variants.map(item => item.variantId),
    );
    onAdventureChange(upsertEditorMapVariant(adventure, {
      ...structuredClone(variant),
      variantId,
    }));
    setVariantId(variantId);
  };
  const createEvent = () => {
    const id = nextStableEditorId(`event:${adventure.mapId.split(':').at(-1)}`, events.map(item => item.eventId));
    onAdventureChange(upsertEditorWorldEvent(adventure, { schemaVersion: 1, eventId: id, activation: DEFAULT_REQUIREMENT, setFlags: {}, encounterInjections: [], mapVariants: [] }));
    setEventId(id);
  };
  const duplicateEvent = () => {
    if (!worldEvent) return;
    const eventId = nextStableEditorId(
      `event:${adventure.mapId.split(':').at(-1)}`,
      events.map(item => item.eventId),
    );
    onAdventureChange(upsertEditorWorldEvent(adventure, {
      ...structuredClone(worldEvent),
      eventId,
    }));
    setEventId(eventId);
  };

  return <section className="editor-encounters" aria-labelledby="editor-encounters-title">
    <header><div><span className="editor-eyebrow">Estado del mundo</span><h2 id="editor-encounters-title">Encuentros, variantes y eventos</h2></div><span>{placements.length + adventure.rareEncounters.length} encuentros</span></header>
    <div className="editor-encounters__tabs" role="tablist" aria-label="Configuración del mundo">
      <button type="button" role="tab" aria-selected={tab === 'deterministic'} onClick={() => setTab('deterministic')}>Deterministas</button>
      <button type="button" role="tab" aria-selected={tab === 'rare'} onClick={() => setTab('rare')}>Raros</button>
      <button type="button" role="tab" aria-selected={tab === 'variant'} onClick={() => setTab('variant')}>Variantes</button>
      <button type="button" role="tab" aria-selected={tab === 'event'} onClick={() => setTab('event')}>Eventos globales</button>
    </div>

    {tab === 'deterministic' ? <div className="editor-encounters__panel">
      {placement ? <div className="editor-encounters__grid">
        <label><span>Encuentro fijo</span><select value={placement.placementId} onChange={event => setPlacementId(event.target.value)}>{placements.map(item => <option key={item.placementId}>{item.placementId}</option>)}</select></label>
        <label><span>Anclaje</span><code>{placement.anchorId}</code></label>
        <label><span>Pokémon y forma</span><select value={placement.assetId} onChange={event => { const asset = bundle.pmdManifest.assets.find(item => item.assetId === event.target.value); if (asset) onAdventureChange(updateEditorDeterministicEncounter(adventure, { ...placement, assetId: asset.assetId, animation: asset.animations.find(item => item.name === 'Idle')?.name ?? asset.animations[0]?.name ?? 'Idle' })); }}>{bundle.pmdManifest.assets.filter(asset => room.sector.roster.pokemonAssetIds.includes(asset.assetId)).map(asset => <option key={asset.assetId} value={asset.assetId}>#{String(asset.speciesId).padStart(4, '0')} · {asset.formId.split(':').at(-1)}</option>)}</select></label>
        <label><span>Animación</span><select value={placement.animation} onChange={event => onAdventureChange(updateEditorDeterministicEncounter(adventure, { ...placement, animation: event.target.value }))}>{placementAsset?.animations.map(animation => <option key={animation.name}>{animation.name}</option>)}</select></label>
        <label><span>Dirección</span><select value={placement.direction ?? 'down'} onChange={event => onAdventureChange(updateEditorDeterministicEncounter(adventure, { ...placement, direction: event.target.value as NonNullable<typeof placement.direction> }))}>{['down','left','right','up'].map(direction => <option key={direction}>{direction}</option>)}</select></label>
        <label><span>Colisión</span><select value={placement.collision ?? 'solid'} onChange={event => onAdventureChange(updateEditorDeterministicEncounter(adventure, { ...placement, collision: event.target.value as NonNullable<typeof placement.collision> }))}><option value="solid">Sólido</option><option value="pass-through">Atravesable</option></select></label>
        <label className="editor-encounters__check"><input type="checkbox" checked={placement.initiallyHidden ?? false} onChange={event => onAdventureChange(updateEditorDeterministicEncounter(adventure, { ...placement, initiallyHidden: event.target.checked }))} /><span>Oculto al entrar</span></label>
      </div> : <p className="editor-catalog__empty-field">No hay encuentros fijos en esta sector.</p>}
    </div> : null}

    {tab === 'rare' ? <div className="editor-encounters__panel">
      <div className="editor-encounters__selector"><label><span>Encuentro raro</span><select value={rare?.encounterId ?? ''} disabled={!rare} onChange={event => setRareId(event.target.value)}>{adventure.rareEncounters.map(item => <option key={item.encounterId}>{item.encounterId}</option>)}</select></label><button type="button" onClick={createRare}>Añadir raro</button><button type="button" disabled={!rare} onClick={duplicateRare}>Duplicar</button></div>
      {rare ? <div className="editor-encounters__grid">
        <label><span>Pokémon / forma</span><select value={rare.appearanceId ?? rare.formId ?? ''} onChange={event => { const entry = POKEDISCOVER_EDITOR_CATALOG.find(item => item.variantId === event.target.value); if (entry) onAdventureChange(upsertEditorRareEncounter(adventure, { ...rare, speciesId: entry.species.speciesId, formId: entry.form.formId, ...(entry.appearance ? { appearanceId: entry.appearance.appearanceId } : { appearanceId: undefined }) })); }}>{POKEDISCOVER_EDITOR_CATALOG.map(entry => <option key={entry.variantId} value={entry.variantId}>#{entry.species.speciesId} · {entry.displayName}</option>)}</select></label>
        <label><span>Probabilidad base (%)</span><input type="number" min="1" max="99" value={Math.round(rare.baseProbability * 100)} onChange={event => onAdventureChange(upsertEditorRareEncounter(adventure, { ...rare, baseProbability: Math.min(.99, Math.max(.01, (Number(event.target.value) || 1) / 100)) }))} /></label>
        <label><span>Visita garantizada</span><input type="number" min="1" value={rare.guaranteedEligibleVisit ?? 3} onChange={event => onAdventureChange(upsertEditorRareEncounter(adventure, { ...rare, guaranteedEligibleVisit: Math.max(1, Math.round(Number(event.target.value) || 1)) }))} /></label>
        <div className="editor-encounters__odds"><span>Progresión por visita elegible</span><ol>{Array.from({ length: rare.guaranteedEligibleVisit ?? 3 }, (_, index) => <li key={index}>Visita {index + 1}: <strong>{Math.round(rareEncounterProbabilityForVisit(rare, index + 1) * 100)}%</strong></li>)}</ol></div>
      </div> : <p className="editor-catalog__empty-field">Añade el primer encuentro raro.</p>}
    </div> : null}

    {tab === 'variant' ? <div className="editor-encounters__panel">
      <div className="editor-encounters__selector"><label><span>Variante del mapa</span><select value={variant?.variantId ?? ''} disabled={!variant} onChange={event => setVariantId(event.target.value)}>{adventure.variants.map(item => <option key={item.variantId}>{item.variantId}</option>)}</select></label><button type="button" onClick={createVariant}>Añadir variante</button><button type="button" disabled={!variant} onClick={duplicateVariant}>Duplicar</button></div>
      {variant ? <div className="editor-encounters__grid">
        <label><span>Objetos habilitados</span><input value={(variant.enabledObjectIds ?? []).join(', ')} onChange={event => onAdventureChange(upsertEditorMapVariant(adventure, { ...variant, enabledObjectIds: commaList(event.target.value) }))} /></label>
        <label><span>Objetos deshabilitados</span><input value={(variant.disabledObjectIds ?? []).join(', ')} onChange={event => onAdventureChange(upsertEditorMapVariant(adventure, { ...variant, disabledObjectIds: commaList(event.target.value) }))} /></label>
        <label><span>Pista de audio</span><input value={variant.audioTrackId ?? ''} onChange={event => onAdventureChange(upsertEditorMapVariant(adventure, { ...variant, audioTrackId: event.target.value || undefined }))} /></label>
        <label><span>Efectos visuales</span><input value={(variant.visualEffectIds ?? []).join(', ')} onChange={event => onAdventureChange(upsertEditorMapVariant(adventure, { ...variant, visualEffectIds: commaList(event.target.value) }))} /></label>
      </div> : <p className="editor-catalog__empty-field">Añade la primera variante.</p>}
    </div> : null}

    {tab === 'event' ? <div className="editor-encounters__panel">
      <div className="editor-encounters__selector"><label><span>Evento global</span><select value={worldEvent?.eventId ?? ''} disabled={!worldEvent} onChange={event => setEventId(event.target.value)}>{events.map(item => <option key={item.eventId}>{item.eventId}</option>)}</select></label><button type="button" onClick={createEvent}>Añadir evento</button><button type="button" disabled={!worldEvent} onClick={duplicateEvent}>Duplicar</button></div>
      {worldEvent ? <div className="editor-encounters__grid">
        <label className="is-wide"><span>Flags (id=valor)</span><input value={Object.entries(worldEvent.setFlags).map(([key, value]) => `${key}=${String(value)}`).join(', ')} onChange={event => onAdventureChange(upsertEditorWorldEvent(adventure, { ...worldEvent, setFlags: parseFlags(event.target.value) }))} /></label>
        <label><span>Inyectar encuentros (mapa &gt; encuentro)</span><input value={formatTargets(worldEvent.encounterInjections.map(item => ({ mapId: item.mapId, id: item.encounterId })))} onChange={event => onAdventureChange(upsertEditorWorldEvent(adventure, { ...worldEvent, encounterInjections: targetList(event.target.value).map(item => ({ mapId: item.mapId, encounterId: item.id })) }))} /></label>
        <label><span>Activar variantes (mapa &gt; variante)</span><input value={formatTargets(worldEvent.mapVariants.map(item => ({ mapId: item.mapId, id: item.variantId })))} onChange={event => onAdventureChange(upsertEditorWorldEvent(adventure, { ...worldEvent, mapVariants: targetList(event.target.value).map(item => ({ mapId: item.mapId, variantId: item.id })) }))} /></label>
        <p className="editor-encounters__hint is-wide">La condición de activación se edita en el bloque visual de requisitos.</p>
      </div> : <p className="editor-catalog__empty-field">Añade el primer evento global.</p>}
    </div> : null}
  </section>;
}
