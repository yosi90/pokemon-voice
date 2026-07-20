import { useCallback, useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import {
  createTechnicalPhaserGame,
  MAP_EXPRESSION_AVAILABLE_EVENT,
  MAP_EXPRESSION_CONTROL_EVENT,
  MAP_EXPRESSION_REQUEST_EVENT,
  MAP_EXPRESSION_STARTED_EVENT,
  MAP_INTERACTION_AVAILABLE_EVENT,
  MAP_INTERACTION_COMPLETED_EVENT,
  MAP_INTERACTION_CONTROL_EVENT,
  MAP_INTERACTION_REQUEST_EVENT,
  MAP_INTERACTION_STARTED_EVENT,
  MAP_SPECIES_IDENTIFIED_EVENT,
  type MapInteractionPresentation,
} from '../domain/maps/createTechnicalPhaserGame.js';
import { loadAdventureMapBundle } from '../domain/maps/loadAdventureBundle.js';
import {
  getBrowserPokeVoiceSave,
  recordBrowserMeaningfulExpeditionInteraction,
} from '../store/browserPokeVoiceSaveStore.js';
import { browserDiscoveryStore } from '../store/browserDiscoveryStore.js';
import { captureLocalAcousticExpression } from '../services/captureLocalAcousticExpression.js';
import type { AcousticExpressionFeatures } from '../domain/expeditions/expressionTriggers.js';
import type {
  ExpeditionExpressionTriggerV1,
  ExpeditionInteractionV1,
} from '../../packages/contracts/src/index.js';

export interface MapExpressionFeedback {
  status: 'resolved' | 'alreadyResolved' | 'ineligible' | 'methodUnavailable' | 'notMatched';
  understoodText?: string;
  message: string;
  acoustic?: AcousticExpressionFeatures;
  nonce: number;
}

const PREVIEW_ADVENTURE_PATH = 'assets/adventure/maps/tegueste-forest/tegueste-forest.adventure.json';
export const TEGUESTE_FOREST_PREVIEW_MAP_ID = 'map:tegueste:camphor-forest';
export const TEGUESTE_FOREST_PREVIEW_ROOM_ID = 'room:tegueste-forest:02-04';

export function MapConceptPreview({
  open,
  listening,
  speechSupported,
  onMic,
  onSubmitText,
  onVisibleSpeciesIdsChange,
  onInteractionStart,
  onExpressionStart,
  onExpressionEnd,
  onExpressionFallback,
  onExpressionAcoustic,
  expressionFeedback,
  loadingText,
  onClose,
}: {
  open: boolean;
  listening: boolean;
  speechSupported: boolean;
  onMic: () => void;
  onSubmitText: (value: string) => boolean | Promise<boolean>;
  onVisibleSpeciesIdsChange: (speciesIds: number[]) => void;
  onInteractionStart: () => void;
  onExpressionStart: (trigger: ExpeditionExpressionTriggerV1) => void;
  onExpressionEnd: () => void;
  onExpressionFallback: () => void;
  onExpressionAcoustic: (features: AcousticExpressionFeatures) => void;
  expressionFeedback?: MapExpressionFeedback | null;
  loadingText: string;
  onClose: () => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [writtenName, setWrittenName] = useState('');
  const [availableInteraction, setAvailableInteraction] = useState<ExpeditionInteractionV1>();
  const [availableExpression, setAvailableExpression] = useState<ExpeditionExpressionTriggerV1>();
  const [activeExpression, setActiveExpression] = useState<ExpeditionExpressionTriggerV1>();
  const [acousticStatus, setAcousticStatus] = useState<'idle' | 'requesting' | 'listening' | 'error'>('idle');
  const [acousticProgress, setAcousticProgress] = useState(0);
  const [acousticError, setAcousticError] = useState<string>();
  const acousticAbortRef = useRef<AbortController | undefined>(undefined);
  const [interactionPresentation, setInteractionPresentation] = useState<MapInteractionPresentation>();
  const [dialoguePageId, setDialoguePageId] = useState<string>();

  const finishDialogue = useCallback((completed: boolean) => {
    hostRef.current?.dispatchEvent(new CustomEvent(MAP_INTERACTION_CONTROL_EVENT, {
      detail: { command: completed ? 'complete' : 'dismiss' },
    }));
    setInteractionPresentation(undefined);
    setDialoguePageId(undefined);
  }, []);

  const submitWrittenName = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = writtenName.trim();
    if (!value) return;
    await onSubmitText(value);
    setWrittenName('');
  };

  const finishExpression = useCallback((completed: boolean) => {
    acousticAbortRef.current?.abort();
    acousticAbortRef.current = undefined;
    hostRef.current?.dispatchEvent(new CustomEvent(MAP_EXPRESSION_CONTROL_EVENT, {
      detail: { command: completed ? 'complete' : 'dismiss' },
    }));
    setActiveExpression(undefined);
    setAcousticStatus('idle');
    setAcousticProgress(0);
    setAcousticError(undefined);
    onExpressionEnd();
  }, [onExpressionEnd]);

  const captureAcoustic = useCallback(async () => {
    if (!activeExpression || acousticStatus === 'requesting' || acousticStatus === 'listening') return;
    if (listening) onMic();
    const controller = new AbortController();
    acousticAbortRef.current = controller;
    setAcousticStatus('requesting');
    setAcousticProgress(0);
    setAcousticError(undefined);
    try {
      const features = await captureLocalAcousticExpression({
        signal: controller.signal,
        onProgress: elapsedMs => {
          setAcousticStatus('listening');
          setAcousticProgress(Math.min(1, elapsedMs / 1800));
        },
      });
      if (!controller.signal.aborted) {
        setAcousticStatus('idle');
        setAcousticProgress(1);
        onExpressionAcoustic(features);
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setAcousticStatus('error');
      setAcousticError(error instanceof Error ? error.message : 'No se pudo analizar el sonido.');
    } finally {
      if (acousticAbortRef.current === controller) acousticAbortRef.current = undefined;
    }
  }, [acousticStatus, activeExpression, listening, onExpressionAcoustic, onMic]);

  useEffect(() => () => acousticAbortRef.current?.abort(), []);

  useEffect(() => {
    if (!activeExpression || !expressionFeedback) return;
    if (expressionFeedback.status === 'resolved' || expressionFeedback.status === 'alreadyResolved') {
      const timer = window.setTimeout(() => finishExpression(true), 900);
      return () => window.clearTimeout(timer);
    }
  }, [activeExpression, expressionFeedback, finishExpression]);

  useEffect(() => {
    if (!open) return undefined;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (interactionPresentation) finishDialogue(false);
      else if (activeExpression) finishExpression(false);
      else onClose();
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [activeExpression, finishDialogue, finishExpression, interactionPresentation, onClose, open]);

  useEffect(() => {
    if (!open || !interactionPresentation) return undefined;
    const advanceOnKeyboard = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      if ((event.target as HTMLElement | null)?.closest('button, input, form')) return;
      event.preventDefault();
      const page = interactionPresentation.dialogue.pages.find(candidate => candidate.pageId === dialoguePageId);
      if (page?.nextPageId) setDialoguePageId(page.nextPageId);
      else finishDialogue(true);
    };
    document.addEventListener('keydown', advanceOnKeyboard);
    return () => document.removeEventListener('keydown', advanceOnKeyboard);
  }, [dialoguePageId, finishDialogue, interactionPresentation, open]);

  useEffect(() => {
    if (!open || !hostRef.current) return undefined;
    let cancelled = false;
    let game: import('phaser').Game | undefined;
    const host = hostRef.current;
    const interactionAvailable = (event: Event) => {
      const detail = (event as CustomEvent<{ interaction?: ExpeditionInteractionV1 }>).detail;
      setAvailableInteraction(detail?.interaction);
    };
    const interactionStarted = (event: Event) => {
      const detail = (event as CustomEvent<MapInteractionPresentation>).detail;
      if (!detail) return;
      onInteractionStart();
      setAvailableInteraction(undefined);
      setInteractionPresentation(detail);
      setDialoguePageId(detail.dialogue.initialPageId);
    };
    const expressionAvailable = (event: Event) => {
      const detail = (event as CustomEvent<{ trigger?: ExpeditionExpressionTriggerV1 }>).detail;
      setAvailableExpression(detail?.trigger);
    };
    const expressionStarted = (event: Event) => {
      const trigger = (event as CustomEvent<{ trigger?: ExpeditionExpressionTriggerV1 }>).detail?.trigger;
      if (!trigger) return;
      onExpressionStart(trigger);
      setAvailableExpression(undefined);
      setActiveExpression(trigger);
      setWrittenName('');
      setAcousticStatus('idle');
      setAcousticProgress(0);
      setAcousticError(undefined);
    };
    const interactionCompleted = (event: Event) => {
      const interaction = (event as CustomEvent<{ interaction?: ExpeditionInteractionV1 }>).detail?.interaction;
      if (!interaction || !getBrowserPokeVoiceSave().activeExpeditionSession) return;
      recordBrowserMeaningfulExpeditionInteraction({
        interactionId: interaction.interactionId,
        kind: interaction.meaningfulKind,
      });
    };
    host.addEventListener(MAP_INTERACTION_AVAILABLE_EVENT, interactionAvailable);
    host.addEventListener(MAP_INTERACTION_STARTED_EVENT, interactionStarted);
    host.addEventListener(MAP_INTERACTION_COMPLETED_EVENT, interactionCompleted);
    host.addEventListener(MAP_EXPRESSION_AVAILABLE_EVENT, expressionAvailable);
    host.addEventListener(MAP_EXPRESSION_STARTED_EVENT, expressionStarted);
    setStatus('loading');
    host.dataset.runtime = 'loading';
    host.focus({ preventScroll: true });

    Promise.all([
      import('phaser'),
      loadAdventureMapBundle({
        adventurePath: PREVIEW_ADVENTURE_PATH,
        baseUrl: import.meta.env.BASE_URL,
      }),
    ]).then(([Phaser, bundle]) => {
      if (cancelled) return;
      const room = bundle.rooms.find(candidate => candidate.room.roomId === TEGUESTE_FOREST_PREVIEW_ROOM_ID);
      const visibleSpeciesIds = [...new Set(bundle.adventure.actorPlacements
        .filter(placement => placement.roomId === TEGUESTE_FOREST_PREVIEW_ROOM_ID)
        .map(placement => room?.actorAssets.get(placement.assetId)?.speciesId)
        .filter((speciesId): speciesId is number => Number.isSafeInteger(speciesId)))];
      onVisibleSpeciesIdsChange(visibleSpeciesIds);
      const save = getBrowserPokeVoiceSave();
      const mapProgress = save.pokeDiscover.mapProgress[bundle.adventure.mapId];
      game = createTechnicalPhaserGame({
        Phaser,
        parent: host,
        bundle,
        initialRoomId: TEGUESTE_FOREST_PREVIEW_ROOM_ID,
        reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
        registeredSpeciesIds: new Set(save.pokedexRun.registeredSpeciesIds),
        expressionsEnabled: save.activeExpeditionSession?.mapId === bundle.adventure.mapId,
        resolvedExpressionTriggerIds: new Set(Object.keys(mapProgress?.resolvedExpressionTriggers ?? {})),
        onReady: () => {
          if (cancelled) return;
          host.dataset.runtime = 'ready';
          host.dataset.mapId = bundle.adventure.mapId;
          setStatus('ready');
          host.focus({ preventScroll: true });
        },
      });
    }).catch(error => {
      console.error('No se pudo iniciar la habitación de Tegueste:', error);
      if (!cancelled) {
        host.dataset.runtime = 'error';
        setStatus('error');
      }
    });

    return () => {
      cancelled = true;
      game?.destroy(true);
      host.removeEventListener(MAP_INTERACTION_AVAILABLE_EVENT, interactionAvailable);
      host.removeEventListener(MAP_INTERACTION_STARTED_EVENT, interactionStarted);
      host.removeEventListener(MAP_INTERACTION_COMPLETED_EVENT, interactionCompleted);
      host.removeEventListener(MAP_EXPRESSION_AVAILABLE_EVENT, expressionAvailable);
      host.removeEventListener(MAP_EXPRESSION_STARTED_EVENT, expressionStarted);
      host.replaceChildren();
      onVisibleSpeciesIdsChange([]);
      setAvailableInteraction(undefined);
      setAvailableExpression(undefined);
      setActiveExpression(undefined);
      setInteractionPresentation(undefined);
      setDialoguePageId(undefined);
    };
  }, [onExpressionStart, onInteractionStart, onVisibleSpeciesIdsChange, open]);

  useEffect(() => {
    if (!open || !hostRef.current) return undefined;
    const host = hostRef.current;
    let previous = new Set(browserDiscoveryStore.getSnapshot().guessedIds);
    return browserDiscoveryStore.subscribe(() => {
      const current = browserDiscoveryStore.getSnapshot().guessedIds;
      for (const speciesId of current) {
        if (!previous.has(speciesId)) {
          host.dispatchEvent(new CustomEvent(MAP_SPECIES_IDENTIFIED_EVENT, { detail: { speciesId } }));
        }
      }
      previous = new Set(current);
    });
  }, [open]);

  if (!open) return null;
  const dialoguePage = interactionPresentation?.dialogue.pages
    .find(candidate => candidate.pageId === dialoguePageId);
  const activeAcousticMatchers = activeExpression?.matchAny.filter(matcher => matcher.kind === 'acoustic') ?? [];
  const acceptsAcoustic = activeAcousticMatchers.length > 0 && activeExpression?.inputMethods.includes('voice');
  const acceptsWrittenText = activeExpression?.inputMethods.includes('text') ?? false;
  const acceptsSpokenText = Boolean(activeExpression?.inputMethods.includes('voice')
    && activeExpression.matchAny.some(matcher => matcher.kind !== 'acoustic'));
  return (
    <div className="pv-modal map-concept-preview" data-testid="map-concept-preview">
      <div className="pv-modal__backdrop" />
      <section className="pv-modal__panel map-concept-preview__panel" role="dialog" aria-modal="true" aria-labelledby="map-concept-preview-title">
        <header className="pv-modal__head">
          <h3 id="map-concept-preview-title">¡Ayuda al profesor Alcanfor!</h3>
          <button className="map-concept-preview__power" type="button" onClick={onClose}>
            <span aria-hidden="true">⏻</span>
            Abandonar misión
          </button>
        </header>
        <div className="map-concept-preview__upper-shell">
          <div className="map-concept-preview__speaker map-concept-preview__speaker--left" aria-hidden="true" />
          <div className="map-concept-preview__viewport">
            <div
              ref={hostRef}
              className="map-concept-preview__runtime"
              data-testid="technical-map-runtime"
              role="img"
              tabIndex={0}
              aria-label="Habitación del Bosque de Tegueste con protagonista, Alcanfor y Pokémon animados"
            />
            {status !== 'ready' && (
              <div className="map-concept-preview__status" role="status">
                {status === 'error' ? 'No se pudo cargar el Bosque de Tegueste.' : loadingText}
              </div>
            )}
            {availableInteraction && !interactionPresentation && (
              <button
                className="map-concept-preview__interaction-prompt"
                type="button"
                onClick={() => hostRef.current?.dispatchEvent(new CustomEvent(MAP_INTERACTION_REQUEST_EVENT, {
                  detail: { interactionId: availableInteraction.interactionId },
                }))}
              >
                <kbd>E</kbd>
                {availableInteraction.prompt}
              </button>
            )}
            {availableExpression && !availableInteraction && !interactionPresentation && !activeExpression && (
              <button
                className="map-concept-preview__interaction-prompt map-concept-preview__interaction-prompt--expression"
                type="button"
                onClick={() => hostRef.current?.dispatchEvent(new CustomEvent(MAP_EXPRESSION_REQUEST_EVENT, {
                  detail: { triggerId: availableExpression.triggerId },
                }))}
              >
                <kbd>E</kbd>
                {availableExpression.prompt}
              </button>
            )}
            {activeExpression && (
              <section className="map-concept-preview__expression" aria-label="Interacción expresiva" aria-live="polite">
                <strong>{activeExpression.prompt}</strong>
                <p>
                  {expressionFeedback?.understoodText
                    ? `He entendido: “${expressionFeedback.understoodText}”. ${expressionFeedback.message}`
                    : expressionFeedback?.message ?? (acceptsAcoustic
                      ? 'Pulsa «Escuchar sonido» cuando estés preparado. El análisis dura menos de dos segundos.'
                      : 'Puedes hablar, escribir o usar la alternativa accesible.')}
                </p>
                {expressionFeedback?.acoustic && (
                  <small>
                    Volumen {Math.round((expressionFeedback.acoustic.loudness ?? 0) * 100)}%
                    {' · '}{(expressionFeedback.acoustic.durationMs ?? 0) / 1000}s
                    {expressionFeedback.acoustic.sustainedNote ? ' · nota estable' : ''}
                    {expressionFeedback.acoustic.simpleHum ? ' · tarareo' : ''}
                  </small>
                )}
                {acousticError && <small className="is-error">{acousticError}</small>}
              </section>
            )}
            {interactionPresentation && dialoguePage && (
              <section
                className="map-concept-preview__dialogue"
                role="dialog"
                aria-label={`Conversación con ${dialoguePage.speakerName}`}
              >
                <strong>{dialoguePage.speakerName}</strong>
                <p aria-live="polite">{dialoguePage.text}</p>
                <button type="button" autoFocus onClick={() => {
                  if (dialoguePage.nextPageId) setDialoguePageId(dialoguePage.nextPageId);
                  else finishDialogue(true);
                }}>
                  {dialoguePage.nextPageId ? 'Siguiente' : 'Terminar'}
                </button>
              </section>
            )}
          </div>
          <div className="map-concept-preview__speaker map-concept-preview__speaker--right" aria-hidden="true" />
        </div>
        <div className="map-concept-preview__hinge" aria-hidden="true"><span /><span /></div>
        <div className="map-concept-preview__lower-shell">
          <div className="map-concept-preview__dpad" aria-hidden="true"><i /><i /></div>
          <form className="map-concept-preview__touchscreen" onSubmit={submitWrittenName}>
            {(!activeExpression || acceptsWrittenText) && (
              <label className="map-concept-preview__hidden-label" htmlFor="map-pokemon-name">
                {activeExpression ? 'Frase para la interacción' : 'Nombre del Pokémon visible'}
              </label>
            )}
            {(!activeExpression || acceptsWrittenText) && (
              <input
                id="map-pokemon-name"
                className="map-concept-preview__name-input"
                type="text"
                value={writtenName}
                placeholder={activeExpression ? 'Dile algo…' : 'Nombre…'}
                autoComplete="off"
                onChange={event => setWrittenName(event.target.value)}
                onKeyDown={event => event.stopPropagation()}
              />
            )}
            {(!activeExpression || acceptsSpokenText) && (
              <button
                className={`map-concept-preview__mic ${listening ? 'is-listening' : ''}`}
                type="button"
                aria-label={listening
                  ? activeExpression ? 'Detener respuesta por voz' : 'Detener identificación por voz'
                  : activeExpression ? 'Responder por voz' : 'Identificar Pokémon por voz'}
                aria-pressed={listening}
                title={speechSupported
                  ? activeExpression ? 'Responder a esta interacción por voz' : 'Identificar únicamente Pokémon visibles'
                  : 'Reconocimiento de voz no disponible'}
                disabled={!speechSupported}
                onClick={onMic}
              >
                <span aria-hidden="true">🎙</span>
              </button>
            )}
            {acceptsAcoustic && (
              <button
                className={`map-concept-preview__acoustic ${acousticStatus === 'listening' ? 'is-listening' : ''}`}
                type="button"
                disabled={acousticStatus === 'requesting' || acousticStatus === 'listening'}
                aria-label="Analizar sonido localmente"
                onClick={() => void captureAcoustic()}
                style={{ '--acoustic-progress': acousticProgress } as CSSProperties}
              >
                {acousticStatus === 'requesting' ? 'Permiso…'
                  : acousticStatus === 'listening' ? '¡Ahora!'
                    : 'Escuchar sonido'}
              </button>
            )}
            {activeExpression?.fallbackActionId && activeExpression.inputMethods.includes('contextAction') && (
              <button
                className="map-concept-preview__expression-fallback"
                type="button"
                onClick={onExpressionFallback}
              >
                {activeExpression.fallbackLabel ?? 'Usar gesto'}
              </button>
            )}
          </form>
          <div className="map-concept-preview__buttons" aria-hidden="true"><i /><i /><i /><i /></div>
        </div>
      </section>
    </div>
  );
}
