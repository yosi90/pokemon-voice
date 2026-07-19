import { useEffect, useRef, useState, type FormEvent } from 'react';
import { createTechnicalPhaserGame, MAP_SPECIES_IDENTIFIED_EVENT } from '../domain/maps/createTechnicalPhaserGame.js';
import { loadAdventureMapBundle } from '../domain/maps/loadAdventureBundle.js';
import { getBrowserPokeVoiceSave } from '../store/browserPokeVoiceSaveStore.js';
import { browserDiscoveryStore } from '../store/browserDiscoveryStore.js';

const PREVIEW_ADVENTURE_PATH = 'assets/adventure/maps/tegueste-forest/tegueste-forest.adventure.json';
const PREVIEW_ROOM_ID = 'room:tegueste-forest:02-04';

export function MapConceptPreview({
  open,
  listening,
  speechSupported,
  onMic,
  onIdentifyText,
  onVisibleSpeciesIdsChange,
  onClose,
}: {
  open: boolean;
  listening: boolean;
  speechSupported: boolean;
  onMic: () => void;
  onIdentifyText: (value: string) => boolean | Promise<boolean>;
  onVisibleSpeciesIdsChange: (speciesIds: number[]) => void;
  onClose: () => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [writtenName, setWrittenName] = useState('');

  const submitWrittenName = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = writtenName.trim();
    if (!value) return;
    await onIdentifyText(value);
    setWrittenName('');
  };

  useEffect(() => {
    if (!open) return undefined;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [onClose, open]);

  useEffect(() => {
    if (!open || !hostRef.current) return undefined;
    let cancelled = false;
    let game: import('phaser').Game | undefined;
    const host = hostRef.current;
    setStatus('loading');
    host.dataset.runtime = 'loading';
    host.focus({ preventScroll: true });

    Promise.all([
      import('phaser'),
      loadAdventureMapBundle({
        adventurePath: PREVIEW_ADVENTURE_PATH,
        baseUrl: import.meta.env.BASE_URL,
      }),
    ]).then(([Phaser, bundle]) => {
      if (cancelled) return;
      const room = bundle.rooms.find(candidate => candidate.room.roomId === PREVIEW_ROOM_ID);
      const visibleSpeciesIds = [...new Set(bundle.adventure.actorPlacements
        .filter(placement => placement.roomId === PREVIEW_ROOM_ID)
        .map(placement => room?.actorAssets.get(placement.assetId)?.speciesId)
        .filter((speciesId): speciesId is number => Number.isSafeInteger(speciesId)))];
      onVisibleSpeciesIdsChange(visibleSpeciesIds);
      game = createTechnicalPhaserGame({
        Phaser,
        parent: host,
        bundle,
        initialRoomId: PREVIEW_ROOM_ID,
        reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
        registeredSpeciesIds: new Set(getBrowserPokeVoiceSave().pokedexRun.registeredSpeciesIds),
        onReady: () => {
          if (cancelled) return;
          host.dataset.runtime = 'ready';
          host.dataset.mapId = bundle.adventure.mapId;
          setStatus('ready');
          host.focus({ preventScroll: true });
        },
      });
    }).catch(error => {
      console.error('No se pudo iniciar la habitación de Tegueste:', error);
      if (!cancelled) {
        host.dataset.runtime = 'error';
        setStatus('error');
      }
    });

    return () => {
      cancelled = true;
      game?.destroy(true);
      host.replaceChildren();
      onVisibleSpeciesIdsChange([]);
    };
  }, [onVisibleSpeciesIdsChange, open]);

  useEffect(() => {
    if (!open || !hostRef.current) return undefined;
    const host = hostRef.current;
    let previous = new Set(browserDiscoveryStore.getSnapshot().guessedIds);
    return browserDiscoveryStore.subscribe(() => {
      const current = browserDiscoveryStore.getSnapshot().guessedIds;
      for (const speciesId of current) {
        if (!previous.has(speciesId)) {
          host.dispatchEvent(new CustomEvent(MAP_SPECIES_IDENTIFIED_EVENT, { detail: { speciesId } }));
        }
      }
      previous = new Set(current);
    });
  }, [open]);

  if (!open) return null;
  return (
    <div className="pv-modal map-concept-preview" data-testid="map-concept-preview">
      <div className="pv-modal__backdrop" />
      <section className="pv-modal__panel map-concept-preview__panel" role="dialog" aria-modal="true" aria-labelledby="map-concept-preview-title">
        <header className="pv-modal__head">
          <h3 id="map-concept-preview-title">¡Ayuda al profesor Alcanfor!</h3>
          <button className="map-concept-preview__power" type="button" onClick={onClose}>
            <span aria-hidden="true">⏻</span>
            Abandonar misión
          </button>
        </header>
        <div className="map-concept-preview__upper-shell">
          <div className="map-concept-preview__speaker map-concept-preview__speaker--left" aria-hidden="true" />
          <div className="map-concept-preview__viewport">
            <div
              ref={hostRef}
              className="map-concept-preview__runtime"
              data-testid="technical-map-runtime"
              role="img"
              tabIndex={0}
              aria-label="Habitación del Bosque de Tegueste con protagonista, Alcanfor y Pokémon animados"
            />
            {status !== 'ready' && (
              <div className="map-concept-preview__status" role="status">
                {status === 'error' ? 'No se pudo cargar el Bosque de Tegueste.' : 'Cargando…'}
              </div>
            )}
          </div>
          <div className="map-concept-preview__speaker map-concept-preview__speaker--right" aria-hidden="true" />
        </div>
        <div className="map-concept-preview__hinge" aria-hidden="true"><span /><span /></div>
        <div className="map-concept-preview__lower-shell">
          <div className="map-concept-preview__dpad" aria-hidden="true"><i /><i /></div>
          <form className="map-concept-preview__touchscreen" onSubmit={submitWrittenName}>
            <label className="map-concept-preview__hidden-label" htmlFor="map-pokemon-name">Nombre del Pokémon visible</label>
            <input
              id="map-pokemon-name"
              className="map-concept-preview__name-input"
              type="text"
              value={writtenName}
              placeholder="Nombre…"
              autoComplete="off"
              onChange={event => setWrittenName(event.target.value)}
              onKeyDown={event => event.stopPropagation()}
            />
            <button
              className={`map-concept-preview__mic ${listening ? 'is-listening' : ''}`}
              type="button"
              aria-label={listening ? 'Detener identificación por voz' : 'Identificar Pokémon por voz'}
              aria-pressed={listening}
              title={speechSupported ? 'Identificar únicamente Pokémon visibles' : 'Reconocimiento de voz no disponible'}
              disabled={!speechSupported}
              onClick={onMic}
            >
              <span aria-hidden="true">🎙</span>
            </button>
          </form>
          <div className="map-concept-preview__buttons" aria-hidden="true"><i /><i /><i /><i /></div>
        </div>
      </section>
    </div>
  );
}
