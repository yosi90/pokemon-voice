import { useEffect, useRef } from 'react';
import { CARD_SIZE_MAX, CARD_SIZE_MIN } from '../lib/constants.js';
import { ImageStyleControl } from './ImageStyleControl.jsx';

const GENERATION_LABELS = {
  1: 'Generación I',
  2: 'Generación II',
  3: 'Generación III',
  4: 'Generación IV',
  5: 'Generación V',
  6: 'Generación VI',
  7: 'Generación VII',
  8: 'Generación VIII',
  9: 'Generación IX',
  10: 'Generación X',
};

const getPercentage = (value, total) => total > 0 ? Math.round((value / total) * 100) : 0;

export function PokedexControlsDrawer({
  open,
  onClose,
  generation,
  discovered,
  total,
  globalDiscovered,
  globalTotal,
  onGenerationChange,
  cardSize,
  imageStyle,
  onCardSize,
  onDeleteAll,
  onImageStyle,
  onReset,
}) {
  const drawerRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    const handleKeyDown = event => {
      if (event.key === 'Escape') onClose();
    };
    const handlePointerDown = event => {
      const trigger = document.getElementById('pokedex-controls-btn');
      if (!drawerRef.current?.contains(event.target) && !trigger?.contains(event.target)) onClose();
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('pointerdown', handlePointerDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [onClose, open]);

  return (
    <aside
      id="pokedex-controls-drawer"
      className="side-drawer side-drawer--left pokedex-controls-drawer"
      aria-hidden={!open}
      aria-label="Controles de Pokédex"
      ref={drawerRef}
    >
      <header className="drawer-header">
        <div>
          <span className="drawer-eyebrow">Pokédex activa</span>
          <h2>{GENERATION_LABELS[generation]}</h2>
        </div>
        <button className="icon-btn" type="button" aria-label="Cerrar" onClick={onClose}>×</button>
      </header>
      <div className="drawer-content pokedex-controls-drawer__content">
        <section className="drawer-section" aria-labelledby="generation-controls-title">
          <h3 id="generation-controls-title">Generaciones</h3>
          <nav className="generation-pagination" aria-label="Generaciones de la Pokédex">
            {Object.entries(GENERATION_LABELS).map(([id, label]) => {
              const generationId = Number(id);
              const active = generationId === generation;
              const unavailable = generationId === 10;
              return (
                <button
                  key={generationId}
                  className={active ? 'active' : ''}
                  type="button"
                  aria-label={unavailable ? `${label} aún no disponible` : `Mostrar ${label}`}
                  aria-pressed={active}
                  disabled={unavailable}
                  title={unavailable ? 'Aún no disponible' : label}
                  onClick={() => onGenerationChange(generationId)}
                >
                  {generationId}
                </button>
              );
            })}
          </nav>
          <div className="pokedex-progress" aria-label="Progreso de la Pokédex">
            <div className="generation-progress generation-progress--active">
              <div className="generation-progress__copy">
                <span>Esta generación</span>
                <strong>{discovered} / {total}</strong>
              </div>
              <progress value={discovered} max={Math.max(total, 1)} aria-label="Progreso de esta generación" />
              <span className="generation-progress__percentage">{getPercentage(discovered, total)}%</span>
            </div>
            <div className="generation-progress">
              <div className="generation-progress__copy">
                <span>Pokédex global</span>
                <strong>{globalDiscovered} / {globalTotal}</strong>
              </div>
              <progress value={globalDiscovered} max={Math.max(globalTotal, 1)} aria-label="Progreso global de la Pokédex" />
              <span className="generation-progress__percentage">{getPercentage(globalDiscovered, globalTotal)}%</span>
            </div>
          </div>
        </section>

        <section className="drawer-section" aria-labelledby="display-controls-title">
          <h3 id="display-controls-title">Presentación</h3>
          <label className="size-control" htmlFor="cardSizeSlider">
            <span className="size-icon size-icon--small" />
            <input
              id="cardSizeSlider"
              type="range"
              min={CARD_SIZE_MIN}
              max={CARD_SIZE_MAX}
              step="2"
              value={cardSize}
              onChange={event => onCardSize(Number(event.target.value))}
              aria-label="Tamaño de Pokéballs"
            />
            <span className="size-icon size-icon--large" />
          </label>
          <ImageStyleControl
            className="image-style-control--drawer"
            imageStyle={imageStyle}
            name="drawerImageStyle"
            onImageStyle={onImageStyle}
          />
        </section>

        <section className="drawer-section drawer-section--danger" aria-labelledby="data-controls-title">
          <h3 id="data-controls-title">Partida</h3>
          <button className="btn danger" type="button" onClick={onReset}>Reiniciar progreso</button>
          <button className="btn danger" type="button" onClick={onDeleteAll}>Borrar todos los datos</button>
        </section>
      </div>
    </aside>
  );
}
