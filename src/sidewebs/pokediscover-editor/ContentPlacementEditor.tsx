import type { AdventureMapV3 } from '../../../packages/contracts/src/index.js';
import type {
  LoadedAdventureMapBundle,
  LoadedAdventureSectorBundle,
} from '../../domain/maps/loadAdventureBundle.js';
import {
  getPokeDiscoverEditorContentMarkers,
  type PokeDiscoverEditorContentKind,
} from '../../domain/tools/pokeDiscoverEditorContent.js';
import {
  clampPokeDiscoverEntityScalePercent,
  getPokeDiscoverEntityScaleMultiplier,
  getPokeDiscoverEntityScalePercent,
  POKEDISCOVER_ENTITY_SCALE_MAX_PERCENT,
  POKEDISCOVER_ENTITY_SCALE_MIN_PERCENT,
  POKEDISCOVER_ENTITY_SCALE_STEP_PERCENT,
} from '../../domain/tools/pokeDiscoverEditorEntityScale.js';

const KIND_LABELS: Record<PokeDiscoverEditorContentKind, string> = {
  encounter: 'Encuentro Pokémon',
  npc: 'NPC',
  portal: 'Portal',
  secret: 'Secreto',
  trigger: 'Trigger',
};

export function PlacementPropertiesEditor({
  bundle,
  placementId,
  onAdventureChange,
  onClose,
  compact = false,
}: {
  bundle: LoadedAdventureMapBundle;
  room: LoadedAdventureSectorBundle;
  placementId: string;
  onAdventureChange: (adventure: AdventureMapV3) => void;
  onClose?: () => void;
  compact?: boolean;
}) {
  const actor = bundle.adventure.actorPlacements.find(item => item.placementId === placementId);
  const character = bundle.adventure.characterPlacements.find(item => item.placementId === placementId);
  const placement = actor ?? character;
  if (!placement) return null;

  const updatePlacement = (
    update: {
      direction?: 'up' | 'down' | 'left' | 'right';
      collision?: 'solid' | 'pass-through';
      initiallyHidden?: true;
      renderScaleMultiplier?: number;
      animation?: string;
    },
  ) => {
    const { animation: _animation, ...characterUpdate } = update;
    onAdventureChange(actor ? {
      ...bundle.adventure,
      actorPlacements: bundle.adventure.actorPlacements.map(item => item.placementId === placementId
        ? { ...item, ...update }
        : item),
    } : {
      ...bundle.adventure,
      characterPlacements: bundle.adventure.characterPlacements.map(item => item.placementId === placementId
        ? { ...item, ...characterUpdate }
        : item),
    });
  };

  const scalePercent = getPokeDiscoverEntityScalePercent(bundle, placement);
  return <section className={`editor-placement-properties${compact ? ' is-compact' : ''}`} aria-label="Propiedades de la entidad">
    <header>
      <div><span>{actor ? 'Pokémon' : 'Personaje'}</span><strong>Entidad seleccionada</strong></div>
      {onClose ? <button type="button" aria-label="Cerrar propiedades" onClick={onClose}>×</button> : null}
    </header>
    <p>{placement.assetId}</p>
    <label><span>ID y posición derivados</span><code>{placement.placementId}</code></label>
    <label><span>Tamaño de la entidad · {scalePercent}%</span><input
      type="range"
      min={POKEDISCOVER_ENTITY_SCALE_MIN_PERCENT}
      max={POKEDISCOVER_ENTITY_SCALE_MAX_PERCENT}
      step={POKEDISCOVER_ENTITY_SCALE_STEP_PERCENT}
      value={clampPokeDiscoverEntityScalePercent(scalePercent)}
      onChange={event => updatePlacement({
        renderScaleMultiplier: getPokeDiscoverEntityScaleMultiplier(
          bundle,
          placement.assetId,
          Number(event.target.value),
        ),
      })}
    /></label>
    <label><span>Orientación</span><select value={placement.direction ?? 'down'} onChange={event => updatePlacement({
      direction: event.target.value as 'up' | 'down' | 'left' | 'right',
    })}>
      <option value="up">Arriba</option>
      <option value="down">Abajo</option>
      <option value="left">Izquierda</option>
      <option value="right">Derecha</option>
    </select></label>
    <label><span>Colisión</span><select value={placement.collision ?? 'solid'} onChange={event => updatePlacement({
      collision: event.target.value as 'solid' | 'pass-through',
    })}>
      <option value="solid">Sólida</option>
      <option value="pass-through">Atravesable</option>
    </select></label>
    {actor ? <label><span>Animación</span><select value={actor.animation} onChange={event => updatePlacement({
      animation: event.target.value,
    })}>
      {bundle.pmdManifest.assets.find(asset => asset.assetId === actor.assetId)?.animations.map(animation => (
        <option key={animation.name}>{animation.name}</option>
      ))}
    </select></label> : null}
    <label className="editor-content__visibility"><input
      type="checkbox"
      checked={placement.initiallyHidden !== true}
      onChange={event => updatePlacement({ initiallyHidden: event.target.checked ? undefined : true })}
    /><span>Visible al entrar</span></label>
  </section>;
}

export function ContentPlacementEditor({
  bundle,
  room,
  onAdventureChange,
  selectedPlacementId = '',
  onPlacementSelect,
}: {
  bundle: LoadedAdventureMapBundle;
  room: LoadedAdventureSectorBundle;
  onAdventureChange: (adventure: AdventureMapV3) => void;
  selectedPlacementId?: string;
  onPlacementSelect?: (placementId: string) => void;
  onPlacementPreview?: (preview?: { anchorId: string; label: string; scalePercent: number }) => void;
  catalogSelection?: { assetId: string; animation: string };
  onOpenCatalog?: () => void;
  onChooseMapTool?: (tool: never) => void;
}) {
  const markers = getPokeDiscoverEditorContentMarkers(bundle, room);
  const selected = bundle.adventure.actorPlacements.some(
    placement => placement.placementId === selectedPlacementId,
  ) || bundle.adventure.characterPlacements.some(
    placement => placement.placementId === selectedPlacementId,
  );
  return <section className="editor-content" aria-labelledby="editor-content-title">
    <header>
      <div><span className="editor-eyebrow">Construcciones confirmadas</span><h2 id="editor-content-title">Colocaciones</h2></div>
      <span>{markers.length} elementos</span>
    </header>
    <p>Para añadir contenido, selecciona una celda del sector y completa el wizard. Este panel solo edita propiedades válidas de construcciones ya confirmadas.</p>
    <div className="editor-content__placed">
      <ul>{markers.map(marker => <li
        key={`${marker.kind}:${marker.contentId}`}
        className={marker.contentId === selectedPlacementId ? 'is-selected' : ''}
      >
        <button type="button" onClick={() => onPlacementSelect?.(marker.contentId)}>
          <span>{KIND_LABELS[marker.kind]}</span>
          <strong>{marker.contentId}</strong>
          <small>{marker.anchorId}</small>
        </button>
      </li>)}</ul>
      {selected ? <PlacementPropertiesEditor
        bundle={bundle}
        room={room}
        placementId={selectedPlacementId}
        onAdventureChange={onAdventureChange}
      /> : null}
    </div>
  </section>;
}
