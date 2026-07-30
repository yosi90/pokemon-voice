import { useMemo, useState } from 'react';
import type {
  AdventureMapV3,
  CompanionSequenceV3,
  HazardConsequenceV1,
  MapSequenceActionKind,
  MapSequenceActionV1,
  MapSequenceV3,
  RequirementExpressionV1,
} from '../../../packages/contracts/src/index.js';
import {
  COMPANION_SEQUENCE_ACTION_KINDS,
  MAP_SEQUENCE_ACTION_KINDS,
} from '../../../packages/contracts/src/index.js';
import type {
  LoadedAdventureMapBundle,
  LoadedAdventureSectorBundle,
} from '../../domain/maps/loadAdventureBundle.js';
import {
  createPokeDiscoverEventRecipe,
  POKEDISCOVER_EVENT_RECIPES,
  type PokeDiscoverEventRecipeKind,
} from '../../domain/tools/pokeDiscoverEventRecipes.js';
import {
  listPokeDiscoverLocations,
} from '../../domain/tools/pokeDiscoverEditorTerrain.js';
import type { PokeDiscoverEditableTiledMap } from '../../domain/tools/pokeDiscoverEditorProject.js';
import { AmbientBeatEditor } from './AmbientBeatEditor.js';
import { RequirementExpressionEditor } from './RequirementEditor.js';

const ACTION_LABELS: Record<MapSequenceActionKind, string> = {
  playAnimation: 'Reproducir animación',
  face: 'Orientar actor',
  setVisible: 'Mostrar u ocultar',
  moveToAnchor: 'Mover a ancla',
  moveByTiles: 'Mover por casillas',
  returnToTrainer: 'Volver junto al entrenador',
  dropPokeBalls: 'Soltar Poké Balls',
  emitCue: 'Emitir señal narrativa',
  movePath: 'Recorrer ruta',
  spawnProjectile: 'Disparar proyectil',
  charge: 'Cargar hacia objetivo',
  push: 'Empujar',
  playAudio: 'Reproducir audio',
  stopAudio: 'Detener audio',
  setPlayerAppearance: 'Cambiar apariencia',
  restorePlayerAppearance: 'Restaurar apariencia',
  moveToLocation: 'Trasladar a lugar',
  applyHazardConsequence: 'Desmayo y consecuencia',
  openNarrative: 'Abrir secuencia narrativa',
  emitMissionOutcome: 'Emitir resultado de misión',
};

const EVENT_ACTION_KINDS = MAP_SEQUENCE_ACTION_KINDS.filter(kind => (
  !['returnToTrainer', 'dropPokeBalls', 'emitCue'].includes(kind)
));

type EditableSequenceFamily = 'map' | 'ambient' | 'companion';

function defaultConsequence(
  outcome: HazardConsequenceV1['outcome'],
  rollbackPolicy: HazardConsequenceV1['rollbackPolicy'],
): HazardConsequenceV1 {
  return {
    schemaVersion: 1,
    outcome,
    rollbackPolicy,
    destination: outcome === 'recover'
      ? { kind: 'nearestSafeSurface' }
      : { kind: 'sectorEntry' },
    fadeOutMs: 320,
    fadeInMs: 320,
    invulnerabilityMs: 900,
  };
}

function actorsInRoom(bundle: LoadedAdventureMapBundle, sectorId: string) {
  return [
    ...bundle.adventure.actorPlacements,
    ...bundle.adventure.characterPlacements.filter(item => !item.controllable),
  ].filter(item => item.sectorId === sectorId);
}

function pathsInMap(tilemap: PokeDiscoverEditableTiledMap) {
  const layer = tilemap.layers.find(candidate => candidate.name === 'Paths');
  return (Array.isArray(layer?.objects) ? layer.objects : [])
    .map(object => String(object.name ?? '')).filter(Boolean);
}

function fallAreasInMap(tilemap: PokeDiscoverEditableTiledMap) {
  const layer = tilemap.layers.find(candidate => candidate.name === 'Terrain');
  return (Array.isArray(layer?.objects) ? layer.objects : []).filter(object => (
    (object.properties ?? []).some((property: Record<string, unknown>) => (
      property.name === 'surfaceType' && property.value === 'fall'
    ))
  )).map(object => String(object.name ?? '')).filter(Boolean);
}

function defaultAction(
  kind: MapSequenceActionKind,
  actorId: string,
  secondaryActorId: string,
  effectId: string,
  audioId: string,
  appearanceId: string,
  locationId: string,
): MapSequenceActionV1 {
  switch (kind) {
    case 'playAnimation': return { kind, actorRef: actorId, animation: 'Idle', repetitions: 1 };
    case 'face': return { kind, actorRef: actorId, direction: 'down' };
    case 'setVisible': return { kind, actorRef: actorId, visible: true };
    case 'moveToAnchor': return { kind, actorRef: actorId, anchorId: 'anchor:id', speedPixelsPerSecond: 96 };
    case 'moveByTiles': return { kind, actorRef: actorId, direction: 'down', tiles: 1, speedPixelsPerSecond: 96 };
    case 'returnToTrainer': return { kind, actorRef: 'dynamic:companion', speedPixelsPerSecond: 96 };
    case 'dropPokeBalls': return { kind, actorRef: actorId, count: 1 };
    case 'emitCue': return { kind, actorRef: actorId, cueId: 'cue:id' };
    case 'movePath': return { kind, actorRef: actorId, pathId: 'path:id', movementStyle: 'grid', speedPixelsPerSecond: 96 };
    case 'spawnProjectile': return {
      kind,
      actorRef: actorId,
      effectAssetId: effectId || 'effect:seleccionar',
      direction: 'towardsPlayer',
      speedPixelsPerSecond: 96,
      lifetimeMs: 3_000,
      collisionMask: ['terrain', 'player'],
    };
    case 'charge': return {
      kind,
      actorRef: actorId,
      targetRef: secondaryActorId || 'dynamic:player',
      speedPixelsPerSecond: 192,
      maximumTiles: 12,
      cooldownMs: 1_000,
    };
    case 'push': return {
      kind,
      actorRef: 'dynamic:player',
      sourceRef: actorId,
      direction: 'sourceToTarget',
      tiles: 1,
    };
    case 'playAudio': return { kind, audioAssetId: audioId || 'audio:seleccionar', channel: 'effect', volume: 1 };
    case 'stopAudio': return { kind, channel: 'all', fadeOutMs: 150 };
    case 'setPlayerAppearance': return { kind, appearanceId: appearanceId || 'appearance:seleccionar' };
    case 'restorePlayerAppearance': return { kind };
    case 'moveToLocation': return { kind, actorRef: 'dynamic:player', locationId: locationId || 'location:seleccionar', fadeMs: 140 };
    case 'applyHazardConsequence': return { kind, consequence: defaultConsequence('recover', 'preserveGains') };
    case 'openNarrative': return { kind, sequenceId: 'narrative:seleccionar' };
    case 'emitMissionOutcome': return { kind, outcomeId: 'mission-outcome:completed' };
  }
}

function describeAction(action: MapSequenceActionV1) {
  if ('actorRef' in action) return `${ACTION_LABELS[action.kind]} · ${action.actorRef}`;
  if (action.kind === 'playAudio') return `${ACTION_LABELS[action.kind]} · ${action.audioAssetId}`;
  if (action.kind === 'openNarrative') return `${ACTION_LABELS[action.kind]} · ${action.sequenceId}`;
  if (action.kind === 'emitMissionOutcome') return `${ACTION_LABELS[action.kind]} · ${action.outcomeId}`;
  if (action.kind === 'setPlayerAppearance') return `${ACTION_LABELS[action.kind]} · ${action.appearanceId}`;
  if (action.kind === 'applyHazardConsequence') return `${ACTION_LABELS[action.kind]} · ${action.consequence.outcome}`;
  return ACTION_LABELS[action.kind];
}

