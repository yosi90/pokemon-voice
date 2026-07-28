import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { NarrativeChoiceV1, NarrativePageV1, NarrativePortraitState, NarrativeSequenceV1, TrainerAvatarId, TrainerProfileV1 } from '../../packages/contracts/src/index.js';

const PROFESSOR_PORTRAITS: Partial<Record<NarrativePortraitState, string>> = {
  neutral: 'assets/images/profesor-alcanfor/alcanfor-alegre.png',
  speaking: 'assets/images/profesor-alcanfor/alcanfor-parlanchin.png',
  idea: 'assets/images/profesor-alcanfor/alcanfor-explicando.png',
} as const;

const TRAINER_PORTRAITS: Readonly<Record<TrainerAvatarId, string>> = {
  achaman: 'assets/images/achaman/achaman-saludando.png',
  guayota: 'assets/images/guayota/guayota-y-horquilla-saludando.png',
};

const NARRATIVE_BACKGROUNDS: Readonly<Record<string, string>> = {
  'camphor-laboratory': 'assets/images/fondos/Laboratorio-de-alcanfor.png',
  'trainer-home': 'assets/images/fondos/casa-protagonista.png',
};

function resolveNarrativeBackground(backgroundId?: string) {
  if (!backgroundId) return undefined;
  if (NARRATIVE_BACKGROUNDS[backgroundId]) return NARRATIVE_BACKGROUNDS[backgroundId];
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(backgroundId)
    ? `assets/images/fondos/${backgroundId}.png`
    : undefined;
}

