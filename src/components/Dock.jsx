export function Dock({
  score,
  remaining,
  listening,
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
          <div className="brand"><span className="brand-ball" /> Poke-Voice</div>
          <div className="dock-primary-controls">
            <button id="btnMic" className={`btn ${listening ? 'accent' : ''}`} type="button" onClick={onMic}>
              {listening ? 'Parar' : 'Escuchar'}
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
              <button id="btnGuess" className="btn" type="submit">Adivinar</button>
            </form>
            <button id="btnReset" className="btn danger" type="button" onClick={onReset}>
              Reiniciar
            </button>
          </div>
        </div>
        <div className="dock-secondary">
          <div className="dock-secondary-group">
            <button id="modes-btn" className="btn" type="button" onClick={onModes} title="Modos de juego">
              <span>Modos</span>
            </button>
            <button id="acv-ach-btn" className="btn btn-icon" type="button" aria-label="Logros" title="Logros" onClick={onAchievements}>
              <span>🏆</span>
            </button>
            {timerText && <span className={`chip timer-chip ${timerDanger ? 'danger' : ''}`}>{timerText}</span>}
          </div>
          <div className="dock-secondary-group dock-secondary-group--right">
            <button className="chip chip-click" type="button" onClick={() => onNavigate('guessed')} title="Saltar al siguiente descubierto">
              {score} descubiertos
            </button>
            <button className="chip chip-click" type="button" onClick={() => onNavigate('remaining')} title="Saltar al siguiente restante">
              {remaining} restantes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
