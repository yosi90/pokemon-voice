import { useMemo, useState } from 'react';
import type {
  AdventureMapV2,
  AmbientActorActionV1,
  AmbientBeatV1,
  AmbientSequenceV1,
} from '../../../packages/contracts/src/index.js';
import type { LoadedAdventureMapBundle, LoadedAdventureRoomBundle } from '../../domain/maps/loadAdventureBundle.js';
import {
  nextStableEditorId,
  replaceAmbientAction,
  replaceAmbientBeat,
  replaceAmbientSequence,
} from '../../domain/tools/pokeDiscoverEditorBeats.js';
import { readPokeDiscoverEditorTiledReferences } from '../../domain/tools/pokeDiscoverEditorTiledReferences.js';

const DIRECTIONS = Object.freeze(['down', 'left', 'right', 'up'] as const);

function defaultAction(room: LoadedAdventureRoomBundle): AmbientActorActionV1 | undefined {
  const placement = room.adventure.actorPlacements.find(candidate => candidate.roomId === room.room.roomId);
  if (!placement) return undefined;
  const animation = room.actorAssets.get(placement.assetId)?.animations.find(candidate => candidate.name === 'Idle')
    ?? room.actorAssets.get(placement.assetId)?.animations[0];
  if (!animation) return undefined;
  return {
    kind: 'playAnimation',
    placementId: placement.placementId,
    animation: animation.name,
    direction: placement.direction ?? 'down',
  };
}

function bundleWithAdventure(bundle: LoadedAdventureMapBundle, adventure: AdventureMapV2) {
  const roomsById = new Map(adventure.rooms.map(room => [room.roomId, room]));
  const pmdById = new Map(bundle.pmdManifest.assets.map(asset => [asset.assetId, asset]));
  const charactersById = new Map(bundle.characterManifest.assets.map(asset => [asset.assetId, asset]));
  return {
    ...bundle,
    adventure,
    rooms: bundle.rooms.map(room => ({
      ...room,
      adventure,
      room: roomsById.get(room.room.roomId) ?? room.room,
      actorAssets: new Map(adventure.actorPlacements
        .filter(placement => placement.roomId === room.room.roomId)
        .flatMap(placement => {
          const asset = pmdById.get(placement.assetId);
          return asset ? [[asset.assetId, asset] as const] : [];
        })),
      characterAssets: new Map(adventure.characterPlacements
        .filter(placement => placement.roomId === room.room.roomId)
        .flatMap(placement => {
          const asset = charactersById.get(placement.assetId);
          return asset ? [[asset.assetId, asset] as const] : [];
        })),
    })),
  };
}

export function applyEditorAdventure(bundle: LoadedAdventureMapBundle, adventure: AdventureMapV2) {
  return bundleWithAdventure(bundle, adventure);
}

