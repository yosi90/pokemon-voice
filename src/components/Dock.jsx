export function Dock({
  score,
  remaining,
  onModes,
  professorAvailable,
  professorNotification,
  onProfessor,
  onAchievements,
  controlsOpen,
  onControls,
  onNavigate,
  timerText,
  timerDanger,
}) {
  return (
    <nav className="dock" id="dock" aria-label="Navegación principal">
      <div className="dock-inner">
        <div className="brand">
          <span className="brand-ball" />
          <span className="brand-text">Poke-Voice</span>
        </div>
        <div className="dock-secondary">
          <div className="dock-secondary-group dock-secondary-group--navigation">
            {professorAvailable && (
              <button id="professor-btn" className="btn professor-dock-btn" type="button" onClick={onProfessor} title="Poke-Discover · Profesor Alcanfor" aria-label="Profesor Alcanfor">
                <img src={`${import.meta.env.BASE_URL}assets/icons/profesor-alcanfor/hoja-alcanforero.png`} alt="" aria-hidden="true" />
                {professorNotification && <span className="professor-dock-btn__notification" aria-label="Novedad pendiente" />}
                <span className="nav-action-label">Poke-<wbr />Discover</span>
              </button>
            )}
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
              id="pokedex-controls-btn"
              className="btn dock-controls-btn"
              type="button"
              onClick={onControls}
              aria-label="Controles de Pokédex"
              aria-expanded={controlsOpen}
              aria-controls="pokedex-controls-drawer"
              title="Controles de Pokédex"
            >
              <span className="nav-action-icon" aria-hidden="true">⚙</span>
            </button>
            <button
              className="chip chip-click stat-chip stat-chip--guessed"
              type="button"
              onClick={() => onNavigate('guessed')}
              aria-label={`${score} descubiertos. Saltar al siguiente descubierto`}
              title="Descubiertos"
            >
              <span className="stat-icon" aria-hidden="true" />
              <span className="stat-value">{score}</span>
            </button>
            <button
              className="chip chip-click stat-chip stat-chip--remaining"
              type="button"
              onClick={() => onNavigate('remaining')}
              aria-label={`${remaining} restantes. Saltar al siguiente restante`}
              title="Restantes"
            >
              <span className="stat-icon" aria-hidden="true" />
              <span className="stat-value">{remaining}</span>
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
