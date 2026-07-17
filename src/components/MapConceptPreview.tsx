import { useEffect, useRef, useState } from 'react';
import { createTechnicalPhaserGame } from '../domain/maps/createTechnicalPhaserGame.js';
import { loadAdventureMapBundle } from '../domain/maps/loadAdventureBundle.js';

const TECHNICAL_ADVENTURE_PATH = 'assets/adventure/maps/_technical/technical-test.adventure.json';
const TECHNICAL_ROOM_ID = 'room:technical:clearing';

export function MapConceptPreview({ open, onClose }: { open: boolean; onClose: () => void }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    if (!open) return undefined;
    closeRef.current?.focus();
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

    Promise.all([
      import('phaser'),
      loadAdventureMapBundle({
        adventurePath: TECHNICAL_ADVENTURE_PATH,
        baseUrl: import.meta.env.BASE_URL,
      }),
    ]).then(([Phaser, bundle]) => {
      if (cancelled) return;
      game = createTechnicalPhaserGame({
        Phaser,
        parent: host,
        bundle,
        initialRoomId: TECHNICAL_ROOM_ID,
        reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
        onReady: () => {
          if (cancelled) return;
          host.dataset.runtime = 'ready';
          host.dataset.mapId = bundle.adventure.mapId;
          setStatus('ready');
        },
      });
    }).catch(error => {
      console.error('No se pudo iniciar la habitación técnica:', error);
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
  }, [open]);

  if (!open) return null;
  return (
    <div className="pv-modal map-concept-preview" data-testid="map-concept-preview">
      <div className="pv-modal__backdrop" onClick={onClose} />
      <section className="pv-modal__panel map-concept-preview__panel" role="dialog" aria-modal="true" aria-labelledby="map-concept-preview-title">
        <header className="pv-modal__head">
          <div>
            <span className="map-concept-preview__eyebrow">Pipeline Tiled + Phaser</span>
            <h3 id="map-concept-preview-title">Claro técnico · Rattata Idle</h3>
          </div>
          <button ref={closeRef} className="pv-modal__close" type="button" aria-label="Cerrar prueba de mapa" onClick={onClose}>×</button>
        </header>
        <div className="map-concept-preview__viewport">
          <div
            ref={hostRef}
            className="map-concept-preview__runtime"
            data-testid="technical-map-runtime"
            role="img"
            aria-label="Habitación técnica de Tiled con Rattata animado entre la hierba"
          />
          {status !== 'ready' && (
            <div className="map-concept-preview__status" role="status">
              {status === 'error' ? 'No se pudo cargar el runtime técnico.' : 'Cargando Phaser y la habitación…'}
            </div>
          )}
        </div>
        <footer className="map-concept-preview__note">
          Muévete con cursores o WASD. La cámara permanece fija; los bordes bloquean el paso y la hierba se dibuja sobre Rattata.
        </footer>
      </section>
    </div>
  );
}