export function AmbientBeatEditor({
  bundle,
  room,
  onAdventureChange,
}: {
  bundle: LoadedAdventureMapBundle;
  room: LoadedAdventureRoomBundle;
  onAdventureChange: (adventure: AdventureMapV2) => void;
}) {
  const roomSequences = bundle.adventure.ambientSequences.filter(sequence => sequence.roomId === room.room.roomId);
  const [sequenceId, setSequenceId] = useState('');
  const [beatId, setBeatId] = useState('');
  const [actionIndex, setActionIndex] = useState(0);
  const sequence = roomSequences.find(candidate => candidate.sequenceId === sequenceId) ?? roomSequences[0];
  const beat = sequence?.beats.find(candidate => candidate.beatId === beatId) ?? sequence?.beats[0];
  const selectedActionIndex = beat?.actions[actionIndex] ? actionIndex : 0;
  const action = beat?.actions[selectedActionIndex];
  const actors = bundle.adventure.actorPlacements.filter(placement => placement.roomId === room.room.roomId);
  const paths = useMemo(() => readPokeDiscoverEditorTiledReferences(room.tilemap).paths, [room.tilemap]);
  const selectedPlacement = actors.find(placement => placement.placementId === action?.placementId) ?? actors[0];
  const animations = selectedPlacement
    ? room.actorAssets.get(selectedPlacement.assetId)?.animations ?? []
    : [];

  const commitSequence = (nextSequence: AmbientSequenceV1) => {
    onAdventureChange(replaceAmbientSequence(bundle.adventure, nextSequence));
  };
  const commitBeat = (nextBeat: AmbientBeatV1) => {
    if (sequence) commitSequence(replaceAmbientBeat(sequence, nextBeat));
  };
  const commitAction = (nextAction: AmbientActorActionV1) => {
    if (beat) commitBeat(replaceAmbientAction(beat, selectedActionIndex, nextAction));
  };

  const createSequence = () => {
    const firstAction = defaultAction(room);
    if (!firstAction) return;
    const nextSequenceId = nextStableEditorId(
      `ambient:${room.room.roomId.split(':').at(-1)}`,
      bundle.adventure.ambientSequences.map(candidate => candidate.sequenceId),
    );
    const nextBeatId = `beat:${nextSequenceId.split(':').slice(1).join(':')}:editor-1`;
    const nextSequence: AmbientSequenceV1 = {
      schemaVersion: 1,
      sequenceId: nextSequenceId,
      roomId: room.room.roomId,
      loop: true,
      blockedPolicy: 'pauseSequence',
      beats: [{ schemaVersion: 1, beatId: nextBeatId, actions: [firstAction] }],
    };
    onAdventureChange({
      ...bundle.adventure,
      ambientSequences: [...bundle.adventure.ambientSequences, nextSequence],
    });
    setSequenceId(nextSequenceId);
    setBeatId(nextBeatId);
    setActionIndex(0);
  };

  const addBeat = () => {
    if (!sequence) return;
    const firstAction = defaultAction(room);
    if (!firstAction) return;
    const nextBeatId = nextStableEditorId(
      `beat:${sequence.sequenceId.split(':').slice(1).join(':')}`,
      sequence.beats.map(candidate => candidate.beatId),
    );
    commitSequence({
      ...sequence,
      beats: [...sequence.beats, { schemaVersion: 1, beatId: nextBeatId, actions: [firstAction] }],
    });
    setBeatId(nextBeatId);
    setActionIndex(0);
  };

  const duplicateBeat = () => {
    if (!sequence || !beat) return;
    const nextBeatId = nextStableEditorId(
      `beat:${sequence.sequenceId.split(':').slice(1).join(':')}`,
      sequence.beats.map(candidate => candidate.beatId),
    );
    commitSequence({
      ...sequence,
      beats: [...sequence.beats, {
        ...beat,
        beatId: nextBeatId,
        actions: beat.actions.map(action => ({ ...action })),
      }],
    });
    setBeatId(nextBeatId);
    setActionIndex(0);
  };

  const addAction = () => {
    if (!beat) return;
    const nextAction = defaultAction(room);
    if (!nextAction) return;
    commitBeat({ ...beat, actions: [...beat.actions, nextAction] });
    setActionIndex(beat.actions.length);
  };

  const changeActionKind = (kind: AmbientActorActionV1['kind']) => {
    if (!selectedPlacement) return;
    if (kind === 'face') {
      commitAction({ kind, placementId: selectedPlacement.placementId, direction: selectedPlacement.direction ?? 'down' });
      return;
    }
    const animation = animations.find(candidate => candidate.name === 'Idle') ?? animations[0];
    if (kind === 'movePath') {
      if (!paths[0]) return;
      commitAction({
        kind,
        placementId: selectedPlacement.placementId,
        pathId: paths[0].pathId,
        movementStyle: 'continuous',
        speedPixelsPerSecond: 32,
        ...(animation ? { animation: animation.name } : {}),
      });
      return;
    }
    if (kind === 'moveByTiles') {
      commitAction({ kind, placementId: selectedPlacement.placementId, deltaXTiles: 0, deltaYTiles: 0, movementStyle: 'grid', speedPixelsPerSecond: 48, ...(animation ? { animation: animation.name } : {}) });
      return;
    }
    if (animation) commitAction({
      kind,
      placementId: selectedPlacement.placementId,
      animation: animation.name,
      direction: selectedPlacement.direction ?? 'down',
    });
  };

  const changeActor = (placementId: string) => {
    if (!action) return;
    const placement = actors.find(candidate => candidate.placementId === placementId);
    const nextAnimations = placement ? room.actorAssets.get(placement.assetId)?.animations ?? [] : [];
    const nextAnimation = nextAnimations.find(candidate => candidate.name === ('animation' in action ? action.animation : ''))
      ?? nextAnimations.find(candidate => candidate.name === 'Idle')
      ?? nextAnimations[0];
    if (action.kind === 'face') commitAction({ ...action, placementId });
    else if (action.kind === 'playAnimation' && nextAnimation) {
      commitAction({ ...action, placementId, animation: nextAnimation.name });
    } else if (action.kind === 'movePath' || action.kind === 'moveByTiles') {
      commitAction({ ...action, placementId, ...(nextAnimation ? { animation: nextAnimation.name } : {}) });
    }
  };

  const setPauseMode = (mode: 'fixed' | 'range') => {
    if (!beat) return;
    const current = beat.pauseAfterMs;
    const value = typeof current === 'number' ? current : current?.min ?? 0;
    commitBeat({ ...beat, pauseAfterMs: mode === 'range' ? { min: value, max: typeof current === 'object' ? current.max : value } : value });
  };

  return (
    <section className="editor-beats" aria-labelledby="editor-beats-title">
      <header>
        <div>
          <span className="editor-eyebrow">Escena de la habitación</span>
          <h2 id="editor-beats-title">Pasos de animación y movimiento</h2>
          <p>Organiza qué hace cada personaje y en qué orden.</p>
        </div>
        <span>Habitación activa</span>
      </header>

      {!sequence ? (
        <div className="editor-beats__empty">
          <p>Esta habitación todavía no contiene secuencias ambientales.</p>
          <button type="button" disabled={!actors.length} onClick={createSequence}>Crear secuencia</button>
        </div>
      ) : (
        <div className="editor-beats__layout">
          <aside>
            <label>
              <span>Secuencia</span>
              <select value={sequence.sequenceId} onChange={event => { setSequenceId(event.target.value); setBeatId(''); setActionIndex(0); }}>
                {roomSequences.map((candidate, index) => <option key={candidate.sequenceId} value={candidate.sequenceId}>Secuencia {index + 1}</option>)}
              </select>
            </label>
            <div className="editor-beats__list" role="listbox" aria-label="Pasos de la secuencia">
              {sequence.beats.map((candidate, index) => (
                <button
                  key={candidate.beatId}
                  type="button"
                  role="option"
                  aria-selected={candidate.beatId === beat?.beatId}
                  onClick={() => { setBeatId(candidate.beatId); setActionIndex(0); }}
                >
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <strong>Paso {index + 1}</strong>
                  <small>{candidate.actions.length} acciones</small>
                </button>
              ))}
            </div>
            <button type="button" className="editor-beats__add" onClick={addBeat}>Añadir paso</button>
            <button type="button" className="editor-beats__add" disabled={!beat} onClick={duplicateBeat}>Duplicar paso</button>
          </aside>

          {beat && action ? (
            <div className="editor-beats__form">
              <details><summary>Detalles avanzados</summary><code>{sequence.sequenceId} · {beat.beatId}</code></details>
              <fieldset className="editor-beats__pause">
                <legend>Final de la secuencia</legend>
                <label><span>Comportamiento</span><select value={sequence.playbackMode ?? (sequence.loop ? 'loop' : 'once')} onChange={event => {
                  const playbackMode = event.target.value as 'loop' | 'pingPong' | 'once';
                  commitSequence({ ...sequence, playbackMode, loop: playbackMode !== 'once' });
                }}>
                  <option value="loop">Reiniciar desde el principio</option>
                  <option value="pingPong">Volver sobre sí misma</option>
                  <option value="once">Terminar y conservar posición</option>
                </select></label>
              </fieldset>
              <div className="editor-beats__actions">
                <label>
                  <span>Acción del paso</span>
                  <select value={selectedActionIndex} onChange={event => setActionIndex(Number(event.target.value))}>
                    {beat.actions.map((candidate, index) => (
                      <option key={`${candidate.placementId}:${index}`} value={index}>Acción {index + 1} · {candidate.kind}</option>
                    ))}
                  </select>
                </label>
                <button type="button" onClick={addAction}>Añadir acción</button>
              </div>
              <div className="editor-beats__grid">
                <label><span>Tipo</span><select value={action.kind} onChange={event => changeActionKind(event.target.value as AmbientActorActionV1['kind'])}>
                  <option value="playAnimation">Animación</option><option value="face">Orientación</option><option value="movePath" disabled={!paths.length}>Movimiento por ruta</option><option value="moveByTiles">Desplazamiento relativo</option>
                </select></label>
                <label><span>Actor</span><select value={action.placementId} onChange={event => changeActor(event.target.value)}>
                  {actors.map(actor => <option key={actor.placementId}>{actor.placementId}</option>)}
                </select></label>

                {action.kind === 'playAnimation' ? <>
                  <label><span>Animación</span><select value={action.animation} onChange={event => commitAction({ ...action, animation: event.target.value })}>
                    {animations.map(animation => <option key={animation.name}>{animation.name}</option>)}
                  </select></label>
                  <label><span>Dirección</span><select value={action.direction ?? ''} onChange={event => commitAction({ ...action, direction: event.target.value ? event.target.value as typeof DIRECTIONS[number] : undefined })}>
                    <option value="">Conservar</option>{DIRECTIONS.map(direction => <option key={direction}>{direction}</option>)}
                  </select></label>
                </> : null}

                {action.kind === 'face' ? <label><span>Dirección</span><select value={action.direction} onChange={event => commitAction({ ...action, direction: event.target.value as typeof DIRECTIONS[number] })}>
                  {DIRECTIONS.map(direction => <option key={direction}>{direction}</option>)}
                </select></label> : null}

                {action.kind === 'movePath' ? <>
                  <label><span>Ruta</span><select value={action.pathId} onChange={event => commitAction({ ...action, pathId: event.target.value })}>
                    {paths.map(path => <option key={path.pathId}>{path.pathId}</option>)}
                  </select></label>
                  <label><span>Movimiento</span><select value={action.movementStyle} onChange={event => commitAction({ ...action, movementStyle: event.target.value as 'grid' | 'continuous' })}>
                    <option value="continuous">Continuo</option><option value="grid">Cuadrícula</option>
                  </select></label>
                  <label><span>Velocidad (px/s)</span><input type="number" min="1" value={action.speedPixelsPerSecond} onChange={event => commitAction({ ...action, speedPixelsPerSecond: Math.max(1, Number(event.target.value) || 1) })} /></label>
                  <label><span>Animación</span><select value={action.animation ?? ''} onChange={event => commitAction({ ...action, animation: event.target.value || undefined })}>
                    <option value="">Sin animación</option>{animations.map(animation => <option key={animation.name}>{animation.name}</option>)}
                  </select></label>
                  <label className="editor-beats__check"><input type="checkbox" checked={action.reverse ?? false} onChange={event => commitAction({ ...action, reverse: event.target.checked || undefined })} /><span>Recorrer al revés</span></label>
                </> : null}

                {action.kind === 'moveByTiles' ? <>
                  <label><span>Horizontal (tiles)</span><input type="number" step="1" value={action.deltaXTiles} onChange={event => commitAction({ ...action, deltaXTiles: Math.trunc(Number(event.target.value) || 0) })} /></label>
                  <label><span>Vertical (tiles)</span><input type="number" step="1" value={action.deltaYTiles} onChange={event => commitAction({ ...action, deltaYTiles: Math.trunc(Number(event.target.value) || 0) })} /></label>
                  <label><span>Movimiento</span><select value={action.movementStyle} onChange={event => commitAction({ ...action, movementStyle: event.target.value as 'grid' | 'continuous' })}><option value="continuous">Continuo</option><option value="grid">Cuadrícula</option></select></label>
                  <label><span>Velocidad (px/s)</span><input type="number" min="1" value={action.speedPixelsPerSecond} onChange={event => commitAction({ ...action, speedPixelsPerSecond: Math.max(1, Number(event.target.value) || 1) })} /></label>
                  <label><span>Animación</span><select value={action.animation ?? ''} onChange={event => commitAction({ ...action, animation: event.target.value || undefined })}><option value="">Sin animación</option>{animations.map(animation => <option key={animation.name}>{animation.name}</option>)}</select></label>
                </> : null}
              </div>

              <fieldset className="editor-beats__pause">
                <legend>Pausa posterior</legend>
                <label><span>Modo</span><select value={typeof beat.pauseAfterMs === 'object' ? 'range' : 'fixed'} onChange={event => setPauseMode(event.target.value as 'fixed' | 'range')}>
                  <option value="fixed">Exacta</option><option value="range">Intervalo</option>
                </select></label>
                {typeof beat.pauseAfterMs === 'object' ? <>
                  <label><span>Mínimo (ms)</span><input type="number" min="0" value={beat.pauseAfterMs.min} onChange={event => commitBeat({ ...beat, pauseAfterMs: { ...beat.pauseAfterMs as { min: number; max: number }, min: Math.max(0, Number(event.target.value) || 0) } })} /></label>
                  <label><span>Máximo (ms)</span><input type="number" min="0" value={beat.pauseAfterMs.max} onChange={event => commitBeat({ ...beat, pauseAfterMs: { ...beat.pauseAfterMs as { min: number; max: number }, max: Math.max(0, Number(event.target.value) || 0) } })} /></label>
                </> : <label><span>Duración (ms)</span><input type="number" min="0" value={beat.pauseAfterMs ?? 0} onChange={event => commitBeat({ ...beat, pauseAfterMs: Math.max(0, Number(event.target.value) || 0) })} /></label>}
              </fieldset>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
