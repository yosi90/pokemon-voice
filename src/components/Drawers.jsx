export function AchievementsDrawer() {
  return (
    <aside id="acv-drawer" className="side-drawer side-drawer--right" aria-hidden="true" aria-label="Panel de logros">
      <header className="drawer-header">
        <h3>Logros</h3>
        <button id="acv-drawer-close" className="icon-btn" type="button" aria-label="Cerrar">×</button>
      </header>
      <div id="acv-ach-list" className="drawer-content" role="list" />
    </aside>
  );
}

export function ModesDrawer({ open, onClose, onStartTimed }) {
  return (
    <aside id="modes-drawer" className="side-drawer side-drawer--left" aria-hidden={!open} aria-label="Modos">
      <header className="drawer-header">
        <h2>Modos</h2>
        <button className="icon-btn" type="button" aria-label="Cerrar" onClick={onClose}>×</button>
      </header>
      <div className="drawer-content">
        <div className="mode-card">
          <div className="mode-icon">⏱</div>
          <div className="mode-meta">
            <div className="mode-title">Contrarreloj: Coleccionista de logros</div>
            <div className="mode-desc">Tienes 2:00 para desbloquear el máximo número de logros. Resetea cartas y logros al empezar.</div>
          </div>
          <button className="mode-cta" type="button" onClick={onStartTimed}>Empezar</button>
        </div>
      </div>
    </aside>
  );
}