export function NarrativeScene({
  open,
  sequence,
  page,
  onAdvance,
  onChoice,
  onTextSubmit,
  onDismiss,
  trainerProfile,
}: {
  open: boolean;
  sequence?: NarrativeSequenceV1;
  page?: NarrativePageV1;
  onAdvance: () => void;
  onChoice: (choice: NarrativeChoiceV1) => void;
  onTextSubmit: (value: string) => void;
  onDismiss: () => void;
  trainerProfile?: TrainerProfileV1;
}) {
  const [visibleCharacters, setVisibleCharacters] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [textInputValue, setTextInputValue] = useState('');
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener?.('change', update);
    return () => media.removeEventListener?.('change', update);
  }, []);

  useEffect(() => {
    if (!open) return;
    [...Object.values(PROFESSOR_PORTRAITS), ...Object.values(TRAINER_PORTRAITS)].forEach(path => {
      const portrait = new Image();
      portrait.src = `${import.meta.env.BASE_URL}${path}`;
    });
  }, [open]);

  useLayoutEffect(() => {
    if (!page?.textInput) return;
    setTextInputValue(trainerProfile?.displayName ?? '');
  }, [page?.pageId, page?.textInput, trainerProfile?.displayName]);

  useLayoutEffect(() => {
    if (!page) return undefined;
    if (reducedMotion) {
      setVisibleCharacters(page.text.length);
      return undefined;
    }
    setVisibleCharacters(0);
    const timer = window.setInterval(() => {
      setVisibleCharacters(current => {
        if (current >= page.text.length) {
          window.clearInterval(timer);
          return current;
        }
        return Math.min(page.text.length, current + 2);
      });
    }, 24);
    return () => window.clearInterval(timer);
  }, [page, reducedMotion]);

  useEffect(() => {
    if (!open) return undefined;
    const previousFocus = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onDismiss();
        return;
      }
      if ((event.target as HTMLElement | null)?.closest('input, button, form')) return;
      if ((event.key === 'Enter' || event.key === ' ') && !page?.choices?.length) {
        event.preventDefault();
        if (visibleCharacters < (page?.text.length ?? 0)) setVisibleCharacters(page?.text.length ?? 0);
        else onAdvance();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previousFocus?.focus?.();
    };
  }, [onAdvance, onDismiss, open, page, visibleCharacters]);

  if (!open || !sequence || !page) return null;
  const portraitPath = PROFESSOR_PORTRAITS[page.portraitState] ?? 'assets/images/profesor-alcanfor/alcanfor-alegre.png';
  const trainerSelection = page.presentation === 'trainerSelection';
  const trainerName = page.presentation === 'trainerName' && trainerProfile;
  const backgroundPath = resolveNarrativeBackground(page.backgroundId ?? sequence.backgroundId);
  const textComplete = visibleCharacters >= page.text.length;
  const advanceText = () => {
    if (!textComplete) setVisibleCharacters(page.text.length);
    else if (!page.choices?.length) onAdvance();
  };

  return (
    <section
      className="narrative-scene"
      role="dialog"
      aria-modal="true"
      aria-label="Conversación con el profesor Alcanfor"
      data-testid="narrative-scene"
      data-page-id={page.pageId}
    >
      {backgroundPath && (
        <div
          className="narrative-scene__background"
          style={{ backgroundImage: `url("${import.meta.env.BASE_URL}${backgroundPath}")` }}
          aria-hidden="true"
        />
      )}
      <div className="narrative-scene__veil" aria-hidden="true" />
      {!trainerSelection && (
        <div className={`professor-portrait professor-portrait--${page.portraitState} ${trainerName ? 'trainer-portrait' : ''}`}>
          <img
            src={`${import.meta.env.BASE_URL}${trainerName ? TRAINER_PORTRAITS[trainerName.avatarId] : portraitPath}`}
            alt={trainerName ? `${trainerName.displayName}, protagonista elegido` : `Profesor Alcanfor, ${page.portraitState === 'idea' ? 'explicando una idea' : page.portraitState === 'speaking' ? 'hablando' : 'alegre'}`}
          />
        </div>
      )}
      {trainerSelection && (
        <div className="trainer-selection" aria-label="Elige protagonista">
          {page.choices?.map(choice => choice.previewAvatarId && (
            <button
              key={choice.choiceId}
              className={`trainer-selection__option trainer-selection__option--${choice.previewAvatarId}`}
              type="button"
              disabled={!textComplete}
              onClick={() => onChoice(choice)}
              aria-label={choice.label}
            >
              <img src={`${import.meta.env.BASE_URL}${TRAINER_PORTRAITS[choice.previewAvatarId]}`} alt="" aria-hidden="true" />
              <strong>{choice.previewAvatarId === 'achaman' ? 'Achaman' : 'Guayota'}</strong>
              <span>{choice.label}</span>
            </button>
          ))}
        </div>
      )}
      <div className="narrative-box" ref={panelRef} tabIndex={-1} onClick={advanceText}>
        <span className="narrative-box__speaker">{page.speakerName}</span>
        <p className="narrative-box__text" aria-live="polite">{page.text.slice(0, visibleCharacters)}</p>
        {textComplete && page.textInput ? (
          <form className="narrative-name-form" onClick={event => event.stopPropagation()} onSubmit={event => { event.preventDefault(); onTextSubmit(textInputValue); }}>
            <label htmlFor={page.textInput.inputId}>{page.textInput.label}</label>
            <div>
              <input
                id={page.textInput.inputId}
                value={textInputValue}
                maxLength={page.textInput.maxLength}
                autoComplete="nickname"
                autoFocus
                onChange={event => setTextInputValue(event.target.value)}
              />
              <button type="submit">{page.textInput.submitLabel}</button>
            </div>
          </form>
        ) : textComplete && page.choices?.length && !trainerSelection ? (
          <div className="narrative-box__choices">
            {page.choices.map(choice => (
              <button key={choice.choiceId} type="button" onClick={event => { event.stopPropagation(); onChoice(choice); }}>
                {choice.label}
              </button>
            ))}
          </div>
        ) : !page.choices?.length && !page.textInput ? (
          <span className={`narrative-box__advance ${textComplete ? 'is-visible' : ''}`} aria-hidden="true">▼</span>
        ) : null}
        <span className="narrative-box__help">Enter / Espacio · Esc para aplazar</span>
      </div>
    </section>
  );
}
