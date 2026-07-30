import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type {
  AdventureMediaManifestV1,
  NarrativeActionV1,
  NarrativeConversationChoiceV1,
  NarrativeConversationV1,
  NarrativeStageActionV1,
  PmdAnimationManifestV1,
} from '../../packages/contracts/src/index.js';
import {
  reconstructNarrativeStage,
  resolveNarrativeText,
} from '../domain/narrative/visualNovel.js';
import './VisualNovelPlayer.css';

const continuedNarrativeAudio = new Map<string, HTMLAudioElement>();

function fadeNarrativeAudio(
  audio: HTMLAudioElement,
  targetVolume: number,
  durationMs: number,
  onComplete?: () => void,
) {
  if (durationMs <= 0 || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
    audio.volume = targetVolume;
    onComplete?.();
    return;
  }
  const initialVolume = audio.volume;
  const startedAt = performance.now();
  const step = (now: number) => {
    const progress = Math.min(1, (now - startedAt) / durationMs);
    audio.volume = initialVolume + (targetVolume - initialVolume) * progress;
    if (progress < 1) window.requestAnimationFrame(step);
    else onComplete?.();
  };
  window.requestAnimationFrame(step);
}

export function stopContinuedNarrativeAudio() {
  for (const audio of continuedNarrativeAudio.values()) audio.pause();
  continuedNarrativeAudio.clear();
}

function publicAssetUrl(path: string) {
  return new URL(`../../${path.replace(/^\/+/u, '')}`, window.location.href).href;
}

function PmdStageActor({
  assetId,
  animationName,
  manifest,
}: {
  assetId: string;
  animationName?: string;
  manifest?: PmdAnimationManifestV1;
}) {
  const asset = manifest?.assets.find(candidate => candidate.assetId === assetId);
  const animation = asset?.animations.find(candidate => candidate.name === animationName)
    ?? asset?.animations.find(candidate => candidate.name === 'Idle')
    ?? asset?.animations[0];
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    setFrame(0);
    if (!animation || animation.frameCount < 2
      || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined;
    let timer = 0;
    let current = 0;
    const schedule = () => {
      timer = window.setTimeout(() => {
        current = (current + 1) % animation.frameCount;
        setFrame(current);
        schedule();
      }, Math.max(40, (animation.durationTicks[current] ?? 6) / 60 * 1000));
    };
    schedule();
    return () => window.clearTimeout(timer);
  }, [animation]);
  if (!animation) return <span className="visual-novel__missing-actor">?</span>;
  return <span
    className="visual-novel__pmd-frame"
    aria-hidden="true"
    style={{
      width: animation.frameWidth,
      height: animation.frameHeight,
      backgroundImage: `url("${publicAssetUrl(animation.animationSheetPath)}")`,
      backgroundPosition: `${-frame * animation.frameWidth}px 0`,
    }}
  />;
}

function stagePosition(slot: string) {
  return {
    farLeft: 8,
    left: 27,
    center: 50,
    right: 73,
    farRight: 92,
  }[slot] ?? 50;
}

export interface VisualNovelCheckpoint {
  conversationId: string;
  cueId: string;
  historyCueIds: string[];
  selectedChoices: Record<string, string>;
  variables: Record<string, string | number | boolean>;
  executedEffectIds: string[];
}

type VisualNovelLegacyAction =
  | NarrativeActionV1
  | { kind: 'saveTrainerNameAndAccept' };

