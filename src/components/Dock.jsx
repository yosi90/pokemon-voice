export function Dock({
  score,
  remaining,
  listening,
  speechSupported = true,
  voiceStatus,
  guessText,
  onGuessText,
  onGuess,
  onMic,
  onReset,
  onModes,
  onAchievements,
  onNavigate,
  audioBlocked,
  onEnableAudio,
  timerText,
  timerDanger,
}) {
  return (
    <div className="dock" id="dock">
      <div className="dock-inner">
        <div className="dock-main">
          <div className="brand">
            <span className="brand-ball" />
            <span className="brand-mic" aria-hidden="true">🎙</span>
            <span className="brand-text">Poke-Voice</span>
          </div>
          <div className="dock-primary-controls">
            <button
              id="btnMic"
              className={`btn ${listening ? 'accent' : ''}`}
              type="button"
              onClick={onMic}
              disabled={!speechSupported}
              aria-label={listening ? 'Parar escucha' : 'Escuchar por micrófono'}
              title={speechSupported ? (listening ? 'Parar escucha' : 'Escuchar por micrófono') : 'Reconocimiento de voz disponible en Chrome'}
            >
              <span className="mic-label">{listening ? 'Parar' : 'Escuchar'}</span>
              <span className={`control-icon mic-icon ${listening ? '' : 'mic-icon--off'}`} aria-hidden="true">🎙</span>
            </button>
            {voiceStatus?.message && (
              <span className={`chip voice-status voice-status--${voiceStatus.kind || 'info'}`}>
                {voiceStatus.message}
              </span>
            )}
            {audioBlocked && (
              <button className="chip chip-click audio-chip" type="button" onClick={onEnableAudio} title="Activar sonido">
                Activar sonido
              </button>
            )}
            <form className="input-wrap" onSubmit={onGuess}>
              <input
                id="txtGuess"
                type="text"
                placeholder="Escribe un nombre y pulsa Enter."
                autoComplete="off"
                value={guessText}
                onChange={event => onGuessText(event.target.value)}
              />
              <button id="btnGuess" className="btn" type="submit" aria-label="Adivinar" title="Adivinar">
                <span className="control-icon" aria-hidden="true">🔍</span>
              </button>
            </form>
            <button id="btnReset" className="btn danger dock-reset-desktop" type="button" onClick={onReset}>
              Reiniciar
            </button>
          </div>
        </div>
        <div className="dock-secondary">
          <div className="dock-secondary-group">
            <button id="modes-btn" className="btn" type="button" onClick={onModes} title="Modos de juego">
              <span className="nav-action-icon" aria-hidden="true">🎮</span>
              <span className="nav-action-label">Modos</span>
            </button>
            <button id="acv-ach-btn" className="btn" type="button" aria-label="Logros" title="Logros" onClick={onAchievements}>
              <span className="achievement-icon">🏆</span>
              <span className="nav-action-label">Logros</span>
            </button>
            {timerText && <span className={`chip timer-chip ${timerDanger ? 'danger' : ''}`}>{timerText}</span>}
          </div>
          <div className="dock-secondary-group dock-secondary-group--right">
            <button
              className="chip chip-click stat-chip stat-chip--guessed"
              type="button"
              onClick={() => onNavigate('guessed')}
              aria-label={`${score} descubiertos. Saltar al siguiente descubierto`}
              title="Saltar al siguiente descubierto"
            >
              <span className="stat-icon" aria-hidden="true" />
              <span className="stat-value">{score}</span>
              <span className="stat-label">descubiertos</span>
            </button>
            <button
              className="chip chip-click stat-chip stat-chip--remaining"
              type="button"
              onClick={() => onNavigate('remaining')}
              aria-label={`${remaining} restantes. Saltar al siguiente restante`}
              title="Saltar al siguiente restante"
            >
              <span className="stat-icon" aria-hidden="true" />
              <span className="stat-value">{remaining}</span>
              <span className="stat-label">restantes</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
