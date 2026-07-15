import { useEffect, useRef, useState } from 'react';
import { GEN_RANGES } from '../../scripts/utils.js';
import { CARD_SIZE_MAX, CARD_SIZE_MIN } from '../lib/constants.js';
import { formatDex } from '../lib/pokemon.js';

export function SecondaryControlsMenu({ selectedGens, cardSize, imageStyle, onCardSize, onDeleteAll, onImageStyle, onToggleGen, onReset }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    const handleKeyDown = event => {
      if (event.key === 'Escape') setOpen(false);
    };
    const handlePointerDown = event => {
      if (!menuRef.current?.contains(event.target)) setOpen(false);
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('pointerdown', handlePointerDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [open]);

  return (
    <div className={`secondary-menu ${open ? 'is-open' : ''}`} ref={menuRef}>
      <button
        className="secondary-menu-toggle"
        type="button"
        aria-label={open ? 'Cerrar controles' : 'Abrir controles'}
        aria-expanded={open}
        aria-controls="secondaryControlsPanel"
        onClick={() => setOpen(current => !current)}
      >
        <span />
        <span />
        <span />
      </button>
      <div id="secondaryControlsPanel" className="secondary-menu-panel" aria-hidden={!open}>
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
        <fieldset className="image-style-control" aria-label="Estilo de imagen">
          <legend>Imagen</legend>
          <label className={`image-style-option ${imageStyle === '3d' ? 'active' : ''}`}>
            <input
              type="radio"
              name="imageStyle"
              value="3d"
              checked={imageStyle === '3d'}
              onChange={() => onImageStyle('3d')}
            />
            <span>3D</span>
          </label>
          <label className={`image-style-option ${imageStyle === 'sprite' ? 'active' : ''}`}>
            <input
              type="radio"
              name="imageStyle"
              value="sprite"
              checked={imageStyle === 'sprite'}
              onChange={() => onImageStyle('sprite')}
            />
            <span>Sprite</span>
          </label>
        </fieldset>
        <button className="btn danger floating-reset-mobile" type="button" onClick={onReset}>
          Reiniciar progreso
        </button>
        <button className="btn danger" type="button" onClick={onDeleteAll}>
          Borrar todos los datos
        </button>
        <div className="gens" id="gens">
          {Object.keys(GEN_RANGES).map(Number).map(gen => (
            <button
              key={gen}
              className={`pill ${selectedGens.includes(gen) ? 'active' : ''}`}
              type="button"
              onClick={() => onToggleGen(gen)}
              title={`${formatDex(GEN_RANGES[gen][0])} - ${formatDex(GEN_RANGES[gen][1])}`}
            >
              Gen {gen}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
