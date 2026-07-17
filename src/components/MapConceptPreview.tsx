import { useEffect, useRef, useState } from 'react';

const MAP_PATH = 'assets/adventure/map-concepts/kanto/bahia-sharpedo/pruebas.png';
const RATTATA_ROOT = 'assets/sprites/pokemon/pmd/0019-rattata/default';
const IDLE_DIRECTION_ROW = 0;
const SPRITE_SCALE = 2;

function loadImage(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`No se pudo cargar ${source}`));
    image.src = source;
  });
}

function readIdleAnimation(xmlText: string) {
  const documentNode = new DOMParser().parseFromString(xmlText, 'application/xml');
  const animations = [...documentNode.querySelectorAll('Anim')];
  const idle = animations.find(animation => animation.querySelector('Name')?.textContent === 'Idle');
  if (!idle) throw new Error('AnimData.xml no contiene la animación Idle.');
  const frameWidth = Number(idle.querySelector('FrameWidth')?.textContent);
  const frameHeight = Number(idle.querySelector('FrameHeight')?.textContent);
  const durations = [...idle.querySelectorAll('Durations > Duration')]
    .map(duration => Number(duration.textContent))
    .filter(duration => Number.isFinite(duration) && duration > 0);
  if (!frameWidth || !frameHeight || !durations.length) throw new Error('La animación Idle está incompleta.');
  return { frameWidth, frameHeight, durations };
}

export function MapConceptPreview({ open, onClose }: { open: boolean; onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
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
    if (!open) return undefined;
    let cancelled = false;
    let frameTimer: number | undefined;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const baseUrl = import.meta.env.BASE_URL;
    const sheetUrl = `${baseUrl}${RATTATA_ROOT}/Idle-Anim.png`;
    const xmlUrl = `${baseUrl}${RATTATA_ROOT}/AnimData.xml`;
    setStatus('loading');

    Promise.all([
      loadImage(sheetUrl),
      fetch(xmlUrl).then(response => {
        if (!response.ok) throw new Error('No se pudo cargar AnimData.xml.');
        return response.text();
      }),
    ]).then(([sheet, xmlText]) => {
      if (cancelled || !canvasRef.current) return;
      const animation = readIdleAnimation(xmlText);
      const canvas = canvasRef.current;
      canvas.width = animation.frameWidth * SPRITE_SCALE;
      canvas.height = animation.frameHeight * SPRITE_SCALE;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Canvas 2D no está disponible.');
      context.imageSmoothingEnabled = false;
      let frame = 0;

      const drawFrame = () => {
        canvas.dataset.frame = String(frame);
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.save();
        context.globalAlpha = .28;
        context.fillStyle = '#102316';
        context.beginPath();
        context.ellipse(canvas.width / 2, canvas.height * .82, canvas.width * .2, canvas.height * .08, 0, 0, Math.PI * 2);
        context.fill();
        context.restore();
        context.drawImage(
          sheet,
          frame * animation.frameWidth,
          IDLE_DIRECTION_ROW * animation.frameHeight,
          animation.frameWidth,
          animation.frameHeight,
          0,
          0,
          canvas.width,
          canvas.height,
        );
      };

      const scheduleNextFrame = () => {
        drawFrame();
        if (reducedMotion || cancelled) return;
        const durationMs = animation.durations[frame] * (1000 / 60);
        frameTimer = window.setTimeout(() => {
          frame = (frame + 1) % animation.durations.length;
          scheduleNextFrame();
        }, durationMs);
      };

      scheduleNextFrame();
      setStatus('ready');
    }).catch(() => {
      if (!cancelled) setStatus('error');
    });

    return () => {
      cancelled = true;
      window.clearTimeout(frameTimer);
    };
  }, [open]);

  if (!open) return null;
  return (
    <div className="pv-modal map-concept-preview" data-testid="map-concept-preview">
      <div className="pv-modal__backdrop" onClick={onClose} />
      <section className="pv-modal__panel map-concept-preview__panel" role="dialog" aria-modal="true" aria-labelledby="map-concept-preview-title">
        <header className="pv-modal__head">
          <div>
            <span className="map-concept-preview__eyebrow">Prototipo visual</span>
            <h3 id="map-concept-preview-title">Bahía Sharpedo · Rattata Idle</h3>
          </div>
          <button ref={closeRef} className="pv-modal__close" type="button" aria-label="Cerrar prueba de mapa" onClick={onClose}>×</button>
        </header>
        <div className="map-concept-preview__viewport">
          <img src={`${import.meta.env.BASE_URL}${MAP_PATH}`} alt="Mapa conceptual de Bahía Sharpedo" />
          <canvas
            ref={canvasRef}
            className="map-concept-preview__rattata"
            role="img"
            aria-label="Rattata reproduciendo su animación Idle sobre la hierba"
          />
          {status !== 'ready' && (
            <div className="map-concept-preview__status" role="status">
              {status === 'error' ? 'No se pudo reconstruir la animación.' : 'Preparando sprite PMD…'}
            </div>
          )}
        </div>
        <footer className="map-concept-preview__note">
          Prueba provisional sobre imagen plana. El mapa definitivo separará tiles, colisiones y capas de oclusión.
        </footer>
      </section>
    </div>
  );
}
