import { useEffect, useMemo } from 'react';

const CONFUSED_LABELS = [
  '¿Qué?',
  'Pato',
  'Migraña',
  '???',
  'Error 54',
  'Ayuda',
  'Confuso',
  'No sé',
  'Quizá',
  'Psy?',
  'Duck!',
  'Dolor',
];

function pick(index) {
  return CONFUSED_LABELS[index % CONFUSED_LABELS.length];
}

function restoreButtonLabels() {
  document.querySelectorAll('button[data-psyduck-original]').forEach(button => {
    button.textContent = button.dataset.psyduckOriginal;
    delete button.dataset.psyduckOriginal;
  });
}

export function PsyduckMode({ active, onDisable }) {
  const marks = useMemo(() => Array.from({ length: 42 }, (_, index) => ({
    id: index,
    left: `${(index * 23 + 7) % 101}vw`,
    top: `${(index * 37 + 11) % 94}vh`,
    delay: `${(index % 9) * 90}ms`,
    size: `${18 + (index % 5) * 8}px`,
    rotate: `${(index * 29) % 44 - 22}deg`,
  })), []);

  useEffect(() => {
    if (!active) {
      document.body.classList.remove('psyduck-mode');
      restoreButtonLabels();
      return undefined;
    }

    document.body.classList.add('psyduck-mode');

    const scramble = () => {
      document.querySelectorAll('button:not([data-psyduck-safe])').forEach((button, index) => {
        if (!button.dataset.psyduckOriginal) {
          button.dataset.psyduckOriginal = button.textContent;
        }
        button.textContent = pick(index + Math.floor(Date.now() / 900));
      });
    };

    scramble();
    const timer = window.setInterval(scramble, 900);

    return () => {
      window.clearInterval(timer);
      document.body.classList.remove('psyduck-mode');
      restoreButtonLabels();
    };
  }, [active]);

  if (!active) return null;

  return (
    <div className="psyduck-mode-layer" aria-live="polite">
      <div className="psyduck-question-field" aria-hidden="true">
        {marks.map(mark => (
          <span
            key={mark.id}
            style={{
              '--psy-left': mark.left,
              '--psy-top': mark.top,
              '--psy-delay': mark.delay,
              '--psy-size': mark.size,
              '--psy-rotate': mark.rotate,
            }}
          >
            ?
          </span>
        ))}
      </div>
      <button
        className="psyduck-mode-exit"
        type="button"
        data-psyduck-safe="true"
        onClick={onDisable}
      >
        Quitar Psyduck mode
      </button>
    </div>
  );
}
