import type { ExpeditionReportV1 } from '../domain/expeditions/expeditionSession.js';

function totalFindings(report: ExpeditionReportV1) {
  return report.newSecretIds.length
    + report.newNpcIds.length
    + report.newConversationIds.length
    + report.newCollectibleIds.length
    + report.newHintIds.length
    + report.newRouteIds.length
    + report.newResearchFactIds.length;
}

export function ExpeditionReportModal({
  report,
  onClose,
}: {
  report?: ExpeditionReportV1;
  onClose: () => void;
}) {
  if (!report) return null;
  const findings = totalFindings(report);
  return (
    <div className="pv-modal expedition-report" data-testid="expedition-report">
      <div className="pv-modal__backdrop" />
      <section className="pv-modal__panel expedition-report__panel" role="dialog" aria-modal="true" aria-labelledby="expedition-report-title">
        <header className="pv-modal__head">
          <div>
            <span className="expedition-report__eyebrow">Informe de campo</span>
            <h3 id="expedition-report-title">De vuelta con Alcanfor</h3>
          </div>
          <button className="icon-btn" type="button" aria-label="Cerrar informe" onClick={onClose}>×</button>
        </header>
        <div className="pv-modal__body expedition-report__body">
          <p>{findings
            ? `La expedición deja ${findings} ${findings === 1 ? 'hallazgo nuevo' : 'hallazgos nuevos'}.`
            : 'No hay nuevos hallazgos esta vez, pero el mapa conserva todo el progreso anterior.'}</p>
          <div className="expedition-report__stats">
            <article><span>Interacciones</span><strong>{report.meaningfulInteractionCount}</strong></article>
            <article><span>Investigación</span><strong>{report.newResearchFactIds.length}</strong></article>
            <article><span>Experiencia</span><strong>+{report.trainerExperienceGained}</strong></article>
            <article><span>PD</span><strong>+{report.discoveryPointsGained}</strong></article>
          </div>
          {report.companionResearchFactId && (
            <p className="expedition-report__companion">Tu compañero te ha permitido completar una nueva observación.</p>
          )}
          <button className="expedition-report__continue" type="button" autoFocus onClick={onClose}>Continuar</button>
        </div>
      </section>
    </div>
  );
}
