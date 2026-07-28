import { useEffect, useMemo, useState } from 'react';
import {
  MAP_EVENT_ACTIVATION_KINDS,
  MAP_EVENT_REPEAT_POLICIES,
  type AdventureMapV3,
  type MapEventActivationKind,
  type MapEventRepeatPolicy,
} from '../../../packages/contracts/src/index.js';
import type {
  LoadedAdventureMapBundle,
  LoadedAdventureSectorBundle,
} from '../../domain/maps/loadAdventureBundle.js';
import {
  linkedPokeDiscoverMovementSequences,
  listPokeDiscoverMovementPaths,
  type PokeDiscoverMovementRouteDraft,
} from '../../domain/tools/pokeDiscoverMovementAuthoring.js';
import type { PokeDiscoverGeometryPoint } from '../../domain/tools/pokeDiscoverEditorGeometry.js';

const ACTIVATION_LABELS: Record<MapEventActivationKind, string> = {
  enterZone: 'Entrar en un área',
  contextAction: 'Pulsar E',
  proximity: 'Acercarse',
};

const REPEAT_LABELS: Record<MapEventRepeatPolicy, string> = {
  oncePerSectorVisit: 'Una vez por estancia en el sector',
  oncePerVisit: 'Una vez por visita al mapa',
  repeatable: 'Repetible',
  persistent: 'Permanente',
};

