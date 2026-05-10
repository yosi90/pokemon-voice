import { GEN_RANGES } from '../../scripts/utils.js';
import { CARD_SIZE_MAX, CARD_SIZE_MIN } from '../lib/constants.js';
import { formatDex } from '../lib/pokemon.js';

export function Topbar({ selectedGens, cardSize, onCardSize, onToggleGen }) {
  return (
    <div className="topbar">
      <div className="top-inner">
        <div className="brand"><span className="brand-ball" /> Poke-Voice</div>
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
