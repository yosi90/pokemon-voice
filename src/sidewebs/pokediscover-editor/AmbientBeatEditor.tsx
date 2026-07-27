import { useEffect, useMemo, useState } from 'react';
import type {
  AdventureMapV3,
  AmbientActorActionV1,
  AmbientBeatV1,
  AmbientSequenceV3,
} from '../../../packages/contracts/src/index.js';
import type { LoadedAdventureMapBundle, LoadedAdventureSectorBundle } from '../../domain/maps/loadAdventureBundle.js';
import {
  nextStableEditorId,
  replaceAmbientAction,
  replaceAmbientBeat,
  replaceAmbientSequence,
} from '../../domain/tools/pokeDiscoverEditorBeats.js';
import { readPokeDiscoverEditorTiledReferences } from '../../domain/tools/pokeDiscoverEditorTiledReferences.js';

const DIRECTIONS = Object.freeze(['down', 'left', 'right', 'up'] as const);

function defaultAction(
  sectorBundle: LoadedAdventureSectorBundle,
  preferredPlacementId?: string,
): AmbientActorActionV1 | undefined {
  const placements = [
    ...sectorBundle.adventure.actorPlacements,
    ...sectorBundle.adventure.characterPlacements.filter(candidate => !candidate.controllable),
  ].filter(candidate => candidate.sectorId === sectorBundle.sector.sectorId);
  const placement = placements.find(candidate => candidate.placementId === preferredPlacementId)
    ?? placements[0];
  if (!placement) return undefined;
  const animation = sectorBundle.actorAssets.get(placement.assetId)?.animations
    .find(candidate => candidate.name === 'Idle')
    ?? sectorBundle.actorAssets.get(placement.assetId)?.animations[0];
  if (!animation) return {
    kind: 'face',
    placementId: placement.placementId,
    direction: placement.direction ?? 'down',
  };
  return {
    kind: 'playAnimation',
    placementId: placement.placementId,
    animation: animation.name,
    direction: placement.direction ?? 'down',
  };
}

function bundleWithAdventure(bundle: LoadedAdventureMapBundle, adventure: AdventureMapV3) {
  const sectorsById = new Map(adventure.sectors.map(sector => [sector.sectorId, sector]));
  const pmdById = new Map(bundle.pmdManifest.assets.map(asset => [asset.assetId, asset]));
  const charactersById = new Map(bundle.characterManifest.assets.map(asset => [asset.assetId, asset]));
  return {
    ...bundle,
    adventure,
    sectors: bundle.sectors.map(sectorBundle => ({
      ...sectorBundle,
      adventure,
      sector: sectorsById.get(sectorBundle.sector.sectorId) ?? sectorBundle.sector,
      actorAssets: new Map(adventure.actorPlacements
        .filter(placement => placement.sectorId === sectorBundle.sector.sectorId)
        .flatMap(placement => {
          const asset = pmdById.get(placement.assetId);
          return asset ? [[asset.assetId, asset] as const] : [];
        })),
      characterAssets: new Map(adventure.characterPlacements
        .filter(placement => placement.sectorId === sectorBundle.sector.sectorId)
        .flatMap(placement => {
          const asset = charactersById.get(placement.assetId);
          return asset ? [[asset.assetId, asset] as const] : [];
        })),
    })),
  };
}

export function applyEditorAdventure(bundle: LoadedAdventureMapBundle, adventure: AdventureMapV3) {
  return bundleWithAdventure(bundle, adventure);
}

