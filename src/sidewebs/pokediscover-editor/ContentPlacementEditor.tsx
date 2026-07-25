import { useEffect, useMemo, useState } from 'react';
import type { AdventureMapV2 } from '../../../packages/contracts/src/index.js';
import type { LoadedAdventureMapBundle, LoadedAdventureRoomBundle } from '../../domain/maps/loadAdventureBundle.js';
import {
  getPokeDiscoverEditorContentMarkers,
  type PokeDiscoverEditorContentKind,
} from '../../domain/tools/pokeDiscoverEditorContent.js';
import { nextStableEditorId } from '../../domain/tools/pokeDiscoverEditorBeats.js';
import {
  readPokeDiscoverEditorAnchors,
  readPokeDiscoverEditorTiledReferences,
  type PokeDiscoverEditorAnchorClass,
} from '../../domain/tools/pokeDiscoverEditorTiledReferences.js';

const KIND_LABELS: Record<PokeDiscoverEditorContentKind, string> = {
  encounter: 'Encuentro Pokémon',
  npc: 'NPC',
  portal: 'Portal',
  secret: 'Secreto',
  trigger: 'Trigger',
};

const ANCHOR_CLASSES: Record<PokeDiscoverEditorContentKind, PokeDiscoverEditorAnchorClass[]> = {
  encounter: ['EncounterAnchor', 'ActorAnchor'],
  npc: ['ActorAnchor'],
  portal: ['TransitionAnchor'],
  secret: ['SecretAnchor'],
  trigger: ['InteractionAnchor'],
};

