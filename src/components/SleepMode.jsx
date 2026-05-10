import { useEffect, useMemo } from 'react';

export function SleepMode({ active, onWake }) {
  const dreams = useMemo(() => Array.from({ length: 34 }, (_, index) => ({
    id: index,
    left: `${(index * 19 + 5) % 96}vw`,
    top: `${(index * 31 + 12) % 88}vh`,
    delay: `${(index % 10) * 140}ms`,
    size: `${12 + (index % 4) * 5}px`,
    drift: `${index % 2 ? -1 : 1}`,
  })), []);

  useEffect(() => {
    if (!active) {
      document.body.classList.remove('sleep-mode');
      return undefined;
    }

    document.body.classList.add('sleep-mode');
    return () => document.body.classList.remove('sleep-mode');
  }, [active]);

  if (!active) return null;

  return (
    <div className="sleep-mode-layer" aria-live="polite">
      <div className="sleep-mode-dim" />
      <div className="sleep-moon" aria-hidden="true" />
      <div className="sleep-notes" aria-hidden="true">
        <span>♪</span>
        <span>♫</span>
        <span>♪</span>
      </div>
      <div className="sleep-zzz-field" aria-hidden="true">
        {dreams.map(dream => (
          <span
            key={dream.id}
            style={{
              '--sleep-left': dream.left,
              '--sleep-top': dream.top,
              '--sleep-delay': dream.delay,
              '--sleep-size': dream.size,
              '--sleep-drift': dream.drift,
            }}
          >
            Zzz
          </span>
        ))}
      </div>
      <button className="sleep-mode-wake" type="button" onClick={onWake}>
        Despertar
      </button>
    </div>
  );
}
