import { useEffect, useRef } from 'react';
import { MODE_DEFINITIONS } from '../domain/modes/modeDefinitions.js';
import {
  DAILY_TRIVIA_MODE_ID,
  THEMED_CHALLENGES_MODE_ID,
  WHOS_THAT_POKEMON_MODE_ID,
} from '../domain/modes/modeDefinitions.js';
import { getBrowserPokeVoiceSave } from '../store/browserPokeVoiceSaveStore.js';

export function ModesDrawer({ open, onClose, onStartMode }) {
  const drawerRef = useRef(null);
  const modeProgress = getBrowserPokeVoiceSave().pokeDiscover.modeProgress;

  useEffect(() => {
    if (!open) return undefined;
    const handleKeyDown = event => {
      if (event.key === 'Escape') onClose();
    };
    const handlePointerDown = event => {
      const trigger = document.getElementById('modes-btn');
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
    <>
    {open && <div className="drawer-dismiss-layer" aria-hidden="true" onClick={onClose} />}
    <aside id="modes-drawer" className="side-drawer side-drawer--left" aria-hidden={!open} aria-label="Modos" ref={drawerRef}>
      <header className="drawer-header">
        <h2>Modos</h2>
        <button className="icon-btn" type="button" aria-label="Cerrar" onClick={onClose}>×</button>
      </header>
      <div className="drawer-content">
        {MODE_DEFINITIONS.map(mode => (
          <div className="mode-card" key={mode.modeId} data-mode-id={mode.modeId} data-run-policy={mode.runPolicy}>
            <div className="mode-icon">{{
              [DAILY_TRIVIA_MODE_ID]: '📅',
              [WHOS_THAT_POKEMON_MODE_ID]: '❓',
              [THEMED_CHALLENGES_MODE_ID]: '🧭',
            }[mode.modeId] || '⏱'}</div>
            <div className="mode-meta">
              <div className="mode-title">{mode.title}</div>
              <div className="mode-desc">{mode.description}</div>
              {(modeProgress[mode.modeId]?.completed || modeProgress[mode.modeId]?.bestScore > 0) && (
                <div className="mode-progress">
                  {mode.modeId === WHOS_THAT_POKEMON_MODE_ID
                    ? `Mejor racha: ${modeProgress[mode.modeId].bestScore ?? 0}`
                    : mode.modeId === THEMED_CHALLENGES_MODE_ID
                      ? `${modeProgress[mode.modeId].completedChallengeIds?.length ?? 0} ${(modeProgress[mode.modeId].completedChallengeIds?.length ?? 0) === 1 ? 'reto superado' : 'retos superados'}`
                    : mode.modeId === DAILY_TRIVIA_MODE_ID
                      ? `Racha: ${modeProgress[mode.modeId].dailyStreak ?? 0} · Mejor: ${modeProgress[mode.modeId].bestDailyStreak ?? 0}`
                    : `Récord: ${modeProgress[mode.modeId].bestScore ?? 0} logros`}
                  {modeProgress[mode.modeId].completionCount > 0 && (
                    <> · {modeProgress[mode.modeId].completionCount} {modeProgress[mode.modeId].completionCount === 1 ? 'partida' : 'partidas'}</>
                  )}
                </div>
              )}
            </div>
            <button className="mode-cta" type="button" onClick={() => onStartMode(mode.modeId)}>Empezar</button>
          </div>
        ))}
      </div>
    </aside>
    </>
  );
}