export function MovementAndEventsEditor({
  bundle,
  room,
  placementId,
  pathDraft,
  triggerZone,
  activeSequenceId,
  onActiveSequenceChange,
  onCancelDraft,
  onConfirmDraft,
  onTriggerZoneChange,
  onMoveRoute,
  onAdventureChange,
}: {
  bundle: LoadedAdventureMapBundle;
  room: LoadedAdventureSectorBundle;
  placementId: string;
  pathDraft?: PokeDiscoverGeometryPoint[];
  triggerZone?: { x: number; y: number; width: number; height: number };
  activeSequenceId: string;
  onActiveSequenceChange: (sequenceId: string) => void;
  onCancelDraft: () => void;
  onConfirmDraft: (draft: PokeDiscoverMovementRouteDraft) => string | undefined;
  onTriggerZoneChange: (
    zone: { x: number; y: number; width: number; height: number },
  ) => void;
  onMoveRoute: (sequenceId: string, pathId: string, delta: -1 | 1) => void;
  onAdventureChange: (adventure: AdventureMapV3) => void;
}) {
  const placement = bundle.adventure.actorPlacements.find(item => item.placementId === placementId)
    ?? bundle.adventure.characterPlacements.find(item => item.placementId === placementId);
  const actorPlacement = bundle.adventure.actorPlacements.find(item => item.placementId === placementId);
  const pokemon = Boolean(actorPlacement);
  const sequences = useMemo(() => linkedPokeDiscoverMovementSequences(
    bundle.adventure,
    room.sector.sectorId,
    placementId,
  ), [bundle.adventure, placementId, room.sector.sectorId]);
  const asset = placement && pokemon
    ? bundle.pmdManifest.assets.find(candidate => candidate.assetId === placement.assetId)
    : undefined;
  const animations = asset?.animations.map(animation => animation.name) ?? [];
  const defaultMovement = animations.includes('Walk') ? 'Walk' : animations[0] ?? '';
  const defaultFinal = actorPlacement?.animation ?? '';
  const [usage, setUsage] = useState<'ambient' | 'event'>('ambient');
  const [sequenceId, setSequenceId] = useState(activeSequenceId);
  const [speed, setSpeed] = useState(64);
  const [movementAnimation, setMovementAnimation] = useState(defaultMovement);
  const [finalAnimation, setFinalAnimation] = useState(defaultFinal);
  const [direction, setDirection] = useState<'up' | 'down' | 'left' | 'right'>(
    placement?.direction ?? 'down',
  );
  const [pause, setPause] = useState(0);
  const [playbackMode, setPlaybackMode] = useState<'once' | 'pingPong' | 'loop'>('pingPong');
  const [activationKind, setActivationKind] = useState<MapEventActivationKind>('enterZone');
  const [repeatPolicy, setRepeatPolicy] = useState<MapEventRepeatPolicy>('oncePerVisit');
  const [prompt, setPrompt] = useState('Interactuar');
  const [rangeTiles, setRangeTiles] = useState(1);
  const [targetPlacementId, setTargetPlacementId] = useState('');
  const [error, setError] = useState('');
  const [advancedActorId, setAdvancedActorId] = useState(placementId);
  const [advancedKind, setAdvancedKind] = useState<'face' | 'setVisible' | 'playAnimation'>('face');

  useEffect(() => setSequenceId(activeSequenceId), [activeSequenceId]);
  useEffect(() => {
    const complete = (event: Event) => {
      const detail = (event as CustomEvent<typeof triggerZone>).detail;
      if (detail) onTriggerZoneChange(detail);
    };
    window.addEventListener('pokediscover:event-zone-complete', complete);
    return () => window.removeEventListener('pokediscover:event-zone-complete', complete);
  }, [onTriggerZoneChange]);

  const chooseSequence = (next: string) => {
    setSequenceId(next);
    onActiveSequenceChange(next);
    const linked = sequences.find(sequence => sequence.sequenceId === next);
    if (linked) setUsage(linked.kind);
  };

  if (!placement) return null;
  const actors = [
    ...bundle.adventure.actorPlacements,
    ...bundle.adventure.characterPlacements.filter(candidate => !candidate.controllable),
  ].filter(candidate => candidate.sectorId === room.sector.sectorId);
  const externalActive = activeSequenceId && !sequences.some(sequence => sequence.sequenceId === activeSequenceId)
    ? bundle.adventure.ambientSequences.find(sequence => (
      sequence.sequenceId === activeSequenceId && sequence.sectorId === room.sector.sectorId
    ))
      ? { sequenceId: activeSequenceId, kind: 'ambient' as const }
      : (bundle.adventure.mapSequences ?? []).find(sequence => (
        sequence.sequenceId === activeSequenceId && sequence.sectorId === room.sector.sectorId
      ))
        ? { sequenceId: activeSequenceId, kind: 'event' as const }
        : undefined
    : undefined;
  const availableSequences = externalActive ? [...sequences, externalActive] : sequences;
  const activePaths = activeSequenceId
    ? listPokeDiscoverMovementPaths(bundle.adventure, activeSequenceId, placementId)
    : [];
  const activeMapSequence = (bundle.adventure.mapSequences ?? [])
    .find(sequence => sequence.sequenceId === activeSequenceId);
  const selectedAdvancedActor = actors.find(actor => actor.placementId === advancedActorId);
  const selectedAdvancedPokemon = bundle.adventure.actorPlacements
    .find(actor => actor.placementId === selectedAdvancedActor?.placementId);
  const selectedAdvancedAnimations = selectedAdvancedPokemon
    ? bundle.pmdManifest.assets.find(asset => asset.assetId === selectedAdvancedPokemon.assetId)?.animations ?? []
    : [];

  const addAdvancedAction = () => {
    if (!activeMapSequence || !selectedAdvancedActor) return;
    const last = activeMapSequence.beats.at(-1);
    const sharesActor = last?.actions.some(action => action.actorRef === selectedAdvancedActor.placementId);
    const action = advancedKind === 'face'
      ? { kind: 'face' as const, actorRef: selectedAdvancedActor.placementId, direction }
      : advancedKind === 'setVisible'
        ? { kind: 'setVisible' as const, actorRef: selectedAdvancedActor.placementId, visible: true }
        : {
          kind: 'playAnimation' as const,
          actorRef: selectedAdvancedActor.placementId,
          animation: selectedAdvancedAnimations[0]?.name,
        };
    if (action.kind === 'playAnimation' && !action.animation) return;
    const beatId = `${activeMapSequence.sequenceId}:beat:${String(activeMapSequence.beats.length + 1).padStart(2, '0')}`;
    const beats = last && !sharesActor
      ? activeMapSequence.beats.map(beat => beat.beatId === last.beatId
        ? { ...beat, actions: [...beat.actions, action] }
        : beat)
      : [...activeMapSequence.beats, {
        schemaVersion: 1 as const,
        beatId,
        actions: [action],
        pauseAfterMs: 0,
      }];
    onAdventureChange({
      ...bundle.adventure,
      mapSequences: (bundle.adventure.mapSequences ?? []).map(sequence => (
        sequence.sequenceId === activeMapSequence.sequenceId ? { ...sequence, beats } : sequence
      )),
    });
  };

  const confirm = () => {
    if (!pathDraft?.length) return;
    const result = onConfirmDraft({
      placementId,
      points: pathDraft,
      usage,
      speedPixelsPerSecond: speed,
      ...(pokemon && movementAnimation ? { movementAnimation } : {}),
      ...(pokemon && finalAnimation ? { finalAnimation } : {}),
      finalDirection: direction,
      pauseAfterMoveMs: pause,
      ...(sequenceId ? { sequenceId } : {}),
      ...(usage === 'ambient'
        ? { playbackMode }
        : {
          activationKind,
          repeatPolicy,
          prompt,
          rangeTiles,
          ...(targetPlacementId ? { targetPlacementId } : {}),
          ...(triggerZone ? { triggerZone } : {}),
        }),
    });
    setError(result ?? '');
  };

  return <section className="editor-movement-events" aria-label="Movimientos y eventos">
    <header>
      <div><span>Rutas vinculadas</span><strong>Movimientos y eventos</strong></div>
      <span>{sequences.length}</span>
    </header>
    {sequences.length ? <label>
      <span>Secuencia activa para continuar dibujando</span>
      <select value={activeSequenceId} onChange={event => chooseSequence(event.target.value)}>
        {availableSequences.map(sequence => (
          <option key={sequence.sequenceId} value={sequence.sequenceId}>
            {sequence.kind === 'ambient' ? 'Movimiento automático' : 'Evento'} · {sequence.sequenceId}
          </option>
        ))}
      </select>
    </label> : <p>Todavía no hay movimientos vinculados. Mantén Shift y arrastra la entidad para dibujar uno.</p>}
    {activePaths.length ? <ol className="editor-movement-events__paths" aria-label="Orden de las rutas">
      {activePaths.map((path, index) => <li key={path.pathId}>
        <code>{path.pathId}</code>
        <button type="button" disabled={index === 0} onClick={() => onMoveRoute(activeSequenceId, path.pathId, -1)}>Subir</button>
        <button type="button" disabled={index === activePaths.length - 1} onClick={() => onMoveRoute(activeSequenceId, path.pathId, 1)}>Bajar</button>
      </li>)}
    </ol> : null}

    {pathDraft ? <fieldset className="editor-movement-events__draft">
      <legend>Nueva ruta · {pathDraft.length} puntos</legend>
      <label><span>Añadir a</span><select value={sequenceId} onChange={event => chooseSequence(event.target.value)}>
        <option value="">Crear un comportamiento nuevo</option>
        {availableSequences.map(sequence => <option key={sequence.sequenceId} value={sequence.sequenceId}>
          {sequence.kind === 'ambient' ? 'Movimiento' : 'Evento'} · {sequence.sequenceId}
        </option>)}
      </select></label>
      {!sequenceId ? <div className="editor-movement-events__usage" role="group" aria-label="Uso de la ruta">
        <button type="button" aria-pressed={usage === 'ambient'} onClick={() => setUsage('ambient')}>Movimiento automático</button>
        <button type="button" aria-pressed={usage === 'event'} onClick={() => setUsage('event')}>Evento activado</button>
      </div> : null}
      <div className="editor-movement-events__grid">
        <label><span>Velocidad (px/s)</span><input type="number" min="1" value={speed} onChange={event => setSpeed(Math.max(1, Number(event.target.value) || 1))} /></label>
        {pokemon ? <label><span>Animación en movimiento</span><select value={movementAnimation} onChange={event => setMovementAnimation(event.target.value)}>
          {animations.map(animation => <option key={animation}>{animation}</option>)}
        </select></label> : <label><span>Animación en movimiento</span><input value="Caminar" readOnly /></label>}
        {pokemon ? <label><span>Animación final</span><select value={finalAnimation} onChange={event => setFinalAnimation(event.target.value)}>
          {animations.map(animation => <option key={animation}>{animation}</option>)}
        </select></label> : <label><span>Animación final</span><input value="Idle" readOnly /></label>}
        <label><span>Orientación final</span><select value={direction} onChange={event => setDirection(event.target.value as typeof direction)}>
          <option value="up">Arriba</option><option value="down">Abajo</option>
          <option value="left">Izquierda</option><option value="right">Derecha</option>
        </select></label>
        <label><span>Pausa al llegar (ms)</span><input type="number" min="0" value={pause} onChange={event => setPause(Math.max(0, Number(event.target.value) || 0))} /></label>
      </div>
      {!sequenceId && usage === 'ambient' ? <label><span>Comportamiento</span><select value={playbackMode} onChange={event => setPlaybackMode(event.target.value as typeof playbackMode)}>
        <option value="once">Una vez hasta salir del sector</option>
        <option value="pingPong">Ida y vuelta continuamente</option>
        <option value="loop">Circuito continuo</option>
      </select></label> : null}
      {!sequenceId && usage === 'event' ? <>
        <label><span>Se activa al</span><select value={activationKind} onChange={event => setActivationKind(event.target.value as MapEventActivationKind)}>
          {MAP_EVENT_ACTIVATION_KINDS.map(kind => <option key={kind} value={kind}>{ACTIVATION_LABELS[kind]}</option>)}
        </select></label>
        <label><span>Repetición</span><select value={repeatPolicy} onChange={event => setRepeatPolicy(event.target.value as MapEventRepeatPolicy)}>
          {MAP_EVENT_REPEAT_POLICIES.map(policy => <option key={policy} value={policy}>{REPEAT_LABELS[policy]}</option>)}
        </select></label>
        {repeatPolicy === 'repeatable' ? <p>El editor añadirá automáticamente el recorrido inverso para dejar a la entidad en su posición inicial.</p> : null}
        {activationKind !== 'enterZone' ? <>
          <label><span>Objetivo</span><select value={targetPlacementId} onChange={event => setTargetPlacementId(event.target.value)}>
            <option value="">Área inicial de la ruta</option>
            {actors.map(actor => <option key={actor.placementId} value={actor.placementId}>{actor.placementId}</option>)}
          </select></label>
          <label><span>Distancia (tiles)</span><input type="number" min="1" value={rangeTiles} onChange={event => setRangeTiles(Math.max(1, Number(event.target.value) || 1))} /></label>
        </> : null}
        {(activationKind === 'enterZone' || !targetPlacementId) ? <div className="editor-movement-events__zone">
          <button type="button" onClick={() => window.dispatchEvent(new CustomEvent(
            'pokediscover:select-map-tool',
            { detail: { tool: 'event-zone' } },
          ))}>{triggerZone ? 'Redibujar área' : 'Dibujar área en el mapa'}</button>
          <span>{triggerZone
            ? `${Math.round(triggerZone.width)}×${Math.round(triggerZone.height)} px`
            : 'Si no la dibujas se usará la celda inicial de la ruta.'}</span>
        </div> : null}
        {activationKind === 'contextAction' ? <label><span>Texto de la acción</span><input value={prompt} onChange={event => setPrompt(event.target.value)} /></label> : null}
      </> : null}
      {error ? <p role="alert">{error}</p> : null}
      <footer>
        <button type="button" onClick={onCancelDraft}>Cancelar ruta</button>
        <button type="button" className="is-primary" onClick={confirm}>Confirmar ruta</button>
      </footer>
    </fieldset> : null}
    {availableSequences.length ? <details>
      <summary>Edición avanzada</summary>
      {activeMapSequence ? <div className="editor-movement-events__advanced">
        <p>Las acciones añadidas al mismo paso se ejecutan a la vez. Si el actor ya participa, se crea un paso posterior.</p>
        <label><span>Actor adicional</span><select value={advancedActorId} onChange={event => setAdvancedActorId(event.target.value)}>
          {actors.map(actor => <option key={actor.placementId}>{actor.placementId}</option>)}
        </select></label>
        <label><span>Acción</span><select value={advancedKind} onChange={event => setAdvancedKind(event.target.value as typeof advancedKind)}>
          <option value="face">Cambiar orientación</option>
          <option value="setVisible">Mostrar</option>
          <option value="playAnimation" disabled={!selectedAdvancedAnimations.length}>Reproducir animación</option>
        </select></label>
        {advancedKind === 'face' ? <label><span>Orientación</span><select value={direction} onChange={event => setDirection(event.target.value as typeof direction)}>
          <option value="up">Arriba</option><option value="down">Abajo</option>
          <option value="left">Izquierda</option><option value="right">Derecha</option>
        </select></label> : null}
        <button type="button" onClick={addAdvancedAction}>Añadir acción al guion</button>
        <p>Para añadir otra ruta, selecciona ese actor y dibújala con Shift mientras este evento siga activo.</p>
      </div> : <p>Los pasos, acciones paralelas y pausas del movimiento automático se editan en el guion inferior.</p>}
    </details> : null}
  </section>;
}