export function VisualNovelPlayer({
  conversation,
  mediaManifest,
  pmdManifest,
  initialCueId,
  initialHistoryCueIds = [],
  initialSelectedChoices = {},
  initialVariables = {},
  initialExecutedEffectIds = [],
  tokenValues = {},
  initiallyReadCueIds = [],
  preview = false,
  onCheckpoint,
  onLegacyAction,
  onComplete,
}: {
  conversation: NarrativeConversationV1;
  mediaManifest: AdventureMediaManifestV1;
  pmdManifest?: PmdAnimationManifestV1;
  initialCueId?: string;
  initialHistoryCueIds?: string[];
  initialSelectedChoices?: Record<string, string>;
  initialVariables?: Record<string, string | number | boolean>;
  initialExecutedEffectIds?: string[];
  tokenValues?: Partial<Record<string, string | number | boolean>>;
  initiallyReadCueIds?: string[];
  preview?: boolean;
  onCheckpoint?: (checkpoint: VisualNovelCheckpoint) => void;
  onLegacyAction?: (action: VisualNovelLegacyAction, inputValue?: string) => void;
  onComplete?: (outcomeId: string) => void;
}) {
  const [cueId, setCueId] = useState(initialCueId ?? conversation.initialCueId);
  const [historyCueIds, setHistoryCueIds] = useState<string[]>(initialHistoryCueIds);
  const [selectedChoices, setSelectedChoices] = useState<Record<string, string>>(initialSelectedChoices);
  const [variables, setVariables] = useState<Record<string, string | number | boolean>>(initialVariables);
  const [executedEffectIds, setExecutedEffectIds] = useState(new Set(initialExecutedEffectIds));
  const [readCueIds, setReadCueIds] = useState(new Set(initiallyReadCueIds));
  const [visibleCharacters, setVisibleCharacters] = useState(0);
  const [auto, setAuto] = useState(false);
  const [skipRead, setSkipRead] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [blocking, setBlocking] = useState(false);
  const [leavingCue, setLeavingCue] = useState(false);
  const audioRef = useRef(new Map<string, HTMLAudioElement>());
  const cue = conversation.cues.find(candidate => candidate.cueId === cueId)
    ?? conversation.cues[0];
  const resolvedText = resolveNarrativeText(cue?.text ?? '', { ...tokenValues, ...variables });
  const stage = useMemo(() => reconstructNarrativeStage(
    conversation,
    cue?.cueId ?? conversation.initialCueId,
    selectedChoices,
  ), [conversation, cue?.cueId, selectedChoices]);
  const mediaById = useMemo(
    () => new Map(mediaManifest.assets.map(asset => [asset.assetId, asset])),
    [mediaManifest],
  );
  const background = stage.backgroundAssetId
    ? mediaById.get(stage.backgroundAssetId)
    : undefined;
  const backgroundAction = [...cue.actions].reverse()
    .find(action => action.kind === 'setBackground');
  const textComplete = visibleCharacters >= resolvedText.length;

  useEffect(() => {
    setCueId(initialCueId ?? conversation.initialCueId);
    setHistoryCueIds(initialHistoryCueIds);
    setSelectedChoices(initialSelectedChoices);
    setVariables(initialVariables);
    setExecutedEffectIds(new Set(initialExecutedEffectIds));
  }, [conversation.conversationId, conversation.initialCueId, initialCueId]);

  useLayoutEffect(() => {
    if (!cue) return undefined;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    setVisibleCharacters(reduced ? resolvedText.length : 0);
    setInputValue('');
    const blockingMs = cue.actions
      .filter(action => action.blocking && action.phase !== 'afterText')
      .reduce((maximum, action) => Math.max(
        maximum,
        (action.delayMs ?? 0) + (action.durationMs ?? 0),
      ), 0);
    if (blockingMs > 0 && !reduced) {
      setBlocking(true);
      const timer = window.setTimeout(() => setBlocking(false), blockingMs);
      return () => window.clearTimeout(timer);
    }
    setBlocking(false);
    return undefined;
  }, [cue, resolvedText.length]);

  useEffect(() => {
    if (!cue || visibleCharacters >= resolvedText.length) return undefined;
    const timer = window.setInterval(() => {
      setVisibleCharacters(current => Math.min(resolvedText.length, current + 2));
    }, 24);
    return () => window.clearInterval(timer);
  }, [cue, resolvedText.length, visibleCharacters]);

  useEffect(() => {
    if (!cue) return;
    onCheckpoint?.({
      conversationId: conversation.conversationId,
      cueId: cue.cueId,
      historyCueIds,
      selectedChoices,
      variables,
      executedEffectIds: [...executedEffectIds],
    });
  }, [conversation.conversationId, cue, executedEffectIds, historyCueIds, onCheckpoint, selectedChoices, variables]);

  useEffect(() => {
    if (!cue) return undefined;
    const actions = cue.actions.filter((action): action is Extract<
      NarrativeStageActionV1,
      { kind: 'playAudio' }
    > => (
      action.kind === 'playAudio'
      && (action.phase !== 'afterText' || leavingCue)
    ));
    if (cue.voiceAssetId) {
      actions.push({
        kind: 'playAudio',
        audioAssetId: cue.voiceAssetId,
        channel: 'voice',
        phase: 'withText',
      });
    }
    for (const action of actions) {
      if (action.actionId && action.persistent && executedEffectIds.has(action.actionId)) continue;
      const asset = mediaById.get(action.audioAssetId);
      if (!asset || asset.kind !== 'audio') continue;
      const current = audioRef.current.get(action.channel);
      current?.pause();
      continuedNarrativeAudio.get(action.channel)?.pause();
      continuedNarrativeAudio.delete(action.channel);
      const audio = new Audio(publicAssetUrl(asset.path));
      const targetVolume = Math.max(0, Math.min(1, action.volume ?? asset.defaultVolume ?? 1));
      audio.volume = action.fadeInMs ? 0 : targetVolume;
      audio.loop = action.loop ?? asset.defaultLoop ?? false;
      void audio.play().catch(() => {
        // Los navegadores pueden exigir un gesto; el texto continúa disponible.
      });
      if (action.fadeInMs) fadeNarrativeAudio(audio, targetVolume, action.fadeInMs);
      if (action.continueAfterConversation) {
        continuedNarrativeAudio.set(action.channel, audio);
      } else {
        audioRef.current.set(action.channel, audio);
      }
      if (action.actionId && action.persistent) {
        setExecutedEffectIds(currentIds => new Set(currentIds).add(action.actionId!));
      }
    }
    for (const action of cue.actions.filter((action): action is Extract<
      NarrativeStageActionV1,
      { kind: 'stopAudio' }
    > => (
      action.kind === 'stopAudio'
      && (action.phase !== 'afterText' || leavingCue)
    ))) {
      const channels = action.channel === 'all'
        ? [...new Set([
          ...audioRef.current.keys(),
          ...continuedNarrativeAudio.keys(),
        ])]
        : [action.channel];
      for (const channel of channels) {
        const local = audioRef.current.get(channel);
        const continued = continuedNarrativeAudio.get(channel);
        const stop = (audio: HTMLAudioElement | undefined) => {
          if (!audio) return;
          if (action.fadeOutMs) {
            fadeNarrativeAudio(audio, 0, action.fadeOutMs, () => audio.pause());
          } else audio.pause();
        };
        stop(local);
        stop(continued);
        audioRef.current.delete(channel);
        continuedNarrativeAudio.delete(channel);
      }
    }
    return undefined;
  }, [cue, leavingCue, mediaById]);

  useEffect(() => () => {
    for (const audio of audioRef.current.values()) audio.pause();
    audioRef.current.clear();
  }, []);

  const markRead = () => setReadCueIds(current => {
    const next = new Set(current);
    if (cue) next.add(cue.cueId);
    return next;
  });

  const goTo = (nextCueId: string) => {
    if (!cue) return;
    markRead();
    setHistoryCueIds(current => [...current, cue.cueId]);
    setCueId(nextCueId);
  };

  const finish = (outcomeId = 'completed') => {
    markRead();
    onComplete?.(outcomeId);
  };

  const runAfterTextActions = (callback: () => void) => {
    if (!cue || leavingCue) return;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const waitMs = reduced ? 0 : cue.actions
      .filter(action => action.phase === 'afterText' && action.blocking)
      .reduce((maximum, action) => Math.max(
        maximum,
        (action.delayMs ?? 0) + (action.durationMs ?? 0),
      ), 0);
    setLeavingCue(true);
    if (waitMs <= 0) {
      window.setTimeout(() => {
        setLeavingCue(false);
        callback();
      }, 0);
      return;
    }
    setBlocking(true);
    window.setTimeout(() => {
      setBlocking(false);
      setLeavingCue(false);
      callback();
    }, waitMs);
  };

  const advance = () => {
    if (!cue || blocking) return;
    if (!textComplete) {
      setVisibleCharacters(resolvedText.length);
      return;
    }
    if (cue.choices?.length || cue.textInput) return;
    runAfterTextActions(() => {
      if (cue.legacyAction) onLegacyAction?.(cue.legacyAction);
      if (cue.nextCueId) goTo(cue.nextCueId);
      else finish(cue.outcomeId);
    });
  };

  const choose = (choice: NarrativeConversationChoiceV1) => {
    if (!cue || blocking || !textComplete) return;
    runAfterTextActions(() => {
      if (choice.legacyAction) onLegacyAction?.(choice.legacyAction);
      setSelectedChoices(current => ({ ...current, [cue.cueId]: choice.choiceId }));
      if (choice.nextCueId) goTo(choice.nextCueId);
      else finish(choice.outcomeId);
    });
  };

  useEffect(() => {
    if (!cue || !textComplete || blocking || cue.choices?.length || cue.textInput) return undefined;
    const shouldAdvance = auto || (skipRead && readCueIds.has(cue.cueId));
    if (!shouldAdvance) return undefined;
    const voice = audioRef.current.get('voice');
    const delay = auto && voice && !voice.ended
      ? Math.max(600, Number.isFinite(voice.duration) ? voice.duration * 1000 : 900)
      : skipRead ? 80 : 900;
    const timer = window.setTimeout(advance, delay);
    return () => window.clearTimeout(timer);
  }, [auto, blocking, cue, readCueIds, skipRead, textComplete]);

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement | null)?.closest('input, button, textarea')) return;
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        advance();
      }
    };
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  });

  if (!cue) return <div className="visual-novel visual-novel--missing">Conversación sin diálogos.</div>;

  return <section
    className={`visual-novel${preview ? ' is-preview' : ''}`}
    aria-label={`Conversación: ${conversation.title}`}
    data-conversation-id={conversation.conversationId}
    data-cue-id={cue.cueId}
  >
    {background?.kind === 'narrativeBackground' ? <img
      className={`visual-novel__background${backgroundAction?.kind === 'setBackground' && backgroundAction.transition !== 'cut' ? ` transition-${backgroundAction.transition ?? 'fade'}` : ''}`}
      src={publicAssetUrl(background.path)}
      alt=""
      style={backgroundAction ? {
        animationDelay: `${backgroundAction.delayMs ?? 0}ms`,
        animationDuration: `${backgroundAction.durationMs ?? 250}ms`,
      } : undefined}
    /> : <div className="visual-novel__background visual-novel__background--missing" />}
    <div className="visual-novel__veil" aria-hidden="true" />
    <div className="visual-novel__stage" aria-hidden="true">
      {Object.values(stage.actors)
        .sort((left, right) => (left.transform.depth ?? 0) - (right.transform.depth ?? 0))
        .map(actor => {
          const poseId = actor.poseAssetId
            ?? (actor.source.kind === 'illustration' ? actor.source.assetId : undefined);
          const poseAsset = poseId ? mediaById.get(poseId) : undefined;
          const speaking = cue.speakerActorId === actor.actorId;
          const stageAction = [...cue.actions].reverse().find(action => (
            (action.kind === 'enterActor'
              || action.kind === 'exitActor'
              || action.kind === 'moveActor'
              || action.kind === 'setActorPose'
              || action.kind === 'setActorAnimation')
            && action.actorId === actor.actorId
            && (action.phase !== 'afterText' || leavingCue)
          ));
          const motion = stageAction && 'motion' in stageAction
            ? stageAction.motion
            : undefined;
          const easing = stageAction?.easing === 'easeIn'
            ? 'ease-in'
            : stageAction?.easing === 'easeOut'
              ? 'ease-out'
              : stageAction?.easing === 'linear' ? 'linear' : 'ease-in-out';
          return <div
            key={actor.actorId}
            className={`visual-novel__actor${speaking ? ' is-speaking' : ' is-listening'}${motion ? ` motion-${motion}` : ''}${stageAction?.kind === 'exitActor' && leavingCue ? ' is-exiting' : ''}`}
            style={{
              left: `${stagePosition(actor.transform.slot) + (actor.transform.offsetX ?? 0)}%`,
              bottom: `${8 + (actor.transform.offsetY ?? 0)}%`,
              zIndex: actor.transform.depth ?? 0,
              transform: `translateX(-50%) scale(${(actor.transform.scale ?? 1) * (actor.transform.mirror ? -1 : 1)}, ${actor.transform.scale ?? 1})`,
              animationDelay: `${stageAction?.delayMs ?? 0}ms`,
              animationDuration: `${stageAction?.durationMs ?? 250}ms`,
              animationTimingFunction: easing,
            }}
          >
            {actor.source.kind === 'pmd'
              ? <PmdStageActor
                  assetId={actor.source.assetId}
                  animationName={actor.source.animationName}
                  manifest={pmdManifest}
                />
              : poseAsset?.kind === 'narrativeCharacter'
                ? <img src={publicAssetUrl(poseAsset.path)} alt="" />
                : <span className="visual-novel__missing-actor">?</span>}
          </div>;
        })}
    </div>

    <div className="visual-novel__toolbar" aria-label="Controles de lectura">
      <button type="button" aria-pressed={historyOpen} onClick={() => setHistoryOpen(value => !value)}>Historial</button>
      <button type="button" aria-pressed={auto} onClick={() => setAuto(value => !value)}>Auto</button>
      <button type="button" aria-pressed={skipRead} onClick={() => setSkipRead(value => !value)}>Saltar leído</button>
    </div>

    {historyOpen ? <aside className="visual-novel__history" aria-label="Historial de conversación">
      <button type="button" onClick={() => setHistoryOpen(false)}>Cerrar</button>
      {[...historyCueIds, cue.cueId].map((id, index) => {
        const historic = conversation.cues.find(candidate => candidate.cueId === id);
        return historic ? <p key={`${id}:${index}`}><strong>{historic.speakerName ?? 'Narración'}</strong>{resolveNarrativeText(historic.text ?? '', { ...tokenValues, ...variables })}</p> : null;
      })}
    </aside> : null}

    <div className="visual-novel__dialogue" onClick={advance}>
      <strong>{cue.speakerName ?? (cue.kind === 'narration' ? 'Narración' : '')}</strong>
      <p aria-live="polite">{resolvedText.slice(0, visibleCharacters)}</p>
      {textComplete && cue.choices?.length ? <div className="visual-novel__choices">
        {cue.choices.map(choice => <button type="button" key={choice.choiceId} onClick={event => {
          event.stopPropagation();
          choose(choice);
        }}>{choice.label}</button>)}
      </div> : null}
      {textComplete && cue.textInput ? <form onClick={event => event.stopPropagation()} onSubmit={event => {
        event.preventDefault();
        if (!cue.textInput) return;
        const textInput = cue.textInput;
        runAfterTextActions(() => {
          if (textInput.legacyAction) {
            onLegacyAction?.({ kind: textInput.legacyAction }, inputValue);
          }
          setVariables(current => ({ ...current, [textInput.variableId]: inputValue }));
          if (textInput.nextCueId) goTo(textInput.nextCueId);
          else finish(textInput.outcomeId);
        });
      }}>
        <label>{cue.textInput.label}<input
          value={inputValue}
          maxLength={cue.textInput.maxLength}
          onChange={event => setInputValue(event.target.value)}
        /></label>
        <button type="submit">{cue.textInput.submitLabel}</button>
      </form> : null}
      {!cue.choices?.length && !cue.textInput ? <span aria-hidden="true">▼</span> : null}
    </div>
  </section>;
}
