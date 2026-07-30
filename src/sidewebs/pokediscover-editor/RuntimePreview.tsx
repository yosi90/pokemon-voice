import { useEffect, useMemo, useRef, useState } from 'react';
import {
  createTechnicalPhaserGame,
  MAP_EVENT_REQUEST_EVENT,
  MAP_HAZARD_PREVIEW_EVENT,
} from '../../domain/maps/createTechnicalPhaserGame.js';
import type {
  HazardConsequenceV1,
  TrainerAvatarId,
} from '../../../packages/contracts/src/index.js';
import type { LoadedAdventureMapBundle } from '../../domain/maps/loadAdventureBundle.js';

function withDesignSpawn(bundle: LoadedAdventureMapBundle, sectorId: string) {
  const sectorBundle = bundle.sectors.find(candidate => candidate.sector.sectorId === sectorId);
  if (!sectorBundle || sectorBundle.sector.spawnAnchorIds.length) return bundle;
  const anchorId = 'anchor:editor:temporary-preview';
  const anchorLayer = sectorBundle.tilemap.layers.find(layer => layer.name === 'Anchors');
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
          x: Math.floor(sectorBundle.tilemap.width / 2) * sectorBundle.tilemap.tilewidth,
          y: Math.floor(sectorBundle.tilemap.height / 2) * sectorBundle.tilemap.tileheight,
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
        x: Math.floor(sectorBundle.tilemap.width / 2) * sectorBundle.tilemap.tilewidth,
        y: Math.floor(sectorBundle.tilemap.height / 2) * sectorBundle.tilemap.tileheight,
        width: 0,
        height: 0,
        rotation: 0,
        visible: true,
      }],
    };
  const nextSectorContract = { ...sectorBundle.sector, spawnAnchorIds: [anchorId] };
  const adventure = {
    ...bundle.adventure,
    sectors: bundle.adventure.sectors.map(candidate => candidate.sectorId === sectorId
      ? nextSectorContract
      : candidate),
  };
  return {
    ...bundle,
    adventure,
    sectors: bundle.sectors.map(candidate => candidate.sector.sectorId === sectorId
      ? {
        ...candidate,
        adventure,
        sector: nextSectorContract,
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
  sectorId,
  designMode,
}: {
  bundle: LoadedAdventureMapBundle;
  sectorId: string;
  designMode: boolean;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [simulateSurf, setSimulateSurf] = useState(false);
  const [previewNonce, setPreviewNonce] = useState(0);
  const [previewAvatarId, setPreviewAvatarId] = useState<TrainerAvatarId>('achaman');
  const [previewAppearanceId, setPreviewAppearanceId] = useState<string>();
  const [telemetry, setTelemetry] = useState<Record<string, string>>({});
  const previewBundle = useMemo(
    () => designMode ? withDesignSpawn(bundle, sectorId) : bundle,
    [bundle, designMode, sectorId],
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
        initialSectorId: sectorId,
        reducedMotion: designMode || window.matchMedia('(prefers-reduced-motion: reduce)').matches,
        registeredSpeciesIds: new Set(previewBundle.pmdManifest.assets.map(asset => asset.speciesId)),
        expeditionCapabilityIds: simulateSurf ? new Set(['surf']) : new Set(),
        playerAvatarId: previewAvatarId,
        playerAppearanceId: previewAppearanceId,
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
  }, [designMode, previewAppearanceId, previewAvatarId, previewBundle, previewNonce, sectorId, simulateSurf]);

  useEffect(() => {
    const control = (event: Event) => {
      const detail = (event as CustomEvent<{
        command?: 'surf' | 'runEvent' | 'reset' | 'hazard' | 'player';
        triggerId?: string;
        consequence?: HazardConsequenceV1;
        avatarId?: TrainerAvatarId;
        appearanceId?: string;
      }>).detail;
      if (detail?.command === 'surf') {
        setSimulateSurf(current => !current);
        return;
      }
      if (detail?.command === 'reset') {
        setPreviewNonce(current => current + 1);
        return;
      }
      if (detail?.command === 'player') {
        if (detail.avatarId) setPreviewAvatarId(detail.avatarId);
        setPreviewAppearanceId(detail.appearanceId);
        return;
      }
      if (detail?.command === 'runEvent' && detail.triggerId) {
        hostRef.current?.dispatchEvent(new CustomEvent(MAP_EVENT_REQUEST_EVENT, {
          detail: { triggerId: detail.triggerId },
        }));
      }
      if (detail?.command === 'hazard' && detail.consequence) {
        hostRef.current?.dispatchEvent(new CustomEvent(MAP_HAZARD_PREVIEW_EVENT, {
          detail: { consequence: detail.consequence },
        }));
      }
    };
    window.addEventListener('pokediscover:preview-control', control);
    return () => window.removeEventListener('pokediscover:preview-control', control);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const dataset = hostRef.current?.dataset;
      if (!dataset) return;
      setTelemetry(Object.fromEntries([
        'surface',
        'playerLocomotion',
        'projectileCount',
        'lastImpact',
        'hazardOutcome',
        'hazardRollbackPolicy',
        'hazardDestination',
        'hazardDestinationFallback',
        'activeMapEventTriggerId',
      ].map(key => [key, dataset[key] ?? '—'])));
    }, 160);
    return () => window.clearInterval(timer);
  }, []);

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
      {status === 'error' ? 'No se pudo dibujar este sector.' : 'Preparando mapa…'}
        </div>
      ) : null}
      {!designMode ? <details className="editor-runtime-telemetry">
        <summary>Telemetría editorial {simulateSurf ? '· Surf simulado' : ''}</summary>
        <dl>{Object.entries(telemetry).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}</dl>
      </details> : null}
    </div>
  );
}
