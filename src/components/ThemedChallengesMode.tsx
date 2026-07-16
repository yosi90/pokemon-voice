import { useEffect, useState, type FormEvent } from 'react';
import type { ThemedChallengeDefinitionV1 } from '../../packages/contracts/src/index.js';
import { ART_URL } from '../../scripts/utils.js';
import {
  THEMED_CHALLENGE_KIND_LABELS,
  type ThemedChallengeCandidate,
} from '../domain/modes/themedChallenges.js';

const CHALLENGES_PER_PAGE = 6;

interface SessionView {
  challenges: ThemedChallengeDefinitionV1[];
  completedChallengeIds: string[];
  activeChallenge?: ThemedChallengeDefinitionV1;
  foundIds: number[];
  finished: boolean;
  dailyStreak?: number;
}

interface ThemedChallengesModeProps {
  open: boolean;
  busy: boolean;
  session: SessionView | null;
  foundPokemon: ThemedChallengeCandidate[];
  listening: boolean;
  speechSupported: boolean;
  voiceStatus?: { message?: string; kind?: string } | null;
  onAnswer: (raw: string, options?: { fromSpeech?: boolean }) => Promise<boolean>;
  onClose: () => void;
  onMic: () => void;
  onReturnToSelection: () => void;
  onSelectChallenge: (challengeId: string) => void;
  variant?: 'catalog' | 'daily';
}

