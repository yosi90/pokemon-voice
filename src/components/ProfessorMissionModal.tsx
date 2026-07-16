import { useEffect, useRef } from 'react';

export function ProfessorMissionModal({
  open,
  missionIds,
  onClose,
}: {
  open: boolean;
  missionIds: readonly string[];
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return undefined;
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose, open]);
  if (!open) return null;
  return (
    <div className="pv-modal professor-missions" data-testid="professor-missions">
      <div className="pv-modal__backdrop" onClick={onClose} />
      <section className="pv-modal__panel professor-missions__panel" role="dialog" aria-modal="true" aria-labelledby="professor-missions-title">
        <header className="pv-modal__head">
          <div>
            <span className="professor-missions__eyebrow">Programa PokeDiscover</span>
            <h3 id="professor-missions-title">Profesor Alcanfor</h3>
          </div>
          <button ref={closeRef} className="icon-btn" type="button" aria-label="Cerrar encargos" onClick={onClose}>×</button>
        </header>
        <div className="pv-modal__body professor-missions__body">
          {missionIds.length ? missionIds.map(missionId => (
            <article className="professor-mission-card" key={missionId}>
              <span>Encargo conocido</span>
              <strong>{missionId}</strong>
            </article>
          )) : (
            <div className="professor-missions__empty">
              <img className="camphor-leaf-mark" src={`${import.meta.env.BASE_URL}assets/icons/profesor-alcanfor/hoja-alcanforero.png`} alt="" aria-hidden="true" />
              <h4>Preparando el primer encargo</h4>
              <p>Alcanfor está organizando el material de campo. Volverá a avisarte cuando la primera expedición esté lista.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
