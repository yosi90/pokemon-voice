import { useEffect, useMemo, useRef, useState } from 'react';
import { createTechnicalPhaserGame } from '../../domain/maps/createTechnicalPhaserGame.js';
import type { LoadedAdventureMapBundle } from '../../domain/maps/loadAdventureBundle.js';

function withDesignSpawn(bundle: LoadedAdventureMapBundle, roomId: string) {
  const room = bundle.rooms.find(candidate => candidate.room.roomId === roomId);
  if (!room || room.room.spawnAnchorIds.length) return bundle;
  const anchorId = 'anchor:editor:temporary-preview';
  const anchorLayer = room.tilemap.layers.find(layer => layer.name === 'Anchors');
  const nextAnchorLayer = anchorLayer
    ? {
      ...anchorLayer,
      objects: [
        ...(Array.isArray(anchorLayer.objects) ? anchorLayer.objects : []),
        {
          id: -1,
          name: anchorId,
          class: 'PlayerSpawn',
          point: true,
          x: Math.floor(room.tilemap.width / 2) * room.tilemap.tilewidth,
          y: Math.floor(room.tilemap.height / 2) * room.tilemap.tileheight,
          width: 0,
          height: 0,
          rotation: 0,
          visible: true,
        },
      ],
    }
    : {
      id: -1,
      name: 'Anchors',
      type: 'objectgroup',
      visible: true,
      opacity: 1,
      objects: [{
        id: -1,
        name: anchorId,
        class: 'PlayerSpawn',
        point: true,
        x: Math.floor(room.tilemap.width / 2) * room.tilemap.tilewidth,
        y: Math.floor(room.tilemap.height / 2) * room.tilemap.tileheight,
        width: 0,
        height: 0,
        rotation: 0,
        visible: true,
      }],
    };
  const nextRoomContract = { ...room.room, spawnAnchorIds: [anchorId] };
  const adventure = {
    ...bundle.adventure,
    rooms: bundle.adventure.rooms.map(candidate => candidate.roomId === roomId
      ? nextRoomContract
      : candidate),
  };
  return {
    ...bundle,
    adventure,
    rooms: bundle.rooms.map(candidate => candidate.room.roomId === roomId
      ? {
        ...candidate,
        adventure,
        room: nextRoomContract,
        tilemap: {
          ...candidate.tilemap,
          layers: anchorLayer
            ? candidate.tilemap.layers.map(layer => layer === anchorLayer ? nextAnchorLayer : layer)
            : [...candidate.tilemap.layers, nextAnchorLayer],
        },
      }
      : { ...candidate, adventure }),
  };
}

export function RuntimePreview({
  bundle,
  roomId,
  designMode,
}: {
  bundle: LoadedAdventureMapBundle;
  roomId: string;
  designMode: boolean;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const previewBundle = useMemo(
    () => designMode ? withDesignSpawn(bundle, roomId) : bundle,
    [bundle, designMode, roomId],
  );

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    let cancelled = false;
    let game: ReturnType<typeof createTechnicalPhaserGame> | undefined;
    setStatus('loading');
    host.dataset.runtime = 'loading';
    import('phaser').then(Phaser => {
      if (cancelled) return;
      game = createTechnicalPhaserGame({
        Phaser,
        parent: host,
        bundle: previewBundle,
        initialRoomId: roomId,
        reducedMotion: designMode || window.matchMedia('(prefers-reduced-motion: reduce)').matches,
        registeredSpeciesIds: new Set(previewBundle.pmdManifest.assets.map(asset => asset.speciesId)),
        fitParent: false,
        onReady: () => {
          if (cancelled) return;
          host.dataset.runtime = 'ready';
          setStatus('ready');
        },
      });
    }).catch(error => {
      console.error('No se pudo preparar la vista del mapa:', error);
      if (!cancelled) {
        host.dataset.runtime = 'error';
        setStatus('error');
      }
    });
    return () => {
      cancelled = true;
      game?.destroy(true);
      host.replaceChildren();
    };
  }, [designMode, previewBundle, roomId]);

  return (
    <div className="editor-runtime-stack">
      <div
        ref={hostRef}
        className="editor-runtime"
        data-testid="pokediscover-editor-runtime"
        data-mode={designMode ? 'design' : 'test'}
        role="img"
        tabIndex={designMode ? -1 : 0}
        aria-label={`${designMode ? 'Lienzo de diseño' : 'Prueba jugable'} de ${previewBundle.adventure.title}`}
      />
      {status !== 'ready' ? (
        <div className={`editor-runtime-status ${status === 'error' ? 'is-error' : ''}`} role="status">
          {status === 'error' ? 'No se pudo dibujar esta habitación.' : 'Preparando mapa…'}
        </div>
      ) : null}
    </div>
  );
}