function ConsequenceFields({
  value,
  locations,
  onChange,
}: {
  value: HazardConsequenceV1;
  locations: ReturnType<typeof listPokeDiscoverLocations>;
  onChange: (value: HazardConsequenceV1) => void;
}) {
  const destinationKind = value.destination.kind;
  return <fieldset>
    <legend>Consecuencia del peligro</legend>
    <label><span>Castigo</span><select value={value.outcome} onChange={event => onChange({
      ...defaultConsequence(event.target.value as HazardConsequenceV1['outcome'], value.rollbackPolicy),
      failureNarrativeSequenceId: value.failureNarrativeSequenceId,
    })}>
      <option value="recover">Recuperarse sin perder progreso</option>
      <option value="resetSector">Reiniciar el sector</option>
      <option value="failMission">Fracasar la misión</option>
    </select></label>
    <label><span>Progreso</span><select value={value.rollbackPolicy} onChange={event => onChange({
      ...value,
      rollbackPolicy: event.target.value as HazardConsequenceV1['rollbackPolicy'],
    })}>
      <option value="preserveGains">Conservar lo obtenido</option>
      <option value="restoreSnapshot">Restaurar la instantánea</option>
    </select></label>
    <label><span>Destino</span><select value={destinationKind} onChange={event => {
      const kind = event.target.value as HazardConsequenceV1['destination']['kind'];
      onChange({
        ...value,
        destination: kind === 'nearestSafeSurface'
          ? { kind }
          : kind === 'location'
            ? { kind, locationId: locations[0]?.definition.locationId ?? 'location:seleccionar' }
            : { kind },
      });
    }}>
      <option value="nearestSafeSurface">Tierra segura más cercana</option>
      <option value="location">Lugar explícito</option>
      <option value="sectorEntry">Entrada del sector</option>
    </select></label>
    {value.destination.kind === 'location' ? <label><span>Lugar</span><select
      value={value.destination.locationId}
      onChange={event => onChange({
        ...value,
        destination: { kind: 'location', locationId: event.target.value },
      })}
    >
      {locations.map(location => <option key={location.definition.locationId} value={location.definition.locationId}>
        {location.definition.label}
      </option>)}
    </select></label> : null}
    {value.outcome === 'failMission' ? <label><span>Diálogo de fracaso opcional</span><input
      value={value.failureNarrativeSequenceId ?? ''}
      placeholder="narrative:..."
      onChange={event => onChange({
        ...value,
        failureNarrativeSequenceId: event.target.value.trim() || undefined,
      })}
    /></label> : null}
  </fieldset>;
}

