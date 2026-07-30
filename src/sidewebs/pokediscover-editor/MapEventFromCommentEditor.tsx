import { useEffect, useMemo, useState } from 'react';
import type { AdventureMapV3 } from '../../../packages/contracts/src/index.js';
import type { LoadedAdventureMapBundle } from '../../domain/maps/loadAdventureBundle.js';
import type { PokeDiscoverMapEventDraft } from '../../domain/tools/pokeDiscoverMapEventAuthoring.js';
import type { PokeDiscoverTiledObject } from '../../domain/tools/pokeDiscoverEditorProject.js';

type Step = 'activation' | 'actors' | 'sequence' | 'review';

const STEPS: Step[] = ['activation', 'actors', 'sequence', 'review'];
const ACTIVATION_LABELS = {
  enterZone: 'Al entrar en la zona',
  contextAction: 'Al pulsar E',
  proximity: 'Por proximidad',
  interval: 'Cada cierto tiempo',
  pathCrossing: 'Al cruzar una ruta',
  actorContact: 'Al tocar un actor',
  enterSurface: 'Al entrar en una superficie',
} as const;
const REPEAT_LABELS = {
  oncePerSectorVisit: 'Una vez por estancia en el sector',
  oncePerVisit: 'Una vez por visita',
  repeatable: 'Repetible',
  persistent: 'Única y permanente',
} as const;