export function AmbientBeatEditor({
  bundle,
  room,
  onAdventureChange,
  initialPlacementId,
  embedded = false,
}: {
  bundle: LoadedAdventureMapBundle;
  room: LoadedAdventureSectorBundle;
  onAdventureChange: (adventure: AdventureMapV3) => void;
  initialPlacementId?: string;
  embedded?: boolean;
}) {
  const roomSequences = bundle.adventure.ambientSequences.filter(sequence => sequence.sectorId === room.sector.sectorId);
  const visibleSequences = initialPlacementId
    ? roomSequences.filter(candidate => candidate.beats.some(candidateBeat => (
      candidateBeat.actions.some(candidateAction => candidateAction.placementId === initialPlacementId)
    )))
    : roomSequences;
  const [sequenceId, setSequenceId] = useState('');
  const [beatId, setBeatId] = useState('');
  const [actionIndex, setActionIndex] = useState(0);
  const sequence = visibleSequences.find(candidate => candidate.sequenceId === sequenceId)
    ?? visibleSequences[0];
  const beat = sequence?.beats.find(candidate => candidate.beatId === beatId) ?? sequence?.beats[0];
  const selectedActionIndex = beat?.actions[actionIndex] ? actionIndex : 0;
  const action = beat?.actions[selectedActionIndex];
  const actors = [
    ...bundle.adventure.actorPlacements,
    ...bundle.adventure.characterPlacements.filter(placement => !placement.controllable),
  ].filter(placement => placement.sectorId === room.sector.sectorId);
  const paths = useMemo(() => readPokeDiscoverEditorTiledReferences(room.tilemap).paths, [room.tilemap]);
  const selectedPlacement = actors.find(placement => placement.placementId === action?.placementId) ?? actors[0];
  const animations = selectedPlacement
    ? room.actorAssets.get(selectedPlacement.assetId)?.animations ?? []
    : [];

  useEffect(() => {
    if (!initialPlacementId) return;
    const nextSequence = visibleSequences.find(candidate => candidate.beats.some(candidateBeat => (
      candidateBeat.actions.some(candidateAction => candidateAction.placementId === initialPlacementId)
    )));
    setSequenceId(nextSequence?.sequenceId ?? '');
    const nextBeat = nextSequence?.beats.find(candidateBeat => (
      candidateBeat.actions.some(candidateAction => candidateAction.placementId === initialPlacementId)
    ));
    setBeatId(nextBeat?.beatId ?? '');
    setActionIndex(Math.max(0, nextBeat?.actions.findIndex(candidateAction => (
      candidateAction.placementId === initialPlacementId
    )) ?? 0));
  }, [initialPlacementId, room.sector.sectorId]);

  const commitSequence = (nextSequence: AmbientSequenceV3) => {
    onAdventureChange(replaceAmbientSequence(bundle.adventure, nextSequence));
  };
  const commitBeat = (nextBeat: AmbientBeatV1) => {
    if (sequence) commitSequence(replaceAmbientBeat(sequence, nextBeat));
  };
  const commitAction = (nextAction: AmbientActorActionV1) => {
    if (beat) commitBeat(replaceAmbientAction(beat, selectedActionIndex, nextAction));
  };

  const createSequence = () => {
    const firstAction = defaultAction(room, initialPlacementId);
    if (!firstAction) return;
    const nextSequenceId = nextStableEditorId(
      `ambient:${room.sector.sectorId.split(':').at(-1)}`,
      bundle.adventure.ambientSequences.map(candidate => candidate.sequenceId),
    );
    const nextBeatId = `beat:${nextSequenceId.split(':').slice(1).join(':')}:01`;
    const nextSequence: AmbientSequenceV3 = {
      schemaVersion: 1,
      sequenceId: nextSequenceId,
      sectorId: room.sector.sectorId,
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
    const firstAction = defaultAction(room, initialPlacementId);
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
    const nextAction = defaultAction(room, initialPlacementId);
    if (!nextAction) return;
    commitBeat({ ...beat, actions: [...beat.actions, nextAction] });
    setActionIndex(beat.actions.length);
  };

  const changeActionKind = (kind: AmbientActorActionV1['kind']) => {
    if (!selectedPlacement) return;
    if (kind === 'setVisible') {
      commitAction({ kind, placementId: selectedPlacement.placementId, visible: true });
      return;
    }
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
    if (action.kind === 'face' || action.kind === 'setVisible') commitAction({ ...action, placementId });
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

  const removeSequence = () => {
    if (!sequence) return;
    onAdventureChange({
      ...bundle.adventure,
      ambientSequences: bundle.adventure.ambientSequences.filter(candidate => candidate.sequenceId !== sequence.sequenceId),
    });
    setSequenceId('');
    setBeatId('');
    setActionIndex(0);
  };

  const moveBeat = (direction: -1 | 1) => {
    if (!sequence || !beat) return;
    const index = sequence.beats.findIndex(candidate => candidate.beatId === beat.beatId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= sequence.beats.length) return;
    const beats = [...sequence.beats];
    [beats[index], beats[target]] = [beats[target], beats[index]];
    commitSequence({ ...sequence, beats });
  };

  const removeBeat = () => {
    if (!sequence || !beat || sequence.beats.length <= 1) return;
    const index = sequence.beats.findIndex(candidate => candidate.beatId === beat.beatId);
    const beats = sequence.beats.filter(candidate => candidate.beatId !== beat.beatId);
    commitSequence({ ...sequence, beats });
    setBeatId(beats[Math.min(index, beats.length - 1)].beatId);
    setActionIndex(0);
  };

  const moveAction = (direction: -1 | 1) => {
    if (!beat || !action) return;
    const target = selectedActionIndex + direction;
    if (target < 0 || target >= beat.actions.length) return;
    const actions = [...beat.actions];
    [actions[selectedActionIndex], actions[target]] = [actions[target], actions[selectedActionIndex]];
    commitBeat({ ...beat, actions });
    setActionIndex(target);
  };

  const duplicateAction = () => {
    if (!beat || !action) return;
    const actions = [...beat.actions];
    actions.splice(selectedActionIndex + 1, 0, { ...action });
    commitBeat({ ...beat, actions });
    setActionIndex(selectedActionIndex + 1);
  };

  const removeAction = () => {
    if (!beat || beat.actions.length <= 1) return;
    const actions = beat.actions.filter((_, index) => index !== selectedActionIndex);
    commitBeat({ ...beat, actions });
    setActionIndex(Math.min(selectedActionIndex, actions.length - 1));
  };

  return (
    <section className={`editor-beats${embedded ? ' is-embedded' : ''}`} aria-labelledby="editor-beats-title">
      <header>
        <div>
          <span className="editor-eyebrow">Escena de la sector</span>
          <h2 id="editor-beats-title">{embedded ? 'Guion automático' : 'Pasos de animación y movimiento'}</h2>
          <p>Organiza qué hace cada personaje y en qué orden.</p>
        </div>
        <span>Sector activa</span>
      </header>

      {!sequence ? (
        <div className="editor-beats__empty">
          <p>Esta sector todavía no contiene secuencias ambientales.</p>
          <button type="button" disabled={!actors.length} onClick={createSequence}>Crear secuencia</button>
        </div>
      ) : (
        <div className="editor-beats__layout">
          <aside>
            <label>
              <span>Secuencia</span>
              <select value={sequence.sequenceId} onChange={event => { setSequenceId(event.target.value); setBeatId(''); setActionIndex(0); }}>
                {visibleSequences.map((candidate, index) => <option key={candidate.sequenceId} value={candidate.sequenceId}>Secuencia {index + 1}</option>)}
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
            <div className="editor-beats__ordering">
              <button type="button" disabled={sequence.beats[0]?.beatId === beat?.beatId} onClick={() => moveBeat(-1)}>Subir</button>
              <button type="button" disabled={sequence.beats.at(-1)?.beatId === beat?.beatId} onClick={() => moveBeat(1)}>Bajar</button>
              <button type="button" disabled={sequence.beats.length <= 1} onClick={removeBeat}>Eliminar paso</button>
            </div>
            <button type="button" className="is-danger" onClick={removeSequence}>Eliminar secuencia</button>
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
                <button type="button" onClick={duplicateAction}>Duplicar acción</button>
                <button type="button" disabled={selectedActionIndex === 0} onClick={() => moveAction(-1)}>Anterior</button>
                <button type="button" disabled={selectedActionIndex >= beat.actions.length - 1} onClick={() => moveAction(1)}>Siguiente</button>
                <button type="button" disabled={beat.actions.length <= 1} onClick={removeAction}>Eliminar</button>
              </div>
              <div className="editor-beats__grid">
                <label><span>Tipo</span><select value={action.kind} onChange={event => changeActionKind(event.target.value as AmbientActorActionV1['kind'])}>
                  <option value="playAnimation" disabled={!animations.length}>Animación</option><option value="face">Orientación</option><option value="movePath" disabled={!paths.length}>Movimiento por ruta</option><option value="moveByTiles">Desplazamiento relativo</option><option value="setVisible">Mostrar u ocultar</option>
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

                {action.kind === 'setVisible' ? <label className="editor-beats__check"><input type="checkbox" checked={action.visible} onChange={event => commitAction({ ...action, visible: event.target.checked })} /><span>Entidad visible</span></label> : null}

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
