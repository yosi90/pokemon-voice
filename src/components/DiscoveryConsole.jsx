export function DiscoveryConsole({
  listening,
  speechSupported = true,
  voiceStatus,
  guessText,
  onGuessText,
  onGuess,
  onMic,
  audioBlocked,
  onEnableAudio,
}) {
  return (
    <section className="discovery-console" aria-label="Descubrimiento por voz o texto">
      <div className="discovery-console__controls">
        <button
          id="btnMic"
          className={`btn discovery-console__mic ${listening ? 'accent' : ''}`}
          type="button"
          onClick={onMic}
          disabled={!speechSupported}
          aria-label={listening ? 'Parar escucha' : 'Escuchar por micrófono'}
          title={speechSupported ? (listening ? 'Parar escucha' : 'Escuchar por micrófono') : 'Reconocimiento de voz disponible en Chrome'}
        >
          <span className={`control-icon mic-icon ${listening ? '' : 'mic-icon--off'}`} aria-hidden="true">🎙</span>
          <span>{listening ? 'Escuchando' : 'Hablar'}</span>
        </button>
        <form className="input-wrap discovery-console__input" onSubmit={onGuess}>
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
        <div className="discovery-console__feedback" aria-live="polite">
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
        </div>
      </div>
    </section>
  );
}
