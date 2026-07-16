import { useEffect, useState, type FormEvent } from 'react';
import { ART_URL } from '../../scripts/utils.js';
import type { WhosThatPokemonCandidate } from '../domain/modes/whosThatPokemon.js';

interface SessionView {
  rounds: WhosThatPokemonCandidate[];
  roundIndex: number;
  score: number;
  textHintsRemaining: number;
  typeHintsRemaining: number;
  textHintCount: number;
  cryUsed: boolean;
  revealedTypes: string[];
  answer?: { correct: boolean; submittedName?: string };
  finished: boolean;
  bestScore: number;
  isNewRecord: boolean;
}

interface WhosThatPokemonModeProps {
  open: boolean;
  busy: boolean;
  currentRound: WhosThatPokemonCandidate | null;
  session: SessionView | null;
  visibleHints: string[];
  listening: boolean;
  speechSupported: boolean;
  voiceStatus?: { message?: string; kind?: string } | null;
  onAnswer: (raw: string, options?: { fromSpeech?: boolean }) => Promise<boolean>;
  onClose: () => void;
  onCry: () => void;
  onHint: () => void;
  onMic: () => void;
  onNext: () => void;
  onSkip: () => void;
  onTypeHint: () => void;
}

const TYPE_LABELS: Record<string, string> = {
  normal: 'Normal', fire: 'Fuego', water: 'Agua', electric: 'Eléctrico', grass: 'Planta', ice: 'Hielo',
  fighting: 'Lucha', poison: 'Veneno', ground: 'Tierra', flying: 'Volador', psychic: 'Psíquico', bug: 'Bicho',
  rock: 'Roca', ghost: 'Fantasma', dragon: 'Dragón', dark: 'Siniestro', steel: 'Acero', fairy: 'Hada',
};

export function WhosThatPokemonMode({
  open,
  busy,
  currentRound,
  session,
  visibleHints,
  listening,
  speechSupported,
  voiceStatus,
  onAnswer,
  onClose,
  onCry,
  onHint,
  onMic,
  onNext,
  onSkip,
  onTypeHint,
}: WhosThatPokemonModeProps) {
  const [answerText, setAnswerText] = useState('');

  useEffect(() => setAnswerText(''), [session?.roundIndex]);
  if (!open || !session || !currentRound) return null;

  const answered = Boolean(session.answer);
  const displayName = currentRound.name.replace(/-/g, ' ');
  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!answerText.trim()) return;
    const accepted = await onAnswer(answerText, { fromSpeech: false });
    if (accepted || session.answer) setAnswerText('');
  };

  return (
    <section className="whos-mode" aria-label="¿Quién es ese Pokémon?">
      <div className="whos-mode__backdrop" />
      <div className="whos-mode__panel">
        <header className="whos-mode__header">
          <div>
            <span className="whos-mode__eyebrow">Modo ligero</span>
            <h2>¿Quién es ese Pokémon?</h2>
          </div>
          <button type="button" className="icon-btn whos-mode__close" aria-label="Salir del modo" onClick={onClose}>✕</button>
        </header>

        {session.finished ? (
          <div className="whos-mode__results" role="status">
            <div className="whos-mode__result-ball" aria-hidden="true">?</div>
            <h3>Racha terminada</h3>
            <span>Racha final</span>
            <strong>{session.score}</strong>
            <p>{session.isNewRecord ? '¡Nuevo récord personal!' : `Tu mejor racha es ${session.bestScore}.`}</p>
            <button className="mode-cta" type="button" onClick={onClose}>Volver a la Pokédex</button>
          </div>
        ) : (
          <>
            <div className="whos-mode__status">
              <span>Racha: {session.score}</span>
            </div>

            <div className={`whos-mode__portrait ${answered ? 'is-revealed' : ''}`} data-target-id={currentRound.id}>
              <div className="whos-mode__rays" aria-hidden="true" />
              <img
                src={ART_URL(currentRound.id)}
                alt={answered ? displayName : 'Silueta de Pokémon desconocido'}
              />
            </div>

            {answered ? (
              <div className={`whos-mode__answer whos-mode__answer--${session.answer?.correct ? 'correct' : 'wrong'}`} aria-live="polite">
                <span>{session.answer?.correct ? '¡Correcto!' : 'No era ese Pokémon.'}</span>
                <strong>¡Es {displayName}!</strong>
                <button className="mode-cta" type="button" onClick={onNext} disabled={busy}>
                  {session.answer?.correct ? 'Siguiente Pokémon' : 'Ver resultado'}
                </button>
              </div>
            ) : (
              <div className="whos-mode__interaction">
                <div className="whos-mode__hints" aria-live="polite">
                  {visibleHints.map(hint => <p key={hint}>{hint}</p>)}
                  {session.revealedTypes.length > 0 && (
                    <div className="whos-mode__types" aria-label="Tipos revelados">
                      {session.revealedTypes.map(type => (
                        <span key={type} data-type={type}>{TYPE_LABELS[type] || type}</span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="whos-mode__actions">
                  {!session.cryUsed && (
                    <button type="button" className="chip chip-click" onClick={onCry} disabled={busy}>
                      Escuchar grito
                    </button>
                  )}
                  <button
                    type="button"
                    className="chip chip-click"
                    onClick={onHint}
                    disabled={session.textHintsRemaining <= 0 || session.textHintCount >= 3 || busy}
                  >
                    Pista de texto · {session.textHintsRemaining}
                  </button>
                  <button
                    type="button"
                    className="chip chip-click"
                    onClick={onTypeHint}
                    disabled={session.typeHintsRemaining <= 0 || session.revealedTypes.length > 0 || busy}
                  >
                    Revelar tipos · {session.typeHintsRemaining}
                  </button>
                  <button type="button" className="chip chip-click whos-mode__give-up" onClick={onSkip} disabled={busy}>Rendirse</button>
                </div>
                <form className="whos-mode__form" onSubmit={handleSubmit}>
                  <button
                    className={`btn whos-mode__mic ${listening ? 'accent' : ''}`}
                    type="button"
                    onClick={onMic}
                    disabled={!speechSupported || busy}
                    aria-label={listening ? 'Parar escucha del modo' : 'Responder por voz'}
                  >
                    🎙
                  </button>
                  <input
                    value={answerText}
                    onChange={event => setAnswerText(event.target.value)}
                    placeholder="Escribe el nombre..."
                    autoComplete="off"
                    disabled={busy}
                    aria-label="Respuesta Pokémon"
                  />
                  <button className="mode-cta" type="submit" disabled={busy || !answerText.trim()}>Responder</button>
                </form>
                {voiceStatus?.message && <p className={`whos-mode__voice voice-status--${voiceStatus.kind || 'info'}`}>{voiceStatus.message}</p>}
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
