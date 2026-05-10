export function TimedModal({ open, discovered, achievements, onClose }) {
  if (!open) return null;
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
            <div className="kpi"><span>Descubiertos</span><strong>{discovered}</strong></div>
            <div className="kpi"><span>Logros</span><strong>{achievements.length}</strong></div>
          </div>
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
