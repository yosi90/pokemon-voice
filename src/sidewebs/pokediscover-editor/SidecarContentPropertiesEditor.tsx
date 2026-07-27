import type { AdventureMapV3 } from '../../../packages/contracts/src/index.js';

export function SidecarContentPropertiesEditor({
  adventure,
  contentId,
  onAdventureChange,
  onClose,
}: {
  adventure: AdventureMapV3;
  contentId: string;
  onAdventureChange: (adventure: AdventureMapV3) => void;
  onClose: () => void;
}) {
  const transition = adventure.transitions.find(candidate => candidate.transitionId === contentId);
  const interaction = (adventure.interactions ?? []).find(candidate => candidate.interactionId === contentId);
  if (!transition && !interaction) return null;
  return <section className="editor-sidecar-properties" aria-label="Propiedades del contenido">
    <header>
      <div><span>{transition ? 'Salida' : interaction?.meaningfulKind === 'secret' ? 'Secreto' : 'Interacción'}</span><strong>Contenido seleccionado</strong></div>
      <button type="button" aria-label="Cerrar propiedades" onClick={onClose}>×</button>
    </header>
    {transition ? <>
      <label><span>Orientación al aparecer</span><select value={transition.destinationFacing ?? ''} onChange={event => onAdventureChange({
        ...adventure,
        transitions: adventure.transitions.map(candidate => candidate.transitionId === contentId
          ? { ...candidate, destinationFacing: event.target.value ? event.target.value as 'up' | 'down' | 'left' | 'right' : undefined }
          : candidate),
      })}>
        <option value="">Conservar dirección</option>
        <option value="up">Arriba</option><option value="down">Abajo</option><option value="left">Izquierda</option><option value="right">Derecha</option>
      </select></label>
      <p>Destino: {transition.toSectorId} · {transition.toAnchorId}</p>
    </> : null}
    {interaction ? <>
      <label><span>Texto de acción</span><input value={interaction.prompt} onChange={event => onAdventureChange({
        ...adventure,
        interactions: (adventure.interactions ?? []).map(candidate => candidate.interactionId === contentId
          ? { ...candidate, prompt: event.target.value }
          : candidate),
      })} /></label>
      <label><span>Repetición</span><select value={interaction.repeatPolicy ?? 'oncePerVisit'} onChange={event => onAdventureChange({
        ...adventure,
        interactions: (adventure.interactions ?? []).map(candidate => candidate.interactionId === contentId
          ? { ...candidate, repeatPolicy: event.target.value as typeof candidate.repeatPolicy }
          : candidate),
      })}>
        <option value="oncePerVisit">Una vez por visita</option>
        <option value="repeatable">Siempre</option>
      </select></label>
    </> : null}
    <details><summary>Detalles avanzados</summary><code>{contentId}</code></details>
  </section>;
}