function ActionFields({
  action,
  actorIds,
  effects,
  audios,
  appearances,
  locations,
  paths,
  onChange,
}: {
  action: MapSequenceActionV1;
  actorIds: string[];
  effects: string[];
  audios: string[];
  appearances: string[];
  locations: ReturnType<typeof listPokeDiscoverLocations>;
  paths: string[];
  onChange: (action: MapSequenceActionV1) => void;
}) {
  const actorOptions = ['dynamic:player', 'dynamic:companion', ...actorIds];
  const actorSelect = 'actorRef' in action ? <label><span>Actor</span><select
    value={action.actorRef}
    onChange={event => onChange({ ...action, actorRef: event.target.value } as MapSequenceActionV1)}
  >{actorOptions.map(id => <option key={id}>{id}</option>)}</select></label> : null;
  if (action.kind === 'spawnProjectile') return <fieldset><legend>Proyectil</legend>
    {actorSelect}
    <label><span>Efecto</span><select value={action.effectAssetId} onChange={event => onChange({ ...action, effectAssetId: event.target.value })}>
      {effects.map(id => <option key={id}>{id}</option>)}
    </select></label>
    <label><span>Dirección</span><select value={action.direction} onChange={event => onChange({ ...action, direction: event.target.value as typeof action.direction })}>
      <option value="towardsPlayer">Hacia el jugador</option><option value="actorFacing">Orientación del actor</option>
      <option value="up">Arriba</option><option value="down">Abajo</option><option value="left">Izquierda</option><option value="right">Derecha</option>
    </select></label>
    <label><span>Velocidad</span><input type="number" min="1" value={action.speedPixelsPerSecond} onChange={event => onChange({ ...action, speedPixelsPerSecond: Math.max(1, Number(event.target.value) || 1) })} /></label>
    <label><span>Vida útil (ms)</span><input type="number" min="1" value={action.lifetimeMs} onChange={event => onChange({ ...action, lifetimeMs: Math.max(1, Number(event.target.value) || 1) })} /></label>
    <label><span>Guion al impactar</span><input value={action.hitSequenceId ?? ''} onChange={event => onChange({ ...action, hitSequenceId: event.target.value.trim() || undefined })} /></label>
    <label><span>Guion al fallar</span><input value={action.missSequenceId ?? ''} onChange={event => onChange({ ...action, missSequenceId: event.target.value.trim() || undefined })} /></label>
    <ConsequenceFields value={action.consequence ?? defaultConsequence('recover', 'preserveGains')} locations={locations} onChange={consequence => onChange({ ...action, consequence })} />
  </fieldset>;
  if (action.kind === 'charge') return <fieldset><legend>Carga</legend>
    {actorSelect}
    <label><span>Objetivo fijado</span><select value={action.targetRef} onChange={event => onChange({ ...action, targetRef: event.target.value })}>
      {actorOptions.map(id => <option key={id}>{id}</option>)}
    </select></label>
    <label><span>Velocidad</span><input type="number" min="1" value={action.speedPixelsPerSecond} onChange={event => onChange({ ...action, speedPixelsPerSecond: Math.max(1, Number(event.target.value) || 1) })} /></label>
    <label><span>Máximo (tiles)</span><input type="number" min="1" value={action.maximumTiles ?? 12} onChange={event => onChange({ ...action, maximumTiles: Math.max(1, Number(event.target.value) || 1) })} /></label>
    <label><span>Cooldown (ms)</span><input type="number" min="0" value={action.cooldownMs ?? 0} onChange={event => onChange({ ...action, cooldownMs: Math.max(0, Number(event.target.value) || 0) })} /></label>
    <label><span>Guion al impactar</span><input value={action.hitSequenceId ?? ''} onChange={event => onChange({ ...action, hitSequenceId: event.target.value.trim() || undefined })} /></label>
    <label><span>Guion al fallar</span><input value={action.missSequenceId ?? ''} onChange={event => onChange({ ...action, missSequenceId: event.target.value.trim() || undefined })} /></label>
    <ConsequenceFields value={action.consequence ?? defaultConsequence('recover', 'preserveGains')} locations={locations} onChange={consequence => onChange({ ...action, consequence })} />
  </fieldset>;
  if (action.kind === 'applyHazardConsequence') {
    return <ConsequenceFields value={action.consequence} locations={locations} onChange={consequence => onChange({ ...action, consequence })} />;
  }
  if (action.kind === 'push') return <fieldset><legend>Empujón</legend>
    {actorSelect}
    <label><span>Origen</span><select value={action.sourceRef ?? ''} onChange={event => onChange({ ...action, sourceRef: event.target.value || undefined })}>
      <option value="">Mismo actor</option>{actorOptions.map(id => <option key={id}>{id}</option>)}
    </select></label>
    <label><span>Dirección</span><select value={action.direction} onChange={event => onChange({ ...action, direction: event.target.value as typeof action.direction })}>
      <option value="sourceToTarget">Del origen al objetivo</option><option value="up">Arriba</option><option value="down">Abajo</option><option value="left">Izquierda</option><option value="right">Derecha</option>
    </select></label>
    <label><span>Casillas</span><input type="number" min="1" value={action.tiles} onChange={event => onChange({ ...action, tiles: Math.max(1, Number(event.target.value) || 1) })} /></label>
  </fieldset>;
  if (action.kind === 'playAudio') return <fieldset><legend>Audio</legend>
    <label><span>Recurso</span><select value={action.audioAssetId} onChange={event => onChange({ ...action, audioAssetId: event.target.value })}>{audios.map(id => <option key={id}>{id}</option>)}</select></label>
    <label><span>Canal</span><select value={action.channel ?? 'effect'} onChange={event => onChange({ ...action, channel: event.target.value as 'effect' | 'music' })}><option value="effect">Efecto</option><option value="music">Música</option></select></label>
    <label><span>Volumen</span><input type="number" min="0" max="1" step=".05" value={action.volume ?? 1} onChange={event => onChange({ ...action, volume: Math.max(0, Math.min(1, Number(event.target.value))) })} /></label>
    <label><span><input type="checkbox" checked={action.loop ?? false} onChange={event => onChange({ ...action, loop: event.target.checked })} /> Bucle</span></label>
  </fieldset>;
  if (action.kind === 'stopAudio') return <fieldset><legend>Detener audio</legend>
    <label><span>Canal</span><select value={action.channel ?? 'all'} onChange={event => onChange({ ...action, channel: event.target.value as typeof action.channel })}><option value="all">Todo</option><option value="effect">Efectos</option><option value="music">Música</option></select></label>
    <label><span>Fade (ms)</span><input type="number" min="0" value={action.fadeOutMs ?? 0} onChange={event => onChange({ ...action, fadeOutMs: Math.max(0, Number(event.target.value) || 0) })} /></label>
  </fieldset>;
  if (action.kind === 'setPlayerAppearance') return <label><span>Apariencia</span><select value={action.appearanceId} onChange={event => onChange({ ...action, appearanceId: event.target.value })}>{appearances.map(id => <option key={id}>{id}</option>)}</select></label>;
  if (action.kind === 'moveToLocation') return <fieldset><legend>Traslado</legend>
    {actorSelect}
    <label><span>Lugar</span><select value={action.locationId} onChange={event => onChange({ ...action, locationId: event.target.value })}>{locations.map(item => <option key={item.definition.locationId} value={item.definition.locationId}>{item.definition.label}</option>)}</select></label>
    <label><span>Sector opcional</span><input value={action.sectorId ?? ''} onChange={event => onChange({ ...action, sectorId: event.target.value.trim() || undefined })} /></label>
  </fieldset>;
  if (action.kind === 'openNarrative') return <label><span>Secuencia narrativa</span><input value={action.sequenceId} onChange={event => onChange({ ...action, sequenceId: event.target.value })} /></label>;
  if (action.kind === 'emitMissionOutcome') return <label><span>Resultado de misión</span><input value={action.outcomeId} onChange={event => onChange({ ...action, outcomeId: event.target.value })} /></label>;
  if (action.kind === 'movePath') return <fieldset><legend>Ruta</legend>{actorSelect}<label><span>Ruta</span><select value={action.pathId} onChange={event => onChange({ ...action, pathId: event.target.value })}>{paths.map(id => <option key={id}>{id}</option>)}</select></label></fieldset>;
  if (action.kind === 'playAnimation') return <fieldset><legend>Animación</legend>{actorSelect}<label><span>Nombre</span><input value={action.animation ?? ''} onChange={event => onChange({ ...action, animation: event.target.value || undefined })} /></label></fieldset>;
  if (action.kind === 'face') return <fieldset><legend>Orientación</legend>{actorSelect}<label><span>Dirección</span><select value={action.direction} onChange={event => onChange({ ...action, direction: event.target.value as typeof action.direction })}><option value="up">Arriba</option><option value="down">Abajo</option><option value="left">Izquierda</option><option value="right">Derecha</option></select></label></fieldset>;
  if (action.kind === 'setVisible') return <fieldset><legend>Visibilidad</legend>{actorSelect}<label><span><input type="checkbox" checked={action.visible} onChange={event => onChange({ ...action, visible: event.target.checked })} /> Visible</span></label></fieldset>;
  if (action.kind === 'moveByTiles') return <fieldset><legend>Movimiento</legend>{actorSelect}<label><span>Casillas</span><input type="number" min="1" value={action.tiles} onChange={event => onChange({ ...action, tiles: Math.max(1, Number(event.target.value) || 1) })} /></label></fieldset>;
  if (action.kind === 'moveToAnchor') return <fieldset><legend>Ancla</legend>{actorSelect}<label><span>ID de ancla</span><input value={action.anchorId} onChange={event => onChange({ ...action, anchorId: event.target.value })} /></label></fieldset>;
  return <fieldset><legend>{ACTION_LABELS[action.kind]}</legend>{actorSelect}</fieldset>;
}