export function ThemedChallengesMode({
  open,
  busy,
  session,
  foundPokemon,
  listening,
  speechSupported,
  voiceStatus,
  onAnswer,
  onClose,
  onMic,
  onReturnToSelection,
  onSelectChallenge,
  variant = 'catalog',
}: ThemedChallengesModeProps) {
  const [answerText, setAnswerText] = useState('');
  const [page, setPage] = useState(0);
  useEffect(() => setAnswerText(''), [session?.activeChallenge?.challengeId, session?.foundIds.length]);
  useEffect(() => setPage(0), [session?.challenges]);
  if (!open || !session) return null;

  const challenge = session.activeChallenge;
  const totalPages = Math.max(1, Math.ceil(session.challenges.length / CHALLENGES_PER_PAGE));
  const visiblePage = Math.min(page, totalPages - 1);
  const visibleChallenges = session.challenges.slice(
    visiblePage * CHALLENGES_PER_PAGE,
    (visiblePage + 1) * CHALLENGES_PER_PAGE,
  );
  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!answerText.trim()) return;
    const accepted = await onAnswer(answerText, { fromSpeech: false });
    if (accepted) setAnswerText('');
  };

  const isDaily = variant === 'daily';
  const modeTitle = isDaily ? 'Examen diario' : 'Trivia Pokémon';

  return (
    <section className="themed-mode" aria-label={modeTitle}>
      <div className="themed-mode__backdrop" />
      <div className="themed-mode__panel" role="dialog" aria-modal="true" aria-labelledby="themed-mode-title">
        <header className="themed-mode__header">
          <h2 id="themed-mode-title">{modeTitle}</h2>
          <button type="button" className="icon-btn themed-mode__close" aria-label={`Salir de ${modeTitle}`} onClick={onClose}>✕</button>
        </header>

        {!challenge ? (
          <div className="themed-mode__selection">
            <div className="themed-mode__challenge-grid">
              {visibleChallenges.map(option => {
                const completed = session.completedChallengeIds.includes(option.challengeId);
                return (
                  <button
                    type="button"
                    className={`themed-challenge-card themed-challenge-card--${option.kind}`}
                    key={option.challengeId}
                    onClick={() => onSelectChallenge(option.challengeId)}
                  >
                    <span>{THEMED_CHALLENGE_KIND_LABELS[option.kind]}</span>
                    <strong>{option.title}</strong>
                    <small>{option.description}</small>
                    <b>{option.targetCount} respuestas distintas</b>
                    {completed && <em>✓ Completado</em>}
                  </button>
                );
              })}
            </div>
            {totalPages > 1 && (
              <nav className="themed-mode__pagination" aria-label="Páginas de Trivia Pokémon">
                <button
                  type="button"
                  aria-label="Página anterior"
                  onClick={() => setPage(current => Math.max(0, current - 1))}
                  disabled={visiblePage === 0}
                >
                  ‹
                </button>
                {Array.from({ length: totalPages }, (_, index) => (
                  <button
                    type="button"
                    key={index}
                    aria-label={`Ir a la página ${index + 1}`}
                    aria-current={visiblePage === index ? 'page' : undefined}
                    onClick={() => setPage(index)}
                  >
                    {index + 1}
                  </button>
                ))}
                <button
                  type="button"
                  aria-label="Página siguiente"
                  onClick={() => setPage(current => Math.min(totalPages - 1, current + 1))}
                  disabled={visiblePage === totalPages - 1}
                >
                  ›
                </button>
                <span>Página {visiblePage + 1} de {totalPages}</span>
              </nav>
            )}
          </div>
        ) : (
          <div className={`themed-mode__game themed-mode__game--${challenge.kind}`} data-challenge-id={challenge.challengeId}>
            <div className="themed-mode__challenge-heading">
              <span>{THEMED_CHALLENGE_KIND_LABELS[challenge.kind]}</span>
              <h3>{challenge.title}</h3>
              <p>{challenge.description}</p>
              <strong aria-label="Progreso del reto">{session.foundIds.length}/{challenge.targetCount}</strong>
            </div>

            <div className="themed-mode__findings" aria-label="Pokémon acertados" aria-live="polite">
              {Array.from({ length: challenge.targetCount }, (_, index) => {
                const pokemon = foundPokemon[index];
                return pokemon ? (
                  <div className="themed-mode__finding is-found" key={pokemon.id}>
                    <img src={ART_URL(pokemon.id)} alt="" />
                    <span>{pokemon.name.replace(/-/g, ' ')}</span>
                  </div>
                ) : <div className="themed-mode__finding" key={`empty:${index}`} aria-hidden="true">?</div>;
              })}
            </div>

            {session.finished ? (
              <div className="themed-mode__result" role="status">
                <strong>{isDaily ? '¡Examen diario aprobado!' : '¡Investigación completada!'}</strong>
                <p>{isDaily
                  ? `Racha actual: ${session.dailyStreak ?? 1}. Mañana tendrás un examen nuevo.`
                  : 'Puedes repetirla sin perder nada o probar otra clase de reto.'}</p>
                <button className="mode-cta" type="button" onClick={isDaily ? onClose : onReturnToSelection}>
                  {isDaily ? 'Cerrar' : 'Elegir otro reto'}
                </button>
              </div>
            ) : (
              <form className="themed-mode__form" onSubmit={handleSubmit}>
                <button
                  className={`btn themed-mode__mic ${listening ? 'accent' : ''}`}
                  type="button"
                  onClick={onMic}
                  disabled={!speechSupported || busy}
                  aria-label={listening ? 'Parar escucha del reto' : 'Responder al reto por voz'}
                >
                  🎙
                </button>
                <input
                  value={answerText}
                  onChange={event => setAnswerText(event.target.value)}
                  placeholder="Di o escribe un Pokémon..."
                  autoComplete="off"
                  disabled={busy}
                  aria-label="Respuesta del reto temático"
                />
                <button className="mode-cta" type="submit" disabled={busy || !answerText.trim()}>Comprobar</button>
              </form>
            )}
            {voiceStatus?.message && <p className={`themed-mode__voice voice-status--${voiceStatus.kind || 'info'}`}>{voiceStatus.message}</p>}
            {!isDaily && <button className="themed-mode__back" type="button" onClick={onReturnToSelection}>← Volver a categorías</button>}
          </div>
        )}
      </div>
    </section>
  );
}