export function MapEventFromCommentEditor({
  bundle,
  adventure,
  sectorId,
  comment,
  onCancel,
  onConfirm,
}: {
  bundle: LoadedAdventureMapBundle;
  adventure: AdventureMapV3;
  sectorId: string;
  comment: PokeDiscoverTiledObject;
  onCancel: () => void;
  onConfirm: (draft: PokeDiscoverMapEventDraft) => string | undefined;
}) {
  const placements = useMemo(() => [
    ...adventure.actorPlacements
      .filter(placement => placement.sectorId === sectorId)
      .map(placement => ({ ...placement, actorKind: 'pokemon' as const })),
    ...adventure.characterPlacements
      .filter(placement => placement.sectorId === sectorId && !placement.controllable)
      .map(placement => ({ ...placement, actorKind: 'npc' as const })),
  ], [adventure, sectorId]);
  const [step, setStep] = useState<Step>('activation');
  const [activationKind, setActivationKind] = useState<PokeDiscoverMapEventDraft['activationKind']>('enterZone');
  const [repeatPolicy, setRepeatPolicy] = useState<PokeDiscoverMapEventDraft['repeatPolicy']>('oncePerVisit');
  const [placementId, setPlacementId] = useState(placements[0]?.placementId ?? '');
  const [targetKind, setTargetKind] = useState<'zone' | 'placement'>('zone');
  const [targetPlacementId, setTargetPlacementId] = useState('');
  const [prompt, setPrompt] = useState('Interactuar');
  const [rangeTiles, setRangeTiles] = useState(1);
  const [startAnimation, setStartAnimation] = useState('');
  const [movementAnimation, setMovementAnimation] = useState('');
  const [finalAnimation, setFinalAnimation] = useState('');
  const [finalDirection, setFinalDirection] = useState<'up' | 'down' | 'left' | 'right'>('down');
  const [pathPoints, setPathPoints] = useState<Array<{ x: number; y: number }>>([]);
  const [removeComment, setRemoveComment] = useState(true);
  const [error, setError] = useState('');
  const placement = placements.find(candidate => candidate.placementId === placementId);
  const animationNames = placement?.actorKind === 'pokemon'
    ? bundle.pmdManifest.assets.find(asset => asset.assetId === placement.assetId)
      ?.animations.map(animation => animation.name) ?? []
    : [];
  const stepIndex = STEPS.indexOf(step);
  const cancel = () => {
    window.dispatchEvent(new CustomEvent(
      'pokediscover:select-map-tool',
      { detail: { tool: 'select' } },
    ));
    onCancel();
  };

  useEffect(() => {
    const completePath = (event: Event) => {
      const points = (event as CustomEvent<{ points?: Array<{ x: number; y: number }> }>).detail?.points;
      if (points && points.length >= 2) setPathPoints(points);
    };
    window.addEventListener('pokediscover:event-path-complete', completePath);
    return () => window.removeEventListener('pokediscover:event-path-complete', completePath);
  }, []);

  const next = () => {
    if (step === 'actors' && !placementId) {
      setError('Selecciona al menos un actor afectado.');
      return;
    }
    if (step === 'sequence' && !startAnimation && !finalAnimation && pathPoints.length < 2) {
      setError('Añade una animación o dibuja una ruta para que el evento tenga efecto.');
      return;
    }
    setError('');
    setStep(STEPS[Math.min(STEPS.length - 1, stepIndex + 1)]);
  };
  const previous = () => {
    setError('');
    setStep(STEPS[Math.max(0, stepIndex - 1)]);
  };
  const confirm = () => {
    const result = onConfirm({
      activationKind,
      repeatPolicy,
      placementId,
      ...(startAnimation ? { startAnimation } : {}),
      ...(movementAnimation ? { movementAnimation } : {}),
      ...(finalAnimation ? { finalAnimation } : {}),
      finalDirection,
      finalVisible: true,
      pathPoints,
      movementStyle: 'continuous',
      speedPixelsPerSecond: 64,
      prompt,
      rangeTiles,
      ...(targetKind === 'placement' && activationKind !== 'enterZone'
        ? { targetPlacementId }
        : {}),
      removeComment,
    });
    setError(result ?? '');
  };

  return <section className="editor-map-event-wizard" aria-label="Crear evento desde comentario">
    <header>
      <div>
        <span>Evento espacial</span>
        <strong>{comment.name}</strong>
      </div>
      <button type="button" aria-label="Cancelar evento" onClick={cancel}>×</button>
    </header>
    <ol aria-label="Progreso del evento">
      {['Activación', 'Actores', 'Secuencia', 'Revisión'].map((label, index) => (
        <li key={label} className={index === stepIndex ? 'is-active' : index < stepIndex ? 'is-done' : ''}>
          {index + 1}. {label}
        </li>
      ))}
    </ol>

    {step === 'activation' ? <fieldset>
      <legend>¿Cuándo se activa?</legend>
      <label><input type="radio" checked={activationKind === 'enterZone'} onChange={() => { setActivationKind('enterZone'); setTargetKind('zone'); }} /> Al entrar en la zona</label>
      <label><input type="radio" checked={activationKind === 'contextAction'} onChange={() => setActivationKind('contextAction')} /> Al pulsar E</label>
      <label><input type="radio" checked={activationKind === 'proximity'} onChange={() => setActivationKind('proximity')} /> Por proximidad</label>
      {activationKind !== 'enterZone' ? <label><span>Objetivo</span><select value={targetKind} onChange={event => setTargetKind(event.target.value as 'zone' | 'placement')}>
        <option value="zone">Geometría del comentario</option>
        <option value="placement">Colocación móvil</option>
      </select></label> : null}
      {targetKind === 'placement' && activationKind !== 'enterZone' ? <label><span>Colocación objetivo</span><select value={targetPlacementId} onChange={event => setTargetPlacementId(event.target.value)}>
        <option value="">Seleccionar…</option>
        {placements.map(candidate => <option key={candidate.placementId} value={candidate.placementId}>{candidate.placementId}</option>)}
      </select></label> : null}
      {activationKind === 'contextAction' ? <label><span>Prompt</span><input value={prompt} onChange={event => setPrompt(event.target.value)} /></label> : null}
      {activationKind !== 'enterZone' ? <label><span>Radio (tiles)</span><input type="number" min="1" step="1" value={rangeTiles} onChange={event => setRangeTiles(Math.max(1, Number(event.target.value) || 1))} /></label> : null}
      <label><span>Repetición</span><select value={repeatPolicy} onChange={event => {
        const nextPolicy = event.target.value as PokeDiscoverMapEventDraft['repeatPolicy'];
        setRepeatPolicy(nextPolicy);
        if (nextPolicy === 'repeatable') setPathPoints([]);
      }}>
        <option value="oncePerVisit">Una vez por visita al mapa</option>
        <option value="repeatable">Repetible al rearmarse</option>
        <option value="persistent">Única y persistente</option>
      </select></label>
      <small>“Por visita” recuerda el resultado entre sectores y recargas; una expedición nueva lo reinicia.</small>
    </fieldset> : null}

    {step === 'actors' ? <fieldset>
      <legend>Actor afectado</legend>
      <label><span>Actor</span><select value={placementId} onChange={event => {
        setPlacementId(event.target.value);
        setStartAnimation('');
        setMovementAnimation('');
        setFinalAnimation('');
      }}>
        <option value="">Seleccionar…</option>
        {placements.map(candidate => <option key={candidate.placementId} value={candidate.placementId}>{candidate.placementId}</option>)}
      </select></label>
      <p>En esta primera receta cada evento controla un actor. Se pueden encadenar tantas acciones como necesite.</p>
    </fieldset> : null}

    {step === 'sequence' ? <fieldset>
      <legend>Secuencia</legend>
      {animationNames.length ? <>
        <label><span>Animación inicial</span><select value={startAnimation} onChange={event => setStartAnimation(event.target.value)}>
          <option value="">Sin cambio</option>
          {animationNames.map(name => <option key={name} value={name}>{name}</option>)}
        </select></label>
        <label><span>Animación durante el movimiento</span><select value={movementAnimation} onChange={event => setMovementAnimation(event.target.value)}>
          <option value="">Sin cambio</option>
          {animationNames.map(name => <option key={name} value={name}>{name}</option>)}
        </select></label>
        <label><span>Animación final</span><select value={finalAnimation} onChange={event => setFinalAnimation(event.target.value)}>
          <option value="">Sin cambio</option>
          {animationNames.map(name => <option key={name} value={name}>{name}</option>)}
        </select></label>
      </> : <p>Este actor no tiene animaciones disponibles; configura su recorrido.</p>}
      <div className="editor-map-event-wizard__path">
        <strong>Ruta</strong>
        <span>{pathPoints.length >= 2 ? `${pathPoints.length} puntos definidos` : 'Sin ruta'}</span>
        <button
          type="button"
          disabled={repeatPolicy === 'repeatable'}
          title={repeatPolicy === 'repeatable' ? 'Los eventos repetibles deben terminar en su estado inicial.' : undefined}
          onClick={() => window.dispatchEvent(new CustomEvent(
            'pokediscover:select-map-tool',
            { detail: { tool: 'event-path' } },
          ))}
        >{pathPoints.length ? 'Redibujar sobre el mapa' : 'Dibujar sobre el mapa'}</button>
        {pathPoints.length ? <button type="button" onClick={() => setPathPoints([])}>Quitar ruta</button> : null}
      </div>
      <label><span>Dirección final</span><select value={finalDirection} onChange={event => setFinalDirection(event.target.value as typeof finalDirection)}>
        <option value="up">Arriba</option>
        <option value="down">Abajo</option>
        <option value="left">Izquierda</option>
        <option value="right">Derecha</option>
      </select></label>
    </fieldset> : null}

    {step === 'review' ? <fieldset>
      <legend>Revisar y confirmar</legend>
      <dl>
        <div><dt>Activación</dt><dd>{ACTIVATION_LABELS[activationKind]}</dd></div>
        <div><dt>Repetición</dt><dd>{REPEAT_LABELS[repeatPolicy]}</dd></div>
        <div><dt>Actor</dt><dd>{placementId}</dd></div>
        <div><dt>Ruta</dt><dd>{pathPoints.length >= 2 ? `${pathPoints.length} puntos` : 'Sin ruta'}</dd></div>
        <div><dt>Estado final</dt><dd>{finalAnimation || 'Animación actual'} · {finalDirection}</dd></div>
      </dl>
      <label><input type="checkbox" checked={removeComment} onChange={event => setRemoveComment(event.target.checked)} /> Retirar el comentario al crear el evento</label>
    </fieldset> : null}

    {error ? <p role="alert" className="editor-map-event-wizard__error">{error}</p> : null}
    <footer>
      <button type="button" onClick={stepIndex === 0 ? cancel : previous}>{stepIndex === 0 ? 'Cancelar' : 'Anterior'}</button>
      {step === 'review'
        ? <button type="button" className="is-primary" onClick={confirm}>Crear evento</button>
        : <button type="button" className="is-primary" onClick={next}>Continuar</button>}
    </footer>
  </section>;
}
