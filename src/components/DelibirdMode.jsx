import { useMemo, useState } from 'react';

const COLORS = ['red', 'blue', 'yellow', 'green', 'pink', 'ice'];

export function DelibirdMode({ active, onWin, onClose }) {
  const [opened, setOpened] = useState(null);
  const gifts = useMemo(() => {
    const winner = Math.floor(Math.random() * 18);
    return Array.from({ length: 18 }, (_, index) => ({
      id: index,
      winner: index === winner,
      color: COLORS[index % COLORS.length],
      left: `${6 + ((index * 17) % 86)}vw`,
      top: `${12 + ((index * 29) % 72)}vh`,
      size: `${54 + (index % 4) * 16}px`,
      delay: `${(index % 7) * 90}ms`,
      rotate: `${(index * 23) % 28 - 14}deg`,
      rotateAlt: `${14 - ((index * 23) % 28)}deg`,
    }));
  }, [active]);

  if (!active) return null;

  const openGift = gift => {
    if (opened !== null) return;
    setOpened(gift.id);
    if (gift.winner) onWin();
    window.setTimeout(onClose, gift.winner ? 1800 : 950);
  };

  return (
    <div className={`delibird-mode ${opened !== null ? 'delibird-mode--opened' : ''}`} aria-live="polite">
      <div className="delibird-snow" aria-hidden="true" />
      {gifts.map(gift => (
        <button
          key={gift.id}
          className={`delibird-gift delibird-gift--${gift.color} ${opened === gift.id ? (gift.winner ? 'is-winner' : 'is-dud') : ''}`}
          type="button"
          aria-label="Abrir regalo de Delibird"
          style={{
            '--gift-left': gift.left,
            '--gift-top': gift.top,
            '--gift-size': gift.size,
            '--gift-delay': gift.delay,
            '--gift-rotate': gift.rotate,
            '--gift-rotate-alt': gift.rotateAlt,
          }}
          onClick={() => openGift(gift)}
        >
          <span />
        </button>
      ))}
    </div>
  );
}