export function ContentPlacementEditor({
  bundle,
  room,
  onAdventureChange,
  selectedPlacementId = '',
  onPlacementSelect,
  onPlacementPreview,
  catalogSelection,
  onOpenCatalog,
  onChooseMapTool,
}: {
  bundle: LoadedAdventureMapBundle;
  room: LoadedAdventureRoomBundle;
  onAdventureChange: (adventure: AdventureMapV2) => void;
  selectedPlacementId?: string;
  onPlacementSelect?: (placementId: string) => void;
  onPlacementPreview?: (preview?: { anchorId: string; label: string; scalePercent: number }) => void;
  catalogSelection?: { assetId: string; animation: string };
  onOpenCatalog?: () => void;
  onChooseMapTool?: (tool: 'anchor' | 'path') => void;
}) {
  const [kind, setKind] = useState<PokeDiscoverEditorContentKind>('encounter');
  const [anchorId, setAnchorId] = useState('');
  const [assetId, setAssetId] = useState('');
  const [animationName, setAnimationName] = useState('Idle');
  const [prompt, setPrompt] = useState('Contenido pendiente de configurar.');
  const [destinationAnchorId, setDestinationAnchorId] = useState('');
  const [scalePercent, setScalePercent] = useState(100);
  const [movementMode, setMovementMode] = useState<'none' | 'path' | 'tiles'>('none');
  const [pathId, setPathId] = useState('');
  const [deltaX, setDeltaX] = useState(1);
  const [deltaY, setDeltaY] = useState(0);
  const [speed, setSpeed] = useState(48);
  const [pauseMs, setPauseMs] = useState(0);
  const [playbackMode, setPlaybackMode] = useState<'loop' | 'pingPong' | 'once'>('loop');
  const [direction, setDirection] = useState<'up' | 'down' | 'left' | 'right'>('down');
  const [collision, setCollision] = useState<'solid' | 'pass-through'>('solid');
  const [visible, setVisible] = useState(true);
  const anchors = useMemo(() => readPokeDiscoverEditorAnchors(room.tilemap), [room.tilemap]);
  const availableAnchors = anchors.filter(anchor => ANCHOR_CLASSES[kind].includes(anchor.anchorClass));
  const selectedAnchor = availableAnchors.find(anchor => anchor.anchorId === anchorId) ?? availableAnchors[0];
  const selectedPmdAsset = bundle.pmdManifest.assets.find(asset => asset.assetId === assetId)
    ?? bundle.pmdManifest.assets[0];
  const selectedCharacterAsset = bundle.characterManifest.assets.find(asset => asset.assetId === assetId)
    ?? bundle.characterManifest.assets[0];
  const selectedAnimation = selectedPmdAsset?.animations.find(animation => animation.name === animationName)
    ?? selectedPmdAsset?.animations.find(animation => animation.name === 'Idle')
    ?? selectedPmdAsset?.animations[0];
  const transitionAnchors = anchors.filter(anchor => anchor.anchorClass === 'TransitionAnchor');
  const destinationAnchor = transitionAnchors.find(anchor => anchor.anchorId === destinationAnchorId)
    ?? transitionAnchors.find(anchor => anchor.anchorId !== selectedAnchor?.anchorId);
  const markers = getPokeDiscoverEditorContentMarkers(bundle, room);
  const paths = useMemo(
    () => readPokeDiscoverEditorTiledReferences(room.tilemap).paths,
    [room.tilemap],
  );
  const selectedExistingActor = bundle.adventure.actorPlacements
    .find(placement => placement.placementId === selectedPlacementId);
  const selectedExistingCharacter = bundle.adventure.characterPlacements
    .find(placement => placement.placementId === selectedPlacementId);

  useEffect(() => {
    const placement = selectedExistingActor ?? selectedExistingCharacter;
    if (placement) setScalePercent(Math.round((placement.renderScaleMultiplier ?? 1) * 100));
  }, [selectedExistingActor, selectedExistingCharacter]);

  useEffect(() => {
    if (!catalogSelection) return;
    setKind('encounter');
    setAssetId(catalogSelection.assetId);
    setAnimationName(catalogSelection.animation);
  }, [catalogSelection]);

  useEffect(() => {
    if ((kind !== 'encounter' && kind !== 'npc') || !selectedAnchor) {
      onPlacementPreview?.(undefined);
      return;
    }
    onPlacementPreview?.({
      anchorId: selectedAnchor.anchorId,
      label: kind === 'encounter'
        ? selectedPmdAsset?.assetId ?? 'Pokémon'
        : selectedCharacterAsset?.assetId ?? 'Personaje',
      scalePercent,
    });
    return () => onPlacementPreview?.(undefined);
  }, [
    kind,
    onPlacementPreview,
    scalePercent,
    selectedAnchor,
    selectedCharacterAsset?.assetId,
    selectedPmdAsset?.assetId,
  ]);

  const withMovement = (adventure: AdventureMapV2, placementId: string): AdventureMapV2 => {
    if (movementMode === 'none') return adventure;
    const sequenceId = nextStableEditorId('sequence:movement:editor', adventure.ambientSequences.map(item => item.sequenceId));
    const beatId = `${sequenceId}:step-1`;
    const action = movementMode === 'path'
      ? {
        kind: 'movePath' as const,
        placementId,
        pathId: pathId || paths[0]?.pathId || '',
        movementStyle: 'continuous' as const,
        speedPixelsPerSecond: speed,
        animation: animationName,
      }
      : {
        kind: 'moveByTiles' as const,
        placementId,
        deltaXTiles: deltaX,
        deltaYTiles: deltaY,
        movementStyle: 'grid' as const,
        speedPixelsPerSecond: speed,
        animation: animationName,
      };
    if (action.kind === 'movePath' && !action.pathId) return adventure;
    return {
      ...adventure,
      ambientSequences: [...adventure.ambientSequences, {
        schemaVersion: 1 as const,
        sequenceId,
        roomId: room.room.roomId,
        loop: playbackMode !== 'once',
        playbackMode,
        blockedPolicy: 'pauseSequence' as const,
        loopPauseMs: pauseMs || undefined,
        beats: [{
          schemaVersion: 1 as const,
          beatId,
          actions: [action],
          pauseAfterMs: pauseMs || undefined,
        }],
      }],
    };
  };

  const placeContent = () => {
    if (!selectedAnchor) return;
    const adventure = bundle.adventure;
    if (kind === 'encounter' && selectedPmdAsset && selectedAnimation) {
      const placementId = nextStableEditorId('actor:editor', adventure.actorPlacements.map(item => item.placementId));
      onAdventureChange(withMovement({
        ...adventure,
        actorPlacements: [...adventure.actorPlacements, {
          schemaVersion: 1,
          placementId,
          roomId: room.room.roomId,
          anchorId: selectedAnchor.anchorId,
          assetId: selectedPmdAsset.assetId,
          animation: selectedAnimation.name,
          direction,
          collision,
          initiallyHidden: visible ? undefined : true,
          renderScaleMultiplier: scalePercent === 100 ? undefined : scalePercent / 100,
        }],
        requiredAssetIds: adventure.requiredAssetIds.includes(selectedPmdAsset.assetId)
          ? adventure.requiredAssetIds
          : [...adventure.requiredAssetIds, selectedPmdAsset.assetId],
      }, placementId));
      onPlacementSelect?.(placementId);
      return;
    }
    if (kind === 'npc' && selectedCharacterAsset) {
      const placementId = nextStableEditorId('npc:editor', adventure.characterPlacements.map(item => item.placementId));
      onAdventureChange({
        ...adventure,
        characterPlacements: [...adventure.characterPlacements, {
          schemaVersion: 1,
          placementId,
          roomId: room.room.roomId,
          anchorId: selectedAnchor.anchorId,
          assetId: selectedCharacterAsset.assetId,
          direction,
          collision,
          initiallyHidden: visible ? undefined : true,
          renderScaleMultiplier: scalePercent === 100 ? undefined : scalePercent / 100,
        }],
        requiredAssetIds: adventure.requiredAssetIds.includes(selectedCharacterAsset.assetId)
          ? adventure.requiredAssetIds
          : [...adventure.requiredAssetIds, selectedCharacterAsset.assetId],
      });
      onPlacementSelect?.(placementId);
      return;
    }
    if (kind === 'portal' && destinationAnchor) {
      const transitionId = nextStableEditorId('transition:editor', adventure.transitions.map(item => item.transitionId));
      onAdventureChange({
        ...adventure,
        transitions: [...adventure.transitions, {
          schemaVersion: 1,
          transitionId,
          kind: 'teleport',
          fromRoomId: room.room.roomId,
          fromAnchorId: selectedAnchor.anchorId,
          toRoomId: room.room.roomId,
          toAnchorId: destinationAnchor.anchorId,
        }],
      });
      return;
    }
    if (kind === 'secret' || kind === 'trigger') {
      const interactionId = nextStableEditorId(`interaction:${kind}:editor`, (adventure.interactions ?? []).map(item => item.interactionId));
      const dialogueId = nextStableEditorId(`dialogue:${kind}:editor`, (adventure.dialogues ?? []).map(item => item.dialogueId));
      const pageId = `${dialogueId}:page-1`;
      onAdventureChange({
        ...adventure,
        interactions: [...(adventure.interactions ?? []), {
          schemaVersion: 1,
          interactionId,
          roomId: room.room.roomId,
          target: { kind: 'anchor', anchorId: selectedAnchor.anchorId },
          prompt: prompt.trim() || 'Investigar',
          dialogueId,
          meaningfulKind: kind === 'secret' ? 'secret' : 'contextTrigger',
          repeatPolicy: 'oncePerVisit',
        }],
        dialogues: [...(adventure.dialogues ?? []), {
          schemaVersion: 1,
          dialogueId,
          initialPageId: pageId,
          pages: [{ schemaVersion: 1, pageId, speakerName: 'PokeDiscover', text: prompt.trim() || 'Contenido pendiente de configurar.' }],
        }],
      });
    }
  };

  return (
    <section className="editor-content" aria-labelledby="editor-content-title">
      <header>
        <div><span className="editor-eyebrow">Posiciones del mapa</span><h2 id="editor-content-title">Colocación de contenido</h2></div>
        <span>{markers.length} colocaciones visibles</span>
      </header>
      <div className="editor-content__layout">
        <div className="editor-content__form">
          <label><span>Tipo de contenido</span><select value={kind} onChange={event => { setKind(event.target.value as PokeDiscoverEditorContentKind); setAnchorId(''); setAssetId(''); }}>
            {Object.entries(KIND_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select></label>
          <label><span>Anclaje compatible</span><select value={selectedAnchor?.anchorId ?? ''} disabled={!selectedAnchor} onChange={event => setAnchorId(event.target.value)}>
            {availableAnchors.map(anchor => <option key={anchor.anchorId} value={anchor.anchorId}>{anchor.anchorId} · {anchor.anchorClass}</option>)}
          </select></label>
          {!selectedAnchor ? <p className="editor-catalog__empty-field">La habitación todavía no contiene una posición compatible.</p> : null}
          <button type="button" className="is-secondary" onClick={() => onChooseMapTool?.('anchor')}>Crear ancla en el mapa</button>

          {kind === 'encounter' ? <>
            <button type="button" className="is-secondary" onClick={onOpenCatalog}>Elegir desde el catálogo</button>
            <label><span>Pokémon y forma</span><select value={selectedPmdAsset?.assetId ?? ''} onChange={event => { setAssetId(event.target.value); setAnimationName('Idle'); }}>
              {bundle.pmdManifest.assets.map(asset => <option key={asset.assetId} value={asset.assetId}>#{String(asset.speciesId).padStart(4, '0')} · {asset.formId.split(':').at(-1)}</option>)}
            </select></label>
            <label><span>Animación inicial</span><select value={selectedAnimation?.name ?? ''} onChange={event => setAnimationName(event.target.value)}>
              {selectedPmdAsset?.animations.map(animation => <option key={animation.name}>{animation.name}</option>)}
            </select></label>
            <label><span>Tamaño visual · {scalePercent}%</span><input type="range" min="10" max="500" step="5" value={scalePercent} onChange={event => setScalePercent(Number(event.target.value))} /></label>
            <label><span>Movimiento</span><select value={movementMode} onChange={event => setMovementMode(event.target.value as typeof movementMode)}>
              <option value="none">Sin movimiento automático</option>
              <option value="path">Recorrer una ruta dibujada</option>
              <option value="tiles">Moverse por casillas</option>
            </select></label>
            {movementMode === 'path' ? <label><span>Ruta</span><select value={pathId || paths[0]?.pathId || ''} onChange={event => setPathId(event.target.value)}>
              {!paths.length ? <option value="">Dibuja primero una ruta en el mapa</option> : null}
              {paths.map(path => <option key={path.pathId} value={path.pathId}>{path.pathId}</option>)}
            </select></label> : null}
            {movementMode === 'path' ? <button type="button" className="is-secondary" onClick={() => onChooseMapTool?.('path')}>Dibujar una ruta en el mapa</button> : null}
            {movementMode === 'tiles' ? <div className="editor-content__movement-grid">
              <label><span>Casillas X</span><input type="number" value={deltaX} onChange={event => setDeltaX(Number(event.target.value))} /></label>
              <label><span>Casillas Y</span><input type="number" value={deltaY} onChange={event => setDeltaY(Number(event.target.value))} /></label>
            </div> : null}
            {movementMode !== 'none' ? <>
              <label><span>Velocidad (px/s)</span><input type="number" min="1" value={speed} onChange={event => setSpeed(Number(event.target.value))} /></label>
              <label><span>Comportamiento final</span><select value={playbackMode} onChange={event => setPlaybackMode(event.target.value as typeof playbackMode)}>
                <option value="loop">Repetir</option>
                <option value="pingPong">Ida y vuelta</option>
                <option value="once">Una vez</option>
              </select></label>
              <label><span>Pausa (ms)</span><input type="number" min="0" value={pauseMs} onChange={event => setPauseMs(Number(event.target.value))} /></label>
            </> : null}
          </> : null}
          {kind === 'npc' ? <>
            <label><span>Personaje</span><select value={selectedCharacterAsset?.assetId ?? ''} onChange={event => setAssetId(event.target.value)}>
              {bundle.characterManifest.assets.map(asset => <option key={asset.assetId}>{asset.assetId}</option>)}
            </select></label>
            <label><span>Tamaño visual · {scalePercent}%</span><input type="range" min="10" max="500" step="5" value={scalePercent} onChange={event => setScalePercent(Number(event.target.value))} /></label>
          </> : null}
          {(kind === 'encounter' || kind === 'npc') ? <div className="editor-content__movement-grid">
            <label><span>Orientación</span><select value={direction} onChange={event => setDirection(event.target.value as typeof direction)}>
              <option value="up">Arriba</option>
              <option value="down">Abajo</option>
              <option value="left">Izquierda</option>
              <option value="right">Derecha</option>
            </select></label>
            <label><span>Colisión</span><select value={collision} onChange={event => setCollision(event.target.value as typeof collision)}>
              <option value="solid">Sólida</option>
              <option value="pass-through">Atravesable</option>
            </select></label>
            <label className="editor-content__visibility"><input type="checkbox" checked={visible} onChange={event => setVisible(event.target.checked)} /><span>Visible al entrar</span></label>
          </div> : null}
          {kind === 'portal' ? <label><span>Anclaje de destino</span><select value={destinationAnchor?.anchorId ?? ''} disabled={!destinationAnchor} onChange={event => setDestinationAnchorId(event.target.value)}>
            {transitionAnchors.filter(anchor => anchor.anchorId !== selectedAnchor?.anchorId).map(anchor => <option key={anchor.anchorId}>{anchor.anchorId}</option>)}
          </select></label> : null}
          {(kind === 'secret' || kind === 'trigger') ? <label><span>Prompt provisional</span><input value={prompt} onChange={event => setPrompt(event.target.value)} /></label> : null}
          <button type="button" disabled={!selectedAnchor || (kind === 'portal' && !destinationAnchor)} onClick={placeContent}>Confirmar colocación</button>
        </div>
        <div className="editor-content__placed">
          <h3>Contenido de la habitación</h3>
          <ul>{markers.map(marker => <li key={`${marker.kind}:${marker.contentId}`} className={marker.contentId === selectedPlacementId ? 'is-selected' : ''}>
            <button type="button" onClick={() => onPlacementSelect?.(marker.contentId)}>
              <span>{KIND_LABELS[marker.kind]}</span><strong>{marker.contentId}</strong><small>{marker.anchorId}</small>
            </button>
          </li>)}</ul>
          {selectedExistingActor || selectedExistingCharacter ? <div className="editor-content__selected">
            <h3>Colocación seleccionada</h3>
            <strong>{selectedPlacementId}</strong>
            <label><span>Tamaño visual · {scalePercent}%</span><input type="range" min="10" max="500" step="5" value={scalePercent} onChange={event => {
              const next = Number(event.target.value);
              setScalePercent(next);
              onAdventureChange(selectedExistingActor ? {
                ...bundle.adventure,
                actorPlacements: bundle.adventure.actorPlacements.map(placement => placement.placementId === selectedPlacementId
                  ? { ...placement, renderScaleMultiplier: next === 100 ? undefined : next / 100 }
                  : placement),
              } : {
                ...bundle.adventure,
                characterPlacements: bundle.adventure.characterPlacements.map(placement => placement.placementId === selectedPlacementId
                  ? { ...placement, renderScaleMultiplier: next === 100 ? undefined : next / 100 }
                  : placement),
              });
            }} /></label>
            <label><span>Orientación</span><select value={(selectedExistingActor ?? selectedExistingCharacter)?.direction ?? 'down'} onChange={event => {
              const nextDirection = event.target.value as 'up' | 'down' | 'left' | 'right';
              onAdventureChange(selectedExistingActor ? {
                ...bundle.adventure,
                actorPlacements: bundle.adventure.actorPlacements.map(placement => placement.placementId === selectedPlacementId
                  ? { ...placement, direction: nextDirection }
                  : placement),
              } : {
                ...bundle.adventure,
                characterPlacements: bundle.adventure.characterPlacements.map(placement => placement.placementId === selectedPlacementId
                  ? { ...placement, direction: nextDirection }
                  : placement),
              });
            }}>
              <option value="up">Arriba</option><option value="down">Abajo</option><option value="left">Izquierda</option><option value="right">Derecha</option>
            </select></label>
            <label><span>Colisión</span><select value={(selectedExistingActor ?? selectedExistingCharacter)?.collision ?? 'solid'} onChange={event => {
              const nextCollision = event.target.value as 'solid' | 'pass-through';
              onAdventureChange(selectedExistingActor ? {
                ...bundle.adventure,
                actorPlacements: bundle.adventure.actorPlacements.map(placement => placement.placementId === selectedPlacementId
                  ? { ...placement, collision: nextCollision }
                  : placement),
              } : {
                ...bundle.adventure,
                characterPlacements: bundle.adventure.characterPlacements.map(placement => placement.placementId === selectedPlacementId
                  ? { ...placement, collision: nextCollision }
                  : placement),
              });
            }}><option value="solid">Sólida</option><option value="pass-through">Atravesable</option></select></label>
            {selectedExistingActor ? <label><span>Animación</span><select value={selectedExistingActor.animation} onChange={event => onAdventureChange({
              ...bundle.adventure,
              actorPlacements: bundle.adventure.actorPlacements.map(placement => placement.placementId === selectedPlacementId
                ? { ...placement, animation: event.target.value }
                : placement),
            })}>
              {bundle.pmdManifest.assets.find(asset => asset.assetId === selectedExistingActor.assetId)?.animations.map(animation => <option key={animation.name}>{animation.name}</option>)}
            </select></label> : null}
            <label className="editor-content__visibility"><input type="checkbox" checked={(selectedExistingActor ?? selectedExistingCharacter)?.initiallyHidden !== true} onChange={event => {
              const initiallyHidden = event.target.checked ? undefined : true;
              onAdventureChange(selectedExistingActor ? {
                ...bundle.adventure,
                actorPlacements: bundle.adventure.actorPlacements.map(placement => placement.placementId === selectedPlacementId
                  ? { ...placement, initiallyHidden }
                  : placement),
              } : {
                ...bundle.adventure,
                characterPlacements: bundle.adventure.characterPlacements.map(placement => placement.placementId === selectedPlacementId
                  ? { ...placement, initiallyHidden }
                  : placement),
              });
            }} /><span>Visible al entrar</span></label>
            <details><summary>Detalles avanzados</summary><code>{selectedPlacementId}</code></details>
          </div> : null}
        </div>
      </div>
    </section>
  );
}
