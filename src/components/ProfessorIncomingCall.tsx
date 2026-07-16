export function ProfessorIncomingCall({ onAnswer }: { onAnswer: () => void }) {
  return (
    <aside className="professor-call" role="status" aria-live="polite" aria-label="Llamada entrante del profesor Alcanfor">
      <div className="professor-call__signal" aria-hidden="true">
        <span>☎</span>
        <img src={`${import.meta.env.BASE_URL}assets/icons/profesor-alcanfor/hoja-alcanforero.png`} alt="" />
      </div>
      <div className="professor-call__copy">
        <span>Llamada entrante</span>
        <strong>Profesor Alcanfor</strong>
      </div>
      <button type="button" onClick={onAnswer}>
        <span aria-hidden="true">☎</span>
        Descolgar
      </button>
    </aside>
  );
}
