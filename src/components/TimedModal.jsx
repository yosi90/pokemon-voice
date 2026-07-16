export function TimedModal({ open, results, onClose }) {
  if (!open) return null;
  const {
    discovered = 0,
    achievements = [],
    attempts = 0,
    failures = 0,
    accuracy = 0,
    bestStreak = 0,
    voiceDiscoveries = 0,
    textDiscoveries = 0,
    bestScore = 0,
    isNewRecord = false,
  } = results || {};
  return (
    <div className="pv-modal" id="timed-modal">
      <div className="pv-modal__backdrop" onClick={onClose} />
      <div className="pv-modal__panel" role="dialog" aria-modal="true" aria-labelledby="timed-title">
        <header className="pv-modal__head">
          <h3 id="timed-title">Fin del contrarreloj</h3>
          <button className="pv-modal__close" type="button" aria-label="Cerrar" onClick={onClose}>×</button>
        </header>
        <div className="pv-modal__body">
          <div className="results-kpis">
            <div className="kpi"><span>Logros</span><strong>{achievements.length}</strong></div>
            <div className="kpi"><span>Descubiertos</span><strong>{discovered}</strong></div>
            <div className="kpi"><span>Precisión</span><strong>{accuracy}%</strong></div>
            <div className="kpi"><span>Mejor racha</span><strong>×{bestStreak}</strong></div>
            <div className="kpi"><span>Fallos</span><strong>{failures}</strong></div>
            <div className={`kpi ${isNewRecord ? 'kpi--record' : ''}`}>
              <span>{isNewRecord ? 'Nuevo récord' : 'Récord'}</span><strong>{bestScore}</strong>
            </div>
          </div>
          <p className="timed-results-detail">
            {attempts} {attempts === 1 ? 'intento' : 'intentos'} · {voiceDiscoveries} por voz · {textDiscoveries} por texto
          </p>
          {achievements.length ? (
            <details open>
              <summary>Ver logros</summary>
              <ul className="ach-list">
                {achievements.map(item => <li key={item}>{item}</li>)}
              </ul>
            </details>
          ) : <p className="muted">No hubo logros en esta run.</p>}
        </div>
        <footer className="pv-modal__foot">
          <button className="pv-modal__primary" type="button" onClick={onClose}>Aceptar</button>
        </footer>
      </div>
    </div>
  );
}