export function UnifiedEventEditor({
  bundle,
  room,
  tilemap,
  onAdventureChange,
}: {
  bundle: LoadedAdventureMapBundle;
  room: LoadedAdventureSectorBundle;
  tilemap: PokeDiscoverEditableTiledMap;
  onAdventureChange: (adventure: AdventureMapV3) => void;
}) {
  const actors = useMemo(
    () => actorsInRoom(bundle, room.sector.sectorId),
    [bundle, room.sector.sectorId],
  );
  const effects = (bundle.mediaManifest?.assets ?? []).filter(asset => asset.kind === 'effect');
  const audios = (bundle.mediaManifest?.assets ?? []).filter(asset => asset.kind === 'audio');
  const appearances = bundle.characterManifest.appearances ?? [];
  const locations = listPokeDiscoverLocations(tilemap);
  const paths = pathsInMap(tilemap);
  const fallAreas = fallAreasInMap(tilemap);
  const events = (bundle.adventure.mapEventTriggers ?? [])
    .filter(trigger => trigger.sectorId === room.sector.sectorId);
  const mapSequences = (bundle.adventure.mapSequences ?? [])
    .filter(sequence => sequence.sectorId === room.sector.sectorId);
  const companionSequences = (bundle.adventure.companionSequences ?? [])
    .filter(sequence => sequence.sectorId === room.sector.sectorId);
  const ambientSequences = bundle.adventure.ambientSequences
    .filter(sequence => sequence.sectorId === room.sector.sectorId);
  const [sequenceFamily, setSequenceFamily] = useState<EditableSequenceFamily>('map');
  const sequences = sequenceFamily === 'companion' ? companionSequences : mapSequences;
  const [recipeKind, setRecipeKind] = useState<PokeDiscoverEventRecipeKind>('proximityAmbush');
  const [primaryActorId, setPrimaryActorId] = useState(actors[0]?.placementId ?? '');
  const [secondaryActorId, setSecondaryActorId] = useState(actors[1]?.placementId ?? '');
  const [effectAssetId, setEffectAssetId] = useState(effects[0]?.assetId ?? '');
  const [pathId, setPathId] = useState(paths[0] ?? '');
  const [fallAreaId, setFallAreaId] = useState(fallAreas[0] ?? '');
  const [intervalMs, setIntervalMs] = useState(2_000);
  const [rangeTiles, setRangeTiles] = useState(2);
  const [requirementKind, setRequirementKind] = useState<'capability' | 'item'>('capability');
  const [requirementId, setRequirementId] = useState('surf');
  const [prompt, setPrompt] = useState('Interactuar');
  const [phrase, setPhrase] = useState('hola');
  const [consequence, setConsequence] = useState<HazardConsequenceV1>(
    defaultConsequence('recover', 'preserveGains'),
  );
  const [selectedTriggerId, setSelectedTriggerId] = useState(events[0]?.triggerId ?? '');
  const [selectedSequenceId, setSelectedSequenceId] = useState(mapSequences[0]?.sequenceId ?? '');
  const [selectedBeatIndex, setSelectedBeatIndex] = useState(0);
  const [selectedActionIndex, setSelectedActionIndex] = useState(0);
  const [newActionKind, setNewActionKind] = useState<MapSequenceActionKind>('playAnimation');
  const [message, setMessage] = useState('');
  const [previewAppearanceId, setPreviewAppearanceId] = useState(appearances[0]?.appearanceId ?? '');
  const [libraryQuery, setLibraryQuery] = useState('');
  const [libraryActivation, setLibraryActivation] = useState('all');
  const [libraryStatus, setLibraryStatus] = useState<'all' | 'linked' | 'orphan'>('all');
  const libraryEntries = useMemo(() => {
    const mapEntries = events.map(trigger => {
      const sequence = mapSequences.find(candidate => candidate.sequenceId === trigger.sequenceId);
      const actorRefs = sequence?.beats.flatMap(beat => beat.actions.flatMap(action => (
        'actorRef' in action ? [action.actorRef] : []
      ))) ?? [];
      return {
        family: 'map' as const,
        sequenceId: trigger.sequenceId,
        triggerId: trigger.triggerId,
        activation: trigger.activation.kind,
        actors: actorRefs,
        location: JSON.stringify(trigger.activation),
        status: sequence ? 'linked' as const : 'orphan' as const,
      };
    });
    const ambientEntries = ambientSequences.map(sequence => ({
      family: 'ambient' as const,
      sequenceId: sequence.sequenceId,
      triggerId: '',
      activation: sequence.playbackMode ?? (sequence.loop ? 'loop' : 'once'),
      actors: sequence.beats.flatMap(beat => beat.actions.map(action => action.placementId)),
      location: sequence.sectorId,
      status: 'linked' as const,
    }));
    const companionEntries = companionSequences.map(sequence => {
      const triggers = bundle.adventure.behaviorTriggers.filter(trigger => trigger.sequenceId === sequence.sequenceId);
      return {
        family: 'companion' as const,
        sequenceId: sequence.sequenceId,
        triggerId: triggers.map(trigger => trigger.triggerId).join(', '),
        activation: triggers.map(trigger => trigger.mode).join(', ') || 'sin disparador',
        actors: sequence.beats.flatMap(beat => beat.actions.flatMap(action => (
          'actorRef' in action ? [action.actorRef] : []
        ))),
        location: triggers.map(trigger => JSON.stringify(trigger.proximity?.target ?? '')).join(' '),
        status: triggers.length ? 'linked' as const : 'orphan' as const,
      };
    });
    return [...mapEntries, ...ambientEntries, ...companionEntries];
  }, [
    ambientSequences,
    bundle.adventure.behaviorTriggers,
    companionSequences,
    events,
    mapSequences,
  ]);
  const filteredLibraryEntries = libraryEntries.filter(entry => {
    const haystack = [
      entry.sequenceId,
      entry.triggerId,
      entry.activation,
      entry.location,
      ...entry.actors,
    ].join(' ').toLocaleLowerCase();
    return (!libraryQuery.trim() || haystack.includes(libraryQuery.trim().toLocaleLowerCase()))
      && (libraryActivation === 'all' || entry.activation.includes(libraryActivation))
      && (libraryStatus === 'all' || entry.status === libraryStatus);
  });
  const selectedSequence = sequences.find(sequence => sequence.sequenceId === selectedSequenceId)
    ?? (sequenceFamily === 'map'
      ? sequences.find(sequence => events.find(event => event.triggerId === selectedTriggerId)?.sequenceId === sequence.sequenceId)
      : undefined)
    ?? sequences[0];
  const selectedTrigger = sequenceFamily === 'map'
    ? events.find(event => event.triggerId === selectedTriggerId)
    : undefined;
  const selectedCompanionTriggers = sequenceFamily === 'companion'
    ? bundle.adventure.behaviorTriggers.filter(trigger => trigger.sequenceId === selectedSequence?.sequenceId)
    : [];

  const replaceSequence = (next: MapSequenceV3 | CompanionSequenceV3) => {
    if (sequenceFamily === 'companion') {
      onAdventureChange({
        ...bundle.adventure,
        companionSequences: (bundle.adventure.companionSequences ?? []).map(sequence => (
          sequence.sequenceId === next.sequenceId ? next as CompanionSequenceV3 : sequence
        )),
      });
      return;
    }
    onAdventureChange({
      ...bundle.adventure,
      mapSequences: (bundle.adventure.mapSequences ?? []).map(sequence => (
        sequence.sequenceId === next.sequenceId ? next as MapSequenceV3 : sequence
      )),
    });
  };
  const replaceTrigger = (next: NonNullable<typeof selectedTrigger>) => onAdventureChange({
    ...bundle.adventure,
    mapEventTriggers: (bundle.adventure.mapEventTriggers ?? []).map(trigger => (
      trigger.triggerId === next.triggerId ? next : trigger
    )),
  });

  const createRecipe = () => {
    try {
      const requirement: RequirementExpressionV1 | undefined = recipeKind === 'capabilityObstacle'
        ? requirementKind === 'capability'
          ? { kind: 'fieldCapability', capabilityId: requirementId as 'surf', minimumStrength: 1 }
          : { kind: 'inventoryItem', itemId: requirementId }
        : undefined;
      const result = createPokeDiscoverEventRecipe(bundle.adventure, {
        kind: recipeKind,
        sectorId: room.sector.sectorId,
        primaryActorId,
        secondaryActorId: secondaryActorId || undefined,
        effectAssetId: effectAssetId || undefined,
        pathId: pathId || undefined,
        intervalMs,
        rangeTiles,
        requirement,
        prompt,
        phrase,
        consequence: ['periodicProjectile', 'patrolCharge'].includes(recipeKind)
          ? consequence
          : recipeKind === 'fallRecovery' ? consequence : undefined,
        terrainAreaId: recipeKind === 'fallRecovery' ? fallAreaId : undefined,
      });
      onAdventureChange(result.adventure);
      setSelectedTriggerId(result.createdId);
      setSelectedSequenceId(result.sequenceId);
      setMessage('Receta creada. Puedes afinar sus pasos en Edición avanzada.');
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'No se pudo crear la receta.');
    }
  };

  const addAction = (parallel: boolean) => {
    if (!selectedSequence) return;
    const allowedKinds = sequenceFamily === 'companion'
      ? COMPANION_SEQUENCE_ACTION_KINDS
      : EVENT_ACTION_KINDS;
    const actionKind = allowedKinds.includes(newActionKind as never)
      ? newActionKind
      : allowedKinds[0];
    const action = defaultAction(
      actionKind,
      primaryActorId || 'dynamic:player',
      secondaryActorId,
      effectAssetId,
      audios[0]?.assetId ?? '',
      appearances[0]?.appearanceId ?? '',
      locations[0]?.definition.locationId ?? '',
    );
    if (
      sequenceFamily === 'companion'
      && !COMPANION_SEQUENCE_ACTION_KINDS.includes(action.kind as never)
    ) return;
    const beats = parallel && selectedSequence.beats[selectedBeatIndex]
      ? selectedSequence.beats.map((beat, index) => index === selectedBeatIndex
        ? { ...beat, actions: [...beat.actions, action] }
        : beat)
      : [...selectedSequence.beats, {
        schemaVersion: 1 as const,
        beatId: `${selectedSequence.sequenceId}:beat:${String(selectedSequence.beats.length + 1).padStart(2, '0')}`,
        actions: [action],
        pauseAfterMs: 0,
      }];
    replaceSequence({ ...selectedSequence, beats } as MapSequenceV3 | CompanionSequenceV3);
    if (!parallel) setSelectedBeatIndex(beats.length - 1);
  };

  const removeAction = (beatIndex: number, actionIndex: number) => {
    if (!selectedSequence) return;
    const beats = selectedSequence.beats
      .map((beat, index) => index === beatIndex
        ? { ...beat, actions: beat.actions.filter((_, candidate) => candidate !== actionIndex) }
        : beat)
      .filter(beat => beat.actions.length);
    replaceSequence({ ...selectedSequence, beats } as MapSequenceV3 | CompanionSequenceV3);
    setSelectedBeatIndex(Math.max(0, Math.min(selectedBeatIndex, beats.length - 1)));
  };

  const replaceAction = (nextAction: MapSequenceActionV1) => {
    if (!selectedSequence) return;
    const beats = selectedSequence.beats.map((beat, beatIndex) => (
      beatIndex === selectedBeatIndex
        ? {
          ...beat,
          actions: beat.actions.map((action, actionIndex) => (
            actionIndex === selectedActionIndex ? nextAction : action
          )),
        }
        : beat
    ));
    replaceSequence({ ...selectedSequence, beats } as MapSequenceV3 | CompanionSequenceV3);
  };

  const replaceSelectedBeat = (
    update: (beat: typeof selectedSequence.beats[number]) => typeof selectedSequence.beats[number],
  ) => {
    if (!selectedSequence?.beats[selectedBeatIndex]) return;
    const beats = selectedSequence.beats.map((beat, index) => (
      index === selectedBeatIndex ? update(beat) : beat
    ));
    replaceSequence({ ...selectedSequence, beats } as MapSequenceV3 | CompanionSequenceV3);
  };

  const moveBeat = (direction: -1 | 1) => {
    if (!selectedSequence) return;
    const target = selectedBeatIndex + direction;
    if (target < 0 || target >= selectedSequence.beats.length) return;
    const beats = [...selectedSequence.beats];
    [beats[selectedBeatIndex], beats[target]] = [beats[target], beats[selectedBeatIndex]];
    replaceSequence({ ...selectedSequence, beats } as MapSequenceV3 | CompanionSequenceV3);
    setSelectedBeatIndex(target);
  };

  const duplicateBeat = () => {
    if (!selectedSequence?.beats[selectedBeatIndex]) return;
    const source = selectedSequence.beats[selectedBeatIndex];
    const beatId = `${selectedSequence.sequenceId}:beat:${String(selectedSequence.beats.length + 1).padStart(2, '0')}`;
    const beats = [...selectedSequence.beats];
    beats.splice(selectedBeatIndex + 1, 0, {
      ...source,
      beatId,
      actions: source.actions.map(action => ({ ...action })),
    });
    replaceSequence({ ...selectedSequence, beats } as MapSequenceV3 | CompanionSequenceV3);
    setSelectedBeatIndex(selectedBeatIndex + 1);
    setSelectedActionIndex(0);
  };

  const removeBeat = () => {
    if (!selectedSequence || selectedSequence.beats.length <= 1) return;
    const beats = selectedSequence.beats.filter((_, index) => index !== selectedBeatIndex);
    replaceSequence({ ...selectedSequence, beats } as MapSequenceV3 | CompanionSequenceV3);
    setSelectedBeatIndex(Math.min(selectedBeatIndex, beats.length - 1));
    setSelectedActionIndex(0);
  };

  const moveAction = (direction: -1 | 1) => {
    const beat = selectedSequence?.beats[selectedBeatIndex];
    if (!beat) return;
    const target = selectedActionIndex + direction;
    if (target < 0 || target >= beat.actions.length) return;
    replaceSelectedBeat(current => {
      const actions = [...current.actions];
      [actions[selectedActionIndex], actions[target]] = [actions[target], actions[selectedActionIndex]];
      return { ...current, actions };
    });
    setSelectedActionIndex(target);
  };

  const duplicateAction = () => {
    const action = selectedSequence?.beats[selectedBeatIndex]?.actions[selectedActionIndex];
    if (!action) return;
    replaceSelectedBeat(beat => {
      const actions = [...beat.actions];
      actions.splice(selectedActionIndex + 1, 0, { ...action });
      return { ...beat, actions };
    });
    setSelectedActionIndex(selectedActionIndex + 1);
  };

  return <section className="editor-unified-events">
    <header><div><span>Biblioteca común</span><strong>Eventos y peligros</strong></div><span>{events.length}</span></header>
    <p>Las recetas crean contratos compartidos. Después puedes ordenar pasos y añadir acciones paralelas sin ver ni editar IDs.</p>
    <details open>
      <summary>Buscar en todos los eventos del sector ({filteredLibraryEntries.length})</summary>
      <div className="editor-unified-events__grid">
        <label><span>Actor, lugar o texto</span><input
          type="search"
          value={libraryQuery}
          onChange={event => setLibraryQuery(event.target.value)}
          placeholder="Froakie, laboratorio, ruta…"
        /></label>
        <label><span>Activación</span><select value={libraryActivation} onChange={event => setLibraryActivation(event.target.value)}>
          <option value="all">Todas</option>
          {[...new Set(libraryEntries.map(entry => entry.activation).filter(Boolean))]
            .map(activation => <option key={activation} value={activation}>{activation}</option>)}
        </select></label>
        <label><span>Estado</span><select value={libraryStatus} onChange={event => setLibraryStatus(event.target.value as typeof libraryStatus)}>
          <option value="all">Todos</option>
          <option value="linked">Correctamente enlazados</option>
          <option value="orphan">Con referencia pendiente</option>
        </select></label>
      </div>
      {filteredLibraryEntries.length ? <ul className="editor-unified-events__library">
        {filteredLibraryEntries.map(entry => <li key={`${entry.family}:${entry.triggerId}:${entry.sequenceId}`}>
          <button type="button" onClick={() => {
            setSequenceFamily(entry.family);
            setSelectedSequenceId(entry.sequenceId);
            if (entry.triggerId) setSelectedTriggerId(entry.triggerId.split(', ')[0]);
            setSelectedBeatIndex(0);
            setSelectedActionIndex(0);
          }}>
            <strong>{entry.family === 'map' ? 'Mapa' : entry.family === 'ambient' ? 'Ambiente' : 'Compañero'}</strong>
            <span>{entry.activation} · {entry.actors.length ? [...new Set(entry.actors)].join(', ') : 'sin actor'}</span>
            <small>{entry.status === 'linked' ? 'Enlazado' : 'Revisar referencia'}</small>
          </button>
        </li>)}
      </ul> : <p>No hay eventos que coincidan con los filtros.</p>}
    </details>
    <label><span>Receta</span><select value={recipeKind} onChange={event => setRecipeKind(event.target.value as PokeDiscoverEventRecipeKind)}>
      {POKEDISCOVER_EVENT_RECIPES.map(recipe => <option key={recipe.kind} value={recipe.kind}>{recipe.label}</option>)}
    </select></label>
    <p>{POKEDISCOVER_EVENT_RECIPES.find(recipe => recipe.kind === recipeKind)?.description}</p>
    <div className="editor-unified-events__grid">
      {recipeKind !== 'fallRecovery' ? <label><span>Actor principal</span><select value={primaryActorId} onChange={event => setPrimaryActorId(event.target.value)}>
        {actors.map(actor => <option key={actor.placementId}>{actor.placementId}</option>)}
      </select></label> : <label><span>Área de caída</span><select value={fallAreaId} onChange={event => setFallAreaId(event.target.value)}>
        <option value="">Seleccionar TerrainArea fall</option>{fallAreas.map(id => <option key={id}>{id}</option>)}
      </select></label>}
      {['actorInterception', 'multiActorChoreography'].includes(recipeKind) ? <label><span>Actor secundario</span><select value={secondaryActorId} onChange={event => setSecondaryActorId(event.target.value)}>
        {actors.filter(actor => actor.placementId !== primaryActorId).map(actor => <option key={actor.placementId}>{actor.placementId}</option>)}
      </select></label> : null}
      {recipeKind === 'periodicProjectile' ? <>
        <label><span>Efecto</span><select value={effectAssetId} onChange={event => setEffectAssetId(event.target.value)}>
          <option value="">Seleccionar efecto</option>
          {effects.map(effect => <option key={effect.assetId}>{effect.assetId}</option>)}
        </select></label>
        <label><span>Intervalo (ms)</span><input type="number" min="100" value={intervalMs} onChange={event => setIntervalMs(Math.max(100, Number(event.target.value) || 100))} /></label>
      </> : null}
      {recipeKind === 'patrolCharge' ? <label><span>Ruta protegida</span><select value={pathId} onChange={event => setPathId(event.target.value)}>
        <option value="">Seleccionar ruta</option>{paths.map(path => <option key={path}>{path}</option>)}
      </select></label> : null}
      {['proximityAmbush', 'companionReaction', 'expressiveInteraction'].includes(recipeKind) ? <label><span>Distancia (tiles)</span><input type="number" min="1" value={rangeTiles} onChange={event => setRangeTiles(Math.max(1, Number(event.target.value) || 1))} /></label> : null}
      {['capabilityObstacle', 'inspectAndFlee', 'expressiveInteraction'].includes(recipeKind) ? <label><span>Acción visible</span><input value={prompt} onChange={event => setPrompt(event.target.value)} /></label> : null}
      {recipeKind === 'expressiveInteraction' ? <label><span>Frase reconocida</span><input value={phrase} onChange={event => setPhrase(event.target.value)} /></label> : null}
    </div>
    {recipeKind === 'capabilityObstacle' ? <fieldset>
      <legend>Requisito</legend>
      <label><span>Tipo</span><select value={requirementKind} onChange={event => setRequirementKind(event.target.value as typeof requirementKind)}>
        <option value="capability">Capacidad de campo</option><option value="item">Objeto</option>
      </select></label>
      <label><span>Identificador editorial</span><input value={requirementId} onChange={event => setRequirementId(event.target.value)} /></label>
    </fieldset> : null}
    {['periodicProjectile', 'patrolCharge', 'fallRecovery'].includes(recipeKind) ? <ConsequenceFields value={consequence} locations={locations} onChange={setConsequence} /> : null}
    <button type="button" className="is-primary" disabled={recipeKind === 'fallRecovery' ? !fallAreaId : !primaryActorId} onClick={createRecipe}>Crear evento</button>
    {message ? <p role="status">{message}</p> : null}

    <details open>
      <summary>Edición avanzada por pasos</summary>
      <label><span>Familia de guion</span><select value={sequenceFamily} onChange={event => {
        const family = event.target.value as EditableSequenceFamily;
        setSequenceFamily(family);
        setSelectedSequenceId(
          family === 'map'
            ? mapSequences[0]?.sequenceId ?? ''
            : family === 'companion'
              ? companionSequences[0]?.sequenceId ?? ''
              : ambientSequences[0]?.sequenceId ?? '',
        );
        setSelectedBeatIndex(0);
        setSelectedActionIndex(0);
      }}>
        <option value="map">Eventos de mapa ({mapSequences.length})</option>
        <option value="ambient">Secuencias ambientales ({ambientSequences.length})</option>
        <option value="companion">Reacciones de compañero ({companionSequences.length})</option>
      </select></label>
      {sequenceFamily === 'ambient' ? <AmbientBeatEditor
        bundle={bundle}
        room={room}
        onAdventureChange={onAdventureChange}
        initialSequenceId={selectedSequenceId}
        embedded
      /> : <>
      {sequenceFamily === 'map' && events.length ? <label><span>Evento</span><select value={selectedTriggerId} onChange={event => {
        const triggerId = event.target.value;
        const trigger = events.find(candidate => candidate.triggerId === triggerId);
        setSelectedTriggerId(triggerId);
        setSelectedSequenceId(trigger?.sequenceId ?? '');
        setSelectedBeatIndex(0);
      }}>
        {events.map((event, index) => <option key={event.triggerId} value={event.triggerId}>Evento {index + 1} · {event.activation.kind}</option>)}
      </select></label> : sequenceFamily === 'map' ? <p>No hay eventos en este sector.</p> : null}
      {sequenceFamily === 'companion' ? (
        companionSequences.length
          ? <label><span>Secuencia de compañero</span><select
            value={selectedSequence?.sequenceId ?? ''}
            onChange={event => {
              setSelectedSequenceId(event.target.value);
              setSelectedBeatIndex(0);
              setSelectedActionIndex(0);
            }}
          >
            {companionSequences.map((sequence, index) => <option key={sequence.sequenceId} value={sequence.sequenceId}>
              Reacción {index + 1}
            </option>)}
          </select></label>
          : <p>No hay secuencias de compañero en este sector.</p>
      ) : null}
      {selectedSequence ? <>
        {selectedTrigger ? <fieldset>
          <legend>Activación y repetición</legend>
          <label><span>Activación</span><input value={selectedTrigger.activation.kind} readOnly /></label>
          <label><span>Repetición</span><select value={selectedTrigger.repeatPolicy ?? 'oncePerVisit'} onChange={event => replaceTrigger({
            ...selectedTrigger,
            repeatPolicy: event.target.value as NonNullable<typeof selectedTrigger.repeatPolicy>,
          })}>
            <option value="oncePerSectorVisit">Una vez por sector</option>
            <option value="oncePerVisit">Una vez por expedición</option>
            <option value="repeatable">Repetible</option>
            <option value="persistent">Persistente</option>
          </select></label>
          {selectedTrigger.activation.kind === 'interval' ? <>
            <label><span>Demora inicial (ms)</span><input type="number" min="0" value={selectedTrigger.activation.initialDelayMs ?? 0} onChange={event => replaceTrigger({
              ...selectedTrigger,
              activation: {
                kind: 'interval',
                intervalMs: selectedTrigger.activation.kind === 'interval' ? selectedTrigger.activation.intervalMs : 1,
                initialDelayMs: Math.max(0, Number(event.target.value) || 0),
                activeZoneId: selectedTrigger.activation.kind === 'interval' ? selectedTrigger.activation.activeZoneId : undefined,
              },
            })} /></label>
            <label><span>Intervalo (ms)</span><input type="number" min="1" value={selectedTrigger.activation.intervalMs} onChange={event => replaceTrigger({
              ...selectedTrigger,
              activation: {
                kind: 'interval',
                intervalMs: Math.max(1, Number(event.target.value) || 1),
                initialDelayMs: selectedTrigger.activation.kind === 'interval' ? selectedTrigger.activation.initialDelayMs : undefined,
                activeZoneId: selectedTrigger.activation.kind === 'interval' ? selectedTrigger.activation.activeZoneId : undefined,
              },
            })} /></label>
          </> : null}
          {(selectedTrigger.activation.kind === 'proximity' || selectedTrigger.activation.kind === 'contextAction') ? <label><span>Distancia (tiles)</span><input type="number" min="1" value={selectedTrigger.activation.rangeTiles ?? 1} onChange={event => replaceTrigger({
            ...selectedTrigger,
            activation: selectedTrigger.activation.kind === 'contextAction'
              ? {
                kind: 'contextAction',
                target: selectedTrigger.activation.target,
                prompt: selectedTrigger.activation.prompt,
                rangeTiles: Math.max(1, Number(event.target.value) || 1),
              }
              : selectedTrigger.activation.kind === 'proximity'
                ? {
                  kind: 'proximity',
                  target: selectedTrigger.activation.target,
                  rangeTiles: Math.max(1, Number(event.target.value) || 1),
                }
                : selectedTrigger.activation,
          })} /></label> : null}
          <label><span>Guion si falla el requisito</span><input value={selectedTrigger.failureSequenceId ?? ''} onChange={event => replaceTrigger({
            ...selectedTrigger,
            failureSequenceId: event.target.value.trim() || undefined,
          })} /></label>
          <details><summary>Requisito tipado</summary><RequirementExpressionEditor
            value={selectedTrigger.requirement}
            onChange={requirement => replaceTrigger({ ...selectedTrigger, requirement })}
          /></details>
          <label><span>Paquete de recompensa</span><input
            value={selectedTrigger.rewardPackageId ?? ''}
            placeholder="reward-package:..."
            onChange={event => replaceTrigger({
              ...selectedTrigger,
              rewardPackageId: event.target.value.trim() || undefined,
              rewardOriginId: event.target.value.trim()
                ? selectedTrigger.rewardOriginId ?? selectedTrigger.triggerId
                : undefined,
            })}
          /></label>
          <fieldset>
            <legend>Estado final de actores</legend>
            {(selectedTrigger.resultingActorStates ?? []).map((state, stateIndex) => <div key={`${state.placementId}:${stateIndex}`}>
              <label><span>Actor</span><select value={state.placementId} onChange={event => replaceTrigger({
                ...selectedTrigger,
                resultingActorStates: selectedTrigger.resultingActorStates.map((candidate, index) => (
                  index === stateIndex ? { ...candidate, placementId: event.target.value } : candidate
                )),
              })}>{actors.map(actor => <option key={actor.placementId}>{actor.placementId}</option>)}</select></label>
              <label><span>Visibilidad</span><select value={state.visible === undefined ? 'inherit' : String(state.visible)} onChange={event => replaceTrigger({
                ...selectedTrigger,
                resultingActorStates: selectedTrigger.resultingActorStates.map((candidate, index) => (
                  index === stateIndex
                    ? {
                      ...candidate,
                      visible: event.target.value === 'inherit'
                        ? undefined
                        : event.target.value === 'true',
                    }
                    : candidate
                )),
              })}><option value="inherit">Sin cambio</option><option value="true">Visible</option><option value="false">Oculto</option></select></label>
              <label><span>Animación</span><input value={state.animation ?? ''} onChange={event => replaceTrigger({
                ...selectedTrigger,
                resultingActorStates: selectedTrigger.resultingActorStates.map((candidate, index) => (
                  index === stateIndex
                    ? { ...candidate, animation: event.target.value.trim() || undefined }
                    : candidate
                )),
              })} /></label>
              <label><span>Orientación</span><select value={state.direction ?? ''} onChange={event => replaceTrigger({
                ...selectedTrigger,
                resultingActorStates: selectedTrigger.resultingActorStates.map((candidate, index) => (
                  index === stateIndex
                    ? {
                      ...candidate,
                      direction: (event.target.value || undefined) as typeof candidate.direction,
                    }
                    : candidate
                )),
              })}><option value="">Sin cambio</option><option value="up">Arriba</option><option value="down">Abajo</option><option value="left">Izquierda</option><option value="right">Derecha</option></select></label>
              <button type="button" className="is-danger" onClick={() => replaceTrigger({
                ...selectedTrigger,
                resultingActorStates: selectedTrigger.resultingActorStates.filter((_, index) => index !== stateIndex),
              })}>Quitar estado</button>
            </div>)}
            <button type="button" disabled={!actors.length} onClick={() => replaceTrigger({
              ...selectedTrigger,
              resultingActorStates: [...selectedTrigger.resultingActorStates, {
                schemaVersion: 1,
                placementId: actors[0].placementId,
              }],
            })}>Añadir estado final</button>
          </fieldset>
        </fieldset> : sequenceFamily === 'companion' ? <fieldset>
          <legend>Activación, repetición y recompensa</legend>
          {selectedCompanionTriggers.length ? selectedCompanionTriggers.map(trigger => <div key={trigger.triggerId}>
            <label><span>Modo</span><input value={trigger.mode} readOnly /></label>
            <label><span>Repetición</span><select value={trigger.repeatPolicy ?? 'oncePerVisit'} onChange={event => onAdventureChange({
              ...bundle.adventure,
              behaviorTriggers: bundle.adventure.behaviorTriggers.map(candidate => (
                candidate.triggerId === trigger.triggerId
                  ? { ...candidate, repeatPolicy: event.target.value as typeof candidate.repeatPolicy }
                  : candidate
              )),
            })}>
              <option value="oncePerVisit">Una vez por expedición</option>
              <option value="repeatable">Repetible</option>
              <option value="persistent">Persistente</option>
            </select></label>
            <label><span>Guion al fallar</span><input
              value={trigger.proximity?.failureSequenceId ?? ''}
              disabled={!trigger.proximity}
              onChange={event => onAdventureChange({
                ...bundle.adventure,
                behaviorTriggers: bundle.adventure.behaviorTriggers.map(candidate => (
                  candidate.triggerId === trigger.triggerId && candidate.proximity
                    ? {
                      ...candidate,
                      proximity: {
                        ...candidate.proximity,
                        failureSequenceId: event.target.value.trim() || undefined,
                      },
                    }
                    : candidate
                )),
              })}
            /></label>
            <label><span>Paquete de recompensa</span><input
              value={trigger.rewardPackageId ?? ''}
              onChange={event => onAdventureChange({
                ...bundle.adventure,
                behaviorTriggers: bundle.adventure.behaviorTriggers.map(candidate => (
                  candidate.triggerId === trigger.triggerId
                    ? {
                      ...candidate,
                      rewardPackageId: event.target.value.trim() || undefined,
                      rewardOriginId: event.target.value.trim()
                        ? candidate.rewardOriginId ?? candidate.triggerId
                        : undefined,
                    }
                    : candidate
                )),
              })}
            /></label>
            <details><summary>Requisito tipado</summary><RequirementExpressionEditor
              value={trigger.requirement}
              onChange={requirement => onAdventureChange({
                ...bundle.adventure,
                behaviorTriggers: bundle.adventure.behaviorTriggers.map(candidate => (
                  candidate.triggerId === trigger.triggerId
                    ? { ...candidate, requirement }
                    : candidate
                )),
              })}
            /></details>
          </div>) : <p>Esta secuencia todavía no está enlazada a un disparador de compañero.</p>}
        </fieldset> : null}
        <ol className="editor-unified-events__steps">
          {selectedSequence.beats.map((beat, beatIndex) => <li key={beat.beatId} className={selectedBeatIndex === beatIndex ? 'is-selected' : ''}>
            <button type="button" onClick={() => { setSelectedBeatIndex(beatIndex); setSelectedActionIndex(0); }}>Paso {beatIndex + 1}</button>
            <ul>{beat.actions.map((action, actionIndex) => <li key={`${action.kind}:${actionIndex}`}>
              <button type="button" onClick={() => { setSelectedBeatIndex(beatIndex); setSelectedActionIndex(actionIndex); }}>{describeAction(action)}</button>
              <button type="button" className="is-danger" onClick={() => removeAction(beatIndex, actionIndex)}>Quitar</button>
            </li>)}</ul>
          </li>)}
        </ol>
        <fieldset>
          <legend>Organizar paso {selectedBeatIndex + 1}</legend>
          <div className="editor-unified-events__actions">
            <button type="button" disabled={selectedBeatIndex <= 0} onClick={() => moveBeat(-1)}>Subir paso</button>
            <button type="button" disabled={selectedBeatIndex >= selectedSequence.beats.length - 1} onClick={() => moveBeat(1)}>Bajar paso</button>
            <button type="button" onClick={duplicateBeat}>Duplicar paso</button>
            <button type="button" className="is-danger" disabled={selectedSequence.beats.length <= 1} onClick={removeBeat}>Quitar paso</button>
          </div>
          <label><span>Pausa posterior (ms)</span><input
            type="number"
            min="0"
            value={typeof selectedSequence.beats[selectedBeatIndex]?.pauseAfterMs === 'number'
              ? selectedSequence.beats[selectedBeatIndex].pauseAfterMs
              : 0}
            onChange={event => replaceSelectedBeat(beat => ({
              ...beat,
              pauseAfterMs: Math.max(0, Number(event.target.value) || 0),
            }))}
          /></label>
        </fieldset>
        <label><span>Nueva acción</span><select value={newActionKind} onChange={event => setNewActionKind(event.target.value as MapSequenceActionKind)}>
          {(sequenceFamily === 'companion' ? COMPANION_SEQUENCE_ACTION_KINDS : EVENT_ACTION_KINDS)
            .map(kind => <option key={kind} value={kind}>{ACTION_LABELS[kind]}</option>)}
        </select></label>
        <div className="editor-unified-events__actions">
          <button type="button" onClick={() => addAction(true)}>Añadir en paralelo</button>
          <button type="button" onClick={() => addAction(false)}>Añadir como paso nuevo</button>
          <button type="button" disabled={selectedActionIndex <= 0} onClick={() => moveAction(-1)}>Mover acción antes</button>
          <button type="button" disabled={selectedActionIndex >= (selectedSequence.beats[selectedBeatIndex]?.actions.length ?? 1) - 1} onClick={() => moveAction(1)}>Mover acción después</button>
          <button type="button" onClick={duplicateAction}>Duplicar acción</button>
        </div>
        {selectedSequence.beats[selectedBeatIndex]?.actions[selectedActionIndex] ? <ActionFields
          action={selectedSequence.beats[selectedBeatIndex].actions[selectedActionIndex]}
          actorIds={actors.map(actor => actor.placementId)}
          effects={effects.map(effect => effect.assetId)}
          audios={audios.map(audio => audio.assetId)}
          appearances={appearances.map(appearance => appearance.appearanceId)}
          locations={locations}
          paths={paths}
          onChange={replaceAction}
        /> : null}
        <details><summary>Diagnóstico técnico</summary>
          <dl><dt>Evento</dt><dd><code>{selectedTriggerId}</code></dd><dt>Secuencia</dt><dd><code>{selectedSequence.sequenceId}</code></dd></dl>
        </details>
      </> : null}
      </>}
    </details>

    <section className="editor-event-preview">
      <h3>Preview aislada</h3>
      <p>No escribe en la partida real. Abre «Probar» y usa los controles para simular Surf, impacto, evasión, reinicio o fracaso.</p>
      <div role="group">
        <label><span>Avatar/apariencia</span><select value={previewAppearanceId} onChange={event => {
          const appearanceId = event.target.value;
          const appearance = appearances.find(candidate => candidate.appearanceId === appearanceId);
          setPreviewAppearanceId(appearanceId);
          window.dispatchEvent(new CustomEvent('pokediscover:preview-control', {
            detail: {
              command: 'player',
              appearanceId,
              avatarId: appearance?.avatarId,
            },
          }));
        }}>{appearances.map(appearance => <option key={appearance.appearanceId} value={appearance.appearanceId}>{appearance.label}</option>)}</select></label>
        <button type="button" onClick={() => window.dispatchEvent(new CustomEvent('pokediscover:preview-control', { detail: { command: 'surf' } }))}>Alternar Surf</button>
        <button type="button" disabled={!selectedTriggerId} onClick={() => window.dispatchEvent(new CustomEvent('pokediscover:preview-control', { detail: { command: 'runEvent', triggerId: selectedTriggerId } }))}>Ejecutar evento</button>
        <button type="button" onClick={() => setMessage('Evasión simulada: no se aplica consecuencia ni se modifica la partida.')}>Evasión</button>
        <button type="button" onClick={() => window.dispatchEvent(new CustomEvent('pokediscover:preview-control', { detail: { command: 'hazard', consequence: defaultConsequence('resetSector', consequence.rollbackPolicy) } }))}>Reinicio</button>
        <button type="button" onClick={() => window.dispatchEvent(new CustomEvent('pokediscover:preview-control', { detail: { command: 'hazard', consequence: defaultConsequence('failMission', consequence.rollbackPolicy) } }))}>Fracaso</button>
        <button type="button" onClick={() => window.dispatchEvent(new CustomEvent('pokediscover:preview-control', { detail: { command: 'reset' } }))}>Restablecer preview</button>
      </div>
    </section>
    <details>
      <summary>Tutorial rápido con los ejemplos de Tegueste</summary>
      <ol>
        <li><strong>Rattata:</strong> elige «Emboscada por proximidad», selecciona el actor oculto y ajusta el empujón en el guion.</li>
        <li><strong>Froakie:</strong> usa «Ataque periódico con proyectil», importa Burbuja, configura `recover` y tierra segura más cercana.</li>
        <li><strong>Sirfetch’d:</strong> dibuja primero su patrulla y usa «Patrulla, detección y carga» con un lugar de recuperación frente al laboratorio.</li>
        <li><strong>Snorlax:</strong> usa «Obstáculo con objeto o capacidad» y selecciona un requisito de inventario para la Pokéflauta.</li>
        <li><strong>Pikachu, Klefki, Tauros y escenas compartidas:</strong> parte de las recetas de reacción, huida, intercepción o coreografía y añade acciones paralelas.</li>
      </ol>
    </details>
  </section>;
}
