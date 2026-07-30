import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  NarrativeConversationV1,
  NarrativeCueV1,
  NarrativeStageActionV1,
  NarrativeTokenReferenceV1,
} from '../../../packages/contracts/src/index.js';
import { VisualNovelPlayer } from '../../components/VisualNovelPlayer.js';
import {
  NARRATIVE_TOKEN_INSERTS,
  validateNarrativeConversation,
} from '../../domain/narrative/visualNovel.js';
import {
  findConversationDependencies,
  findVisualNovelWorkspaceConflicts,
  getVisualNovelDirtyFiles,
  loadVisualNovelWorkspace,
  saveVisualNovelWorkspace,
  serializeNarrativeConversation,
  type VisualNovelWorkspace,
} from '../../domain/tools/visualNovelWorkspace.js';
import {
  readPokeDiscoverRecentFolder,
  rememberPokeDiscoverRecentFolder,
} from '../../domain/tools/pokeDiscoverEditorRecentFolder.js';
import type { PokeDiscoverDirectoryHandle } from '../../domain/tools/pokeDiscoverEditorWorkspace.js';
import { nextStableEditorId } from '../../domain/tools/pokeDiscoverEditorBeats.js';
import { ToolNavigation } from '../shared/ToolNavigation.js';

interface History {
  past: NarrativeConversationV1[][];
  present: NarrativeConversationV1[];
  future: NarrativeConversationV1[][];
}

type DirectoryPicker = (options?: {
  id?: string;
  mode?: 'read' | 'readwrite';
}) => Promise<PokeDiscoverDirectoryHandle>;

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function newConversation(existing: NarrativeConversationV1[]) {
  const conversationId = nextStableEditorId(
    'narrative:conversation',
    existing.map(item => item.conversationId),
  );
  const cueId = `${conversationId}:cue:01`;
  return {
    schemaVersion: 1,
    conversationId,
    title: 'Nueva conversación',
    tags: [],
    initialCueId: cueId,
    once: false,
    cues: [{
      cueId,
      kind: 'dialogue',
      speakerName: 'Personaje',
      text: 'Escribe aquí el diálogo.',
      actions: [],
      outcomeId: 'completed',
    }],
  } satisfies NarrativeConversationV1;
}

function actionLabel(action: NarrativeStageActionV1) {
  const labels: Record<NarrativeStageActionV1['kind'], string> = {
    setBackground: 'Cambiar fondo',
    enterActor: 'Entrada de personaje',
    exitActor: 'Salida de personaje',
    setActorPose: 'Cambiar pose',
    setActorAnimation: 'Cambiar animación PMD',
    moveActor: 'Mover personaje',
    playAudio: 'Reproducir audio',
    stopAudio: 'Detener audio',
  };
  return labels[action.kind];
}

function downloadConversation(conversation: NarrativeConversationV1) {
  const blob = new Blob([serializeNarrativeConversation(conversation)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${conversation.conversationId.split(':').at(-1)}.conversation.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function VisualNovelEditor() {
  const [workspace, setWorkspace] = useState<VisualNovelWorkspace>();
  const [history, setHistory] = useState<History>({ past: [], present: [], future: [] });
  const [conversationId, setConversationId] = useState('');
  const [cueId, setCueId] = useState('');
  const [message, setMessage] = useState('Abre la raíz de pokemon voice para empezar.');
  const [busy, setBusy] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);
  const [conflicts, setConflicts] = useState<string[]>([]);
  const [pendingToolUrl, setPendingToolUrl] = useState<string>();
  const [customTokenKind, setCustomTokenKind] = useState<'inventoryItem' | 'missionCounter' | 'worldFlag'>('inventoryItem');
  const [customTokenId, setCustomTokenId] = useState('');
  const openedRecentRef = useRef(false);
  const conversations = history.present;
  const conversation = conversations.find(item => item.conversationId === conversationId)
    ?? conversations[0];
  const cue = conversation?.cues.find(item => item.cueId === cueId)
    ?? conversation?.cues[0];
  const cueIndex = conversation && cue
    ? conversation.cues.findIndex(item => item.cueId === cue.cueId)
    : -1;
  const dirtyFiles = useMemo(
    () => workspace ? getVisualNovelDirtyFiles(workspace, conversations) : [],
    [conversations, workspace],
  );
  const errors = useMemo(
    () => conversation ? validateNarrativeConversation(
      conversation,
      workspace?.mediaManifest,
      workspace?.pmdManifest,
    ) : [],
    [conversation, workspace?.mediaManifest, workspace?.pmdManifest],
  );
  const allErrors = useMemo(
    () => conversations.flatMap(document => validateNarrativeConversation(
      document,
      workspace?.mediaManifest,
      workspace?.pmdManifest,
    ).map(error => `${document.title}: ${error}`)),
    [conversations, workspace?.mediaManifest, workspace?.pmdManifest],
  );
  const backgrounds = workspace?.mediaManifest.assets
    .filter(asset => asset.kind === 'narrativeBackground') ?? [];
  const poses = workspace?.mediaManifest.assets
    .filter(asset => asset.kind === 'narrativeCharacter') ?? [];
  const audio = workspace?.mediaManifest.assets.filter(asset => asset.kind === 'audio') ?? [];
  const pmdAssets = workspace?.pmdManifest.assets ?? [];
  const dependencies = conversation && workspace
    ? findConversationDependencies(workspace, conversation.conversationId)
    : [];

  const commit = (
    update: (current: NarrativeConversationV1[]) => NarrativeConversationV1[],
    description: string,
  ) => {
    setHistory(current => ({
      past: [...current.past, current.present],
      present: update(clone(current.present)),
      future: [],
    }));
    setMessage(description);
  };

  const replaceConversation = (next: NarrativeConversationV1, description: string) => {
    commit(current => current.map(item => (
      item.conversationId === next.conversationId ? next : item
    )), description);
  };

  const replaceCue = (next: NarrativeCueV1, description = 'Diálogo actualizado.') => {
    if (!conversation) return;
    replaceConversation({
      ...conversation,
      cues: conversation.cues.map(item => item.cueId === next.cueId ? next : item),
    }, description);
  };

  const openRoot = async (root: PokeDiscoverDirectoryHandle, remember = true) => {
    setBusy(true);
    try {
      if (await root.queryPermission?.({ mode: 'readwrite' }) !== 'granted') {
        const permission = await root.requestPermission?.({ mode: 'readwrite' });
        if (permission === 'denied') throw new Error('No se concedió permiso de escritura.');
      }
      const loaded = await loadVisualNovelWorkspace(root);
      setWorkspace(loaded);
      setHistory({ past: [], present: clone(loaded.conversations), future: [] });
      setConversationId(loaded.conversations[0]?.conversationId ?? '');
      setCueId(loaded.conversations[0]?.initialCueId ?? '');
      setConflicts([]);
      setMessage(`${loaded.conversations.length} conversaciones cargadas.`);
      if (remember) {
        await rememberPokeDiscoverRecentFolder({
          directoryHandle: root,
          files: [],
          projectName: root.name,
        });
      }
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'No se pudo abrir el proyecto.');
    } finally {
      setBusy(false);
    }
  };

  const chooseRoot = async () => {
    const picker = (window as typeof window & { showDirectoryPicker?: DirectoryPicker })
      .showDirectoryPicker;
    if (!picker) {
      setMessage('Este navegador no ofrece acceso directo a carpetas. Usa Chrome o Edge de escritorio.');
      return;
    }
    try {
      await openRoot(await picker({ id: 'pokediscover-project-root', mode: 'readwrite' }));
    } catch (cause) {
      if ((cause as DOMException)?.name !== 'AbortError') {
        setMessage(cause instanceof Error ? cause.message : 'No se pudo abrir la carpeta.');
      }
    }
  };

  useEffect(() => {
    if (openedRecentRef.current) return;
    openedRecentRef.current = true;
    void readPokeDiscoverRecentFolder().then(async recent => {
      if (!recent?.directoryHandle) return;
      if (await recent.directoryHandle.queryPermission?.({ mode: 'readwrite' }) === 'granted') {
        await openRoot(recent.directoryHandle, false);
      }
    });
  }, []);

  useEffect(() => {
    if (!workspace) return undefined;
    const check = () => void findVisualNovelWorkspaceConflicts(workspace).then(setConflicts);
    window.addEventListener('focus', check);
    return () => window.removeEventListener('focus', check);
  }, [workspace]);

  useEffect(() => {
    const unload = (event: BeforeUnloadEvent) => {
      if (!dirtyFiles.length) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', unload);
    return () => window.removeEventListener('beforeunload', unload);
  }, [dirtyFiles.length]);

  const save = async () => {
    if (!workspace || allErrors.length) {
      if (allErrors.length) setMessage('Corrige los errores de la biblioteca antes de guardar.');
      return false;
    }
    setBusy(true);
    try {
      const external = await findVisualNovelWorkspaceConflicts(workspace);
      if (external.length) {
        setConflicts(external);
        setMessage('Hay archivos modificados fuera del editor.');
        return false;
      }
      const saved = await saveVisualNovelWorkspace(workspace, conversations);
      setWorkspace(saved);
      setHistory(current => ({ ...current, past: [], future: [] }));
      setMessage('Conversaciones y manifiesto guardados.');
      return true;
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'No se pudo guardar.');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const createConversation = () => {
    const next = newConversation(conversations);
    commit(current => [...current, next], 'Conversación creada.');
    setConversationId(next.conversationId);
    setCueId(next.initialCueId);
  };

  const duplicateConversation = () => {
    if (!conversation) return;
    const next = newConversation(conversations);
    const cueMap = new Map(conversation.cues.map((item, index) => [
      item.cueId,
      `${next.conversationId}:cue:${String(index + 1).padStart(2, '0')}`,
    ]));
    const duplicated: NarrativeConversationV1 = {
      ...clone(conversation),
      conversationId: next.conversationId,
      title: `${conversation.title} (copia)`,
      initialCueId: cueMap.get(conversation.initialCueId) ?? next.initialCueId,
      cues: conversation.cues.map(item => ({
        ...clone(item),
        cueId: cueMap.get(item.cueId)!,
        actions: item.actions.map((action, actionIndex) => ({
          ...clone(action),
          actionId: `${cueMap.get(item.cueId)!}:action:${String(actionIndex + 1).padStart(2, '0')}`,
        })),
        nextCueId: item.nextCueId ? cueMap.get(item.nextCueId) : undefined,
        choices: item.choices?.map((choice, choiceIndex) => ({
          ...choice,
          choiceId: `${cueMap.get(item.cueId)!}:choice:${String(choiceIndex + 1).padStart(2, '0')}`,
          nextCueId: choice.nextCueId ? cueMap.get(choice.nextCueId) : undefined,
        })),
        textInput: item.textInput ? {
          ...item.textInput,
          inputId: `${cueMap.get(item.cueId)!}:input`,
          nextCueId: item.textInput.nextCueId
            ? cueMap.get(item.textInput.nextCueId)
            : undefined,
        } : undefined,
      })),
    };
    commit(current => [...current, duplicated], 'Conversación duplicada.');
    setConversationId(duplicated.conversationId);
    setCueId(duplicated.initialCueId);
  };

  const removeConversation = () => {
    if (!conversation || dependencies.length) return;
    commit(current => current.filter(item => item.conversationId !== conversation.conversationId), 'Conversación eliminada.');
    const next = conversations.find(item => item.conversationId !== conversation.conversationId);
    setConversationId(next?.conversationId ?? '');
    setCueId(next?.initialCueId ?? '');
  };

  const addCue = () => {
    if (!conversation) return;
    const nextCueId = nextStableEditorId(
      `${conversation.conversationId}:cue`,
      conversation.cues.map(item => item.cueId),
    );
    const next: NarrativeCueV1 = {
      cueId: nextCueId,
      kind: 'dialogue',
      speakerActorId: cue?.speakerActorId,
      speakerName: cue?.speakerName ?? 'Personaje',
      text: 'Nuevo diálogo.',
      actions: [],
      outcomeId: 'completed',
    };
    const cues = conversation.cues.map(item => (
      item.cueId === cue?.cueId && !item.nextCueId && !item.choices?.length && !item.textInput
        ? { ...item, nextCueId, outcomeId: undefined }
        : item
    ));
    replaceConversation({ ...conversation, cues: [...cues, next] }, 'Diálogo añadido.');
    setCueId(nextCueId);
  };

  const moveCue = (direction: -1 | 1) => {
    if (!conversation || cueIndex < 0) return;
    const target = cueIndex + direction;
    if (target < 0 || target >= conversation.cues.length) return;
    const cues = [...conversation.cues];
    [cues[cueIndex], cues[target]] = [cues[target], cues[cueIndex]];
    replaceConversation({ ...conversation, cues }, 'Diálogo reordenado.');
  };

  const duplicateCue = () => {
    if (!conversation || !cue) return;
    const duplicatedCueId = nextStableEditorId(
      `${conversation.conversationId}:cue`,
      conversation.cues.map(item => item.cueId),
    );
    const duplicated = {
      ...clone(cue),
      cueId: duplicatedCueId,
      actions: cue.actions.map((action, actionIndex) => ({
        ...clone(action),
        actionId: `${duplicatedCueId}:action:${String(actionIndex + 1).padStart(2, '0')}`,
      })),
      choices: cue.choices?.map((choice, choiceIndex) => ({
        ...clone(choice),
        choiceId: `${duplicatedCueId}:choice:${String(choiceIndex + 1).padStart(2, '0')}`,
      })),
      textInput: cue.textInput ? {
        ...clone(cue.textInput),
        inputId: `${duplicatedCueId}:input`,
      } : undefined,
    };
    const cues = [...conversation.cues];
    if (!cue.choices?.length && !cue.textInput) {
      const previousNextCueId = cue.nextCueId;
      cues[cueIndex] = { ...cue, nextCueId: duplicatedCueId, outcomeId: undefined };
      duplicated.nextCueId = previousNextCueId;
    }
    cues.splice(cueIndex + 1, 0, duplicated);
    replaceConversation({ ...conversation, cues }, 'Diálogo duplicado.');
    setCueId(duplicatedCueId);
  };

  const cueHasIncomingReference = Boolean(conversation && cue && (
    conversation.initialCueId === cue.cueId
    || conversation.cues.some(item => (
      item.cueId !== cue.cueId
      && (
        item.nextCueId === cue.cueId
        || item.choices?.some(choice => choice.nextCueId === cue.cueId)
        || item.textInput?.nextCueId === cue.cueId
      )
    ))
  ));

  const removeCue = () => {
    if (!conversation || !cue || conversation.cues.length <= 1 || cueHasIncomingReference) return;
    const cues = conversation.cues.filter(item => item.cueId !== cue.cueId);
    replaceConversation({ ...conversation, cues }, 'Diálogo eliminado.');
    setCueId(cues[Math.max(0, cueIndex - 1)]?.cueId ?? conversation.initialCueId);
  };

  const toggleTextInput = () => {
    if (!cue) return;
    if (cue.textInput) {
      replaceCue({ ...cue, textInput: undefined }, 'Entrada de texto eliminada.');
      return;
    }
    replaceCue({
      ...cue,
      nextCueId: undefined,
      choices: undefined,
      outcomeId: undefined,
      textInput: {
        inputId: `${cue.cueId}:input`,
        label: 'Tu respuesta',
        variableId: 'conversation.answer',
        maxLength: 24,
        submitLabel: 'Continuar',
        outcomeId: 'completed',
      },
    }, 'Entrada de texto añadida.');
  };

  const addChoice = () => {
    if (!conversation || !cue) return;
    const choiceId = nextStableEditorId(
      `${cue.cueId}:choice`,
      cue.choices?.map(item => item.choiceId) ?? [],
    );
    replaceCue({
      ...cue,
      nextCueId: undefined,
      outcomeId: undefined,
      choices: [...(cue.choices ?? []), {
        choiceId,
        label: 'Nueva elección',
        outcomeId: 'completed',
      }],
    }, 'Elección añadida.');
  };

  const insertToken = (reference: NarrativeTokenReferenceV1, value: string) => {
    if (!cue) return;
    replaceCue({
      ...cue,
      text: `${cue.text ?? ''}${cue.text?.endsWith(' ') || !cue.text ? '' : ' '}${value}`,
      tokenReferences: [...(cue.tokenReferences ?? []), reference],
    }, 'Variable insertada.');
  };

  const addAction = (kind: NarrativeStageActionV1['kind']) => {
    if (!cue) return;
    const firstPose = poses[0];
    const actorId = cue.speakerActorId
      ?? (firstPose?.kind === 'narrativeCharacter' ? firstPose.characterId : 'actor:character');
    const base = {
      actionId: nextStableEditorId(
        `${cue.cueId}:action`,
        cue.actions.flatMap(action => action.actionId ? [action.actionId] : []),
      ),
      phase: 'withText' as const,
      durationMs: 250,
    };
    let action: NarrativeStageActionV1;
    if (kind === 'setBackground') action = { ...base, kind, backgroundAssetId: backgrounds[0]?.assetId, transition: 'fade' };
    else if (kind === 'enterActor') action = {
      ...base,
      kind,
      actorId,
      source: { kind: 'illustration', assetId: firstPose?.assetId ?? 'narrative:character:missing' },
      poseAssetId: firstPose?.assetId,
      transform: { slot: 'right' },
      motion: 'fade',
    };
    else if (kind === 'exitActor') action = { ...base, kind, actorId, motion: 'fade', phase: 'afterText' };
    else if (kind === 'setActorPose') action = { ...base, kind, actorId, poseAssetId: firstPose?.assetId ?? 'narrative:character:missing' };
    else if (kind === 'setActorAnimation') action = { ...base, kind, actorId, animationName: pmdAssets[0]?.animations[0]?.name ?? 'Idle' };
    else if (kind === 'moveActor') action = { ...base, kind, actorId, transform: { slot: 'center' }, motion: 'slide' };
    else if (kind === 'playAudio') action = { ...base, kind, audioAssetId: audio[0]?.assetId ?? 'audio:missing', channel: audio[0]?.kind === 'audio' ? audio[0].audioKind : 'effect' };
    else action = { ...base, kind, channel: 'all' };
    replaceCue({ ...cue, actions: [...cue.actions, action] }, 'Acción añadida.');
  };

  const updateAction = (
    index: number,
    update: (action: NarrativeStageActionV1) => NarrativeStageActionV1,
  ) => {
    if (!cue) return;
    replaceCue({
      ...cue,
      actions: cue.actions.map((action, itemIndex) => (
        itemIndex === index ? update(action) : action
      )),
    }, 'Acción actualizada.');
  };

  const actors = useMemo(() => {
    if (!conversation) return [];
    return conversation.cues.flatMap((item, index) => item.actions
      .filter(action => action.kind === 'enterActor')
      .map(action => {
        const exitIndex = conversation.cues.findIndex((candidate, candidateIndex) => (
          candidateIndex >= index && candidate.actions.some(entry => (
            entry.kind === 'exitActor' && entry.actorId === action.actorId
          ))
        ));
        return { action, start: index, end: exitIndex >= 0 ? exitIndex : conversation.cues.length - 1 };
      }));
  }, [conversation]);
  const cueBranchDepths = useMemo(() => {
    if (!conversation) return new Map<string, number>();
    const depths = new Map<string, number>([[conversation.initialCueId, 0]]);
    const queue = [conversation.initialCueId];
    while (queue.length) {
      const currentId = queue.shift()!;
      const current = conversation.cues.find(item => item.cueId === currentId);
      if (!current) continue;
      const depth = depths.get(currentId) ?? 0;
      const targets = [
        ...(current.nextCueId ? [{ cueId: current.nextCueId, depth }] : []),
        ...(current.textInput?.nextCueId ? [{ cueId: current.textInput.nextCueId, depth }] : []),
        ...(current.choices ?? []).flatMap(choice => (
          choice.nextCueId ? [{ cueId: choice.nextCueId, depth: depth + 1 }] : []
        )),
      ];
      for (const target of targets) {
        const previous = depths.get(target.cueId);
        if (previous !== undefined && previous <= target.depth) continue;
        depths.set(target.cueId, target.depth);
        queue.push(target.cueId);
      }
    }
    return depths;
  }, [conversation]);

  const updatePresence = (actorId: string, start: number, end: number) => {
    if (!conversation) return;
    let enter: Extract<NarrativeStageActionV1, { kind: 'enterActor' }> | undefined;
    const cues = conversation.cues.map(item => ({
      ...item,
      actions: item.actions.filter(action => {
        if (action.kind === 'enterActor' && action.actorId === actorId) {
          enter ??= action;
          return false;
        }
        return !(action.kind === 'exitActor' && action.actorId === actorId);
      }),
    }));
    if (!enter) return;
    cues[start] = { ...cues[start], actions: [enter, ...cues[start].actions] };
    const exit: NarrativeStageActionV1 = {
      kind: 'exitActor',
      actorId,
      motion: 'fade',
      phase: 'afterText',
      durationMs: 200,
    };
    cues[Math.max(start, end)] = {
      ...cues[Math.max(start, end)],
      actions: [...cues[Math.max(start, end)].actions, exit],
    };
    replaceConversation({ ...conversation, cues }, 'Presencia del personaje actualizada.');
  };

  return <main className="vn-editor">
    <header className="vn-editor__appbar">
      <div><span>PD</span><strong>Novela visual</strong></div>
      <nav aria-label="Archivo y edición">
        <button type="button" disabled={busy} onClick={() => void chooseRoot()}>Abrir raíz…</button>
        <button type="button" disabled={!workspace || busy || !dirtyFiles.length || Boolean(allErrors.length)} onClick={() => void save()}>Guardar</button>
        <button type="button" disabled={!history.past.length} onClick={() => setHistory(current => {
          const previous = current.past.at(-1);
          return previous ? {
            past: current.past.slice(0, -1),
            present: previous,
            future: [current.present, ...current.future],
          } : current;
        })}>Deshacer</button>
        <button type="button" disabled={!history.future.length} onClick={() => setHistory(current => {
          const next = current.future[0];
          return next ? {
            past: [...current.past, current.present],
            present: next,
            future: current.future.slice(1),
          } : current;
        })}>Rehacer</button>
        <button type="button" disabled={!conversation} onClick={() => conversation && downloadConversation(conversation)}>Exportar</button>
      </nav>
      <div className="vn-editor__document">
        <span className={dirtyFiles.length ? 'is-dirty' : ''} />
        <strong>{conversation?.title ?? 'Sin proyecto'}</strong>
      </div>
    </header>

    <div className="vn-editor__workspace">
      <aside className="vn-library">
        <header><div><strong>Conversaciones</strong><span>{conversations.length}</span></div><button type="button" disabled={!workspace} onClick={createConversation}>+</button></header>
        <div className="vn-library__list">
          {conversations.map(item => <button
            type="button"
            key={item.conversationId}
            aria-pressed={item.conversationId === conversation?.conversationId}
            onClick={() => {
              setConversationId(item.conversationId);
              setCueId(item.initialCueId);
            }}
          ><strong>{item.title}</strong><small>{item.cues.length} diálogos · {item.tags.join(', ') || 'sin etiquetas'}</small></button>)}
        </div>
        {conversation ? <footer>
          <button type="button" onClick={duplicateConversation}>Duplicar</button>
          <button type="button" disabled={Boolean(dependencies.length)} onClick={removeConversation}>Eliminar</button>
          {dependencies.length ? <small>Usada por {dependencies.map(item => item.title).join(', ')}</small> : null}
        </footer> : null}
      </aside>

      <section className="vn-stage-column">
        {workspace && conversation ? <VisualNovelPlayer
          key={`${conversation.conversationId}:${previewKey}`}
          conversation={conversation}
          mediaManifest={workspace.mediaManifest}
          pmdManifest={workspace.pmdManifest}
          initialCueId={cue?.cueId}
          preview
          tokenValues={{
            'player.name': 'Achaman',
            'player.avatar': 'Achaman',
            'companion.name': 'Lapras',
          }}
          onComplete={outcome => setMessage(`Preview finalizada: ${outcome}.`)}
        /> : <div className="vn-editor__empty">
          <strong>Editor de novela visual</strong>
          <p>Abre la raíz del proyecto para cargar conversaciones, fondos y personajes.</p>
          <button type="button" onClick={() => void chooseRoot()}>Abrir pokemon voice</button>
        </div>}
        {conversation ? <div className="vn-presence">
          <header><strong>Presencia en escena</strong><button type="button" onClick={() => addAction('enterActor')}>Añadir personaje</button></header>
          {actors.length ? actors.map(({ action, start, end }) => <div key={action.actorId}>
            <span>{action.actorId}</span>
            <label>Desde<select value={start} onChange={event => updatePresence(action.actorId, Number(event.target.value), Math.max(Number(event.target.value), end))}>
              {conversation.cues.map((item, index) => <option key={item.cueId} value={index}>{index + 1}</option>)}
            </select></label>
            <div className="vn-presence__bar"><span style={{
              marginLeft: `${start / conversation.cues.length * 100}%`,
              width: `${(end - start + 1) / conversation.cues.length * 100}%`,
            }} /></div>
            <label>Hasta<select value={end} onChange={event => updatePresence(action.actorId, start, Number(event.target.value))}>
              {conversation.cues.map((item, index) => <option key={item.cueId} value={index} disabled={index < start}>{index + 1}</option>)}
            </select></label>
          </div>) : <p>Añade un personaje para crear su barra de presencia.</p>}
        </div> : null}
        {conversation ? <div className="vn-timeline">
          <header><strong>Timeline de diálogos</strong><button type="button" onClick={addCue}>Añadir diálogo</button></header>
          <div>{conversation.cues.map((item, index) => <button
            type="button"
            key={item.cueId}
            aria-pressed={item.cueId === cue?.cueId}
            data-branch-depth={cueBranchDepths.get(item.cueId) ?? 0}
            style={{ marginTop: `${Math.min(4, cueBranchDepths.get(item.cueId) ?? 0) * 14}px` }}
            onClick={() => {
              setCueId(item.cueId);
              setPreviewKey(value => value + 1);
            }}
          ><span>{index + 1}</span><strong>{item.speakerName ?? 'Acción'}</strong><small>{item.text?.slice(0, 54) || (item.actions[0] ? actionLabel(item.actions[0]) : 'Sin texto')}</small>{item.choices?.length ? <em>{item.choices.length} ramas</em> : null}</button>)}</div>
        </div> : null}
      </section>

      <aside className="vn-inspector">
        {conversation && cue ? <>
          <section>
            <h2>Conversación</h2>
            <label>Título<input value={conversation.title} onChange={event => replaceConversation({ ...conversation, title: event.target.value }, 'Título actualizado.')} /></label>
            <label>Etiquetas<input value={conversation.tags.join(', ')} onChange={event => replaceConversation({
              ...conversation,
              tags: [...new Set(event.target.value.split(',').map(value => value.trim().toLocaleLowerCase()).filter(Boolean))],
            }, 'Etiquetas actualizadas.')} /></label>
            <label><span><input type="checkbox" checked={conversation.once} onChange={event => replaceConversation({ ...conversation, once: event.target.checked }, 'Repetición actualizada.')} /> Solo una vez</span></label>
          </section>
          <section>
            <header><h2>Diálogo {cueIndex + 1}</h2><div>
              <button type="button" disabled={cueIndex <= 0} onClick={() => moveCue(-1)} aria-label="Mover diálogo hacia arriba">↑</button>
              <button type="button" disabled={cueIndex >= conversation.cues.length - 1} onClick={() => moveCue(1)} aria-label="Mover diálogo hacia abajo">↓</button>
              <button type="button" onClick={duplicateCue}>Duplicar</button>
              <button type="button" disabled={conversation.cues.length <= 1 || cueHasIncomingReference} onClick={removeCue}>Eliminar</button>
            </div></header>
            <label>Tipo<select value={cue.kind} onChange={event => replaceCue({ ...cue, kind: event.target.value as NarrativeCueV1['kind'] })}><option value="dialogue">Diálogo</option><option value="narration">Narración</option><option value="action">Solo acciones</option></select></label>
            <label>Hablante<input value={cue.speakerName ?? ''} onChange={event => replaceCue({ ...cue, speakerName: event.target.value || undefined })} /></label>
            <label>Actor en escena<input value={cue.speakerActorId ?? ''} onChange={event => replaceCue({ ...cue, speakerActorId: event.target.value || undefined })} /></label>
            <label>Texto<textarea value={cue.text ?? ''} onChange={event => replaceCue({ ...cue, text: event.target.value })} /></label>
            <div className="vn-token-row">{NARRATIVE_TOKEN_INSERTS.map(token => <button type="button" key={token.value} onClick={() => insertToken(token.reference, token.value)}>{token.label}</button>)}</div>
            <div className="vn-custom-token">
              <select aria-label="Tipo de variable" value={customTokenKind} onChange={event => setCustomTokenKind(event.target.value as typeof customTokenKind)}><option value="inventoryItem">Objeto</option><option value="missionCounter">Contador</option><option value="worldFlag">Flag pública</option></select>
              <input aria-label="ID de variable" placeholder="ID editorial" value={customTokenId} onChange={event => setCustomTokenId(event.target.value)} />
              <button type="button" disabled={!customTokenId.trim()} onClick={() => {
                const id = customTokenId.trim();
                if (!id) return;
                const reference: NarrativeTokenReferenceV1 = customTokenKind === 'inventoryItem'
                  ? { kind: 'inventoryItem', itemId: id }
                  : customTokenKind === 'missionCounter'
                    ? { kind: 'missionCounter', counterId: id }
                    : { kind: 'worldFlag', flagId: id };
                const prefix = customTokenKind === 'inventoryItem'
                  ? 'item'
                  : customTokenKind === 'missionCounter' ? 'counter' : 'flag';
                insertToken(reference, `{{${prefix}:${id}}}`);
                setCustomTokenId('');
              }}>Insertar</button>
            </div>
            <label>Voz<select value={cue.voiceAssetId ?? ''} onChange={event => replaceCue({ ...cue, voiceAssetId: event.target.value || undefined })}><option value="">Sin voz</option>{audio.filter(item => item.kind === 'audio' && item.audioKind === 'voice').map(item => <option key={item.assetId}>{item.assetId}</option>)}</select></label>
            <label>Siguiente<select value={cue.nextCueId ?? ''} disabled={Boolean(cue.choices?.length || cue.textInput)} onChange={event => replaceCue({ ...cue, nextCueId: event.target.value || undefined, outcomeId: event.target.value ? undefined : cue.outcomeId ?? 'completed' })}><option value="">Terminar</option>{conversation.cues.filter(item => item.cueId !== cue.cueId).map(item => <option key={item.cueId}>{item.cueId}</option>)}</select></label>
            {!cue.nextCueId && !cue.choices?.length && !cue.textInput ? <label>Resultado<input value={cue.outcomeId ?? 'completed'} onChange={event => replaceCue({ ...cue, outcomeId: event.target.value || undefined })} /></label> : null}
          </section>
          <section>
            <header><h2>Entrada de texto</h2><button type="button" onClick={toggleTextInput}>{cue.textInput ? 'Quitar' : 'Añadir'}</button></header>
            {cue.textInput ? <>
              <label>Etiqueta<input value={cue.textInput.label} onChange={event => replaceCue({ ...cue, textInput: { ...cue.textInput!, label: event.target.value } })} /></label>
              <label>Variable pública<input value={cue.textInput.variableId} onChange={event => replaceCue({ ...cue, textInput: { ...cue.textInput!, variableId: event.target.value } })} /></label>
              <label>Longitud máxima<input type="number" min="1" max="120" value={cue.textInput.maxLength} onChange={event => replaceCue({ ...cue, textInput: { ...cue.textInput!, maxLength: Math.max(1, Math.min(120, Number(event.target.value) || 1)) } })} /></label>
              <label>Texto del botón<input value={cue.textInput.submitLabel} onChange={event => replaceCue({ ...cue, textInput: { ...cue.textInput!, submitLabel: event.target.value } })} /></label>
              <label>Destino<select value={cue.textInput.nextCueId ?? ''} onChange={event => replaceCue({
                ...cue,
                textInput: {
                  ...cue.textInput!,
                  nextCueId: event.target.value || undefined,
                  outcomeId: event.target.value ? undefined : cue.textInput!.outcomeId ?? 'completed',
                },
              })}><option value="">Resultado</option>{conversation.cues.filter(item => item.cueId !== cue.cueId).map(item => <option key={item.cueId}>{item.cueId}</option>)}</select></label>
              {!cue.textInput.nextCueId ? <label>Resultado<input value={cue.textInput.outcomeId ?? 'completed'} onChange={event => replaceCue({ ...cue, textInput: { ...cue.textInput!, outcomeId: event.target.value || undefined } })} /></label> : null}
            </> : <p>Úsala para nombres o respuestas que deban quedar disponibles como variable.</p>}
          </section>
          <section>
            <header><h2>Elecciones</h2><button type="button" onClick={addChoice}>+</button></header>
            {cue.choices?.map(choice => <div className="vn-choice" key={choice.choiceId}>
              <input aria-label="Texto de la elección" value={choice.label} onChange={event => replaceCue({
                ...cue,
                choices: cue.choices?.map(item => item.choiceId === choice.choiceId ? { ...item, label: event.target.value } : item),
              })} />
              <select aria-label="Destino de la elección" value={choice.nextCueId ?? ''} onChange={event => replaceCue({
                ...cue,
                choices: cue.choices?.map(item => item.choiceId === choice.choiceId ? {
                  ...item,
                  nextCueId: event.target.value || undefined,
                  outcomeId: event.target.value ? undefined : item.outcomeId ?? 'completed',
                } : item),
              })}><option value="">Resultado</option>{conversation.cues.filter(item => item.cueId !== cue.cueId).map(item => <option key={item.cueId}>{item.cueId}</option>)}</select>
              {!choice.nextCueId ? <input aria-label="Resultado de la elección" value={choice.outcomeId ?? ''} onChange={event => replaceCue({
                ...cue,
                choices: cue.choices?.map(item => item.choiceId === choice.choiceId ? { ...item, outcomeId: event.target.value } : item),
              })} /> : null}
              <button type="button" onClick={() => replaceCue({ ...cue, choices: cue.choices?.filter(item => item.choiceId !== choice.choiceId) })}>×</button>
            </div>)}
          </section>
          <section>
            <header><h2>Acciones</h2><select aria-label="Añadir acción" value="" onChange={event => {
              if (event.target.value) addAction(event.target.value as NarrativeStageActionV1['kind']);
            }}><option value="">Añadir…</option><option value="setBackground">Fondo</option><option value="enterActor">Entrada</option><option value="exitActor">Salida</option><option value="setActorPose">Pose</option><option value="setActorAnimation">Animación PMD</option><option value="moveActor">Movimiento</option><option value="playAudio">Audio</option><option value="stopAudio">Detener audio</option></select></header>
            {cue.actions.map((action, index) => <div className="vn-action" key={`${action.kind}:${index}`}>
              <header><strong>{actionLabel(action)}</strong><button type="button" onClick={() => replaceCue({ ...cue, actions: cue.actions.filter((_, itemIndex) => itemIndex !== index) })}>×</button></header>
              <div className="vn-action__timing">
                <label>Momento<select value={action.phase} onChange={event => updateAction(index, item => ({ ...item, phase: event.target.value as NarrativeStageActionV1['phase'] }))}><option value="beforeText">Antes</option><option value="withText">Mientras habla</option><option value="afterText">Después</option></select></label>
                <label>Retardo<input type="number" min="0" value={action.delayMs ?? 0} onChange={event => updateAction(index, item => ({ ...item, delayMs: Math.max(0, Number(event.target.value) || 0) }))} /></label>
                <label>Duración<input type="number" min="0" value={action.durationMs ?? 0} onChange={event => updateAction(index, item => ({ ...item, durationMs: Math.max(0, Number(event.target.value) || 0) }))} /></label>
                <label>Easing<select value={action.easing ?? 'easeInOut'} onChange={event => updateAction(index, item => ({ ...item, easing: event.target.value as NonNullable<NarrativeStageActionV1['easing']> }))}><option value="linear">Lineal</option><option value="easeIn">Acelerar</option><option value="easeOut">Frenar</option><option value="easeInOut">Suave</option></select></label>
              </div>
              <label><span><input type="checkbox" checked={action.blocking ?? false} onChange={event => updateAction(index, item => ({ ...item, blocking: event.target.checked || undefined }))} /> Bloqueante</span></label>
              <label><span><input type="checkbox" checked={action.persistent ?? false} onChange={event => updateAction(index, item => ({ ...item, persistent: event.target.checked || undefined }))} /> Persistente e idempotente</span></label>
              <details><summary>ID técnico</summary><code>{action.actionId ?? 'Se asignará al recrear la acción'}</code></details>
              {action.kind === 'setBackground' ? <>
                <label>Fondo<select value={action.backgroundAssetId ?? ''} onChange={event => updateAction(index, item => item.kind === 'setBackground' ? { ...item, backgroundAssetId: event.target.value || undefined } : item)}><option value="">Sin fondo</option>{backgrounds.map(item => <option key={item.assetId} value={item.assetId}>{item.kind === 'narrativeBackground' ? item.label : item.assetId}</option>)}</select></label>
                <label>Transición<select value={action.transition ?? 'cut'} onChange={event => updateAction(index, item => item.kind === 'setBackground' ? { ...item, transition: event.target.value as NonNullable<typeof item.transition> } : item)}><option value="cut">Corte</option><option value="fade">Fundido</option><option value="dissolve">Disolución</option></select></label>
              </> : null}
              {action.kind === 'enterActor' ? <>
                <label>ID del actor<input value={action.actorId} onChange={event => updateAction(index, item => item.kind === 'enterActor' ? { ...item, actorId: event.target.value } : item)} /></label>
                <label>Recurso<select value={action.source.kind} onChange={event => updateAction(index, item => {
                  if (item.kind !== 'enterActor') return item;
                  return event.target.value === 'pmd'
                    ? {
                      ...item,
                      source: {
                        kind: 'pmd',
                        assetId: pmdAssets[0]?.assetId ?? 'pmd:missing',
                        animationName: pmdAssets[0]?.animations[0]?.name,
                      },
                      poseAssetId: undefined,
                    }
                    : {
                      ...item,
                      source: { kind: 'illustration', assetId: poses[0]?.assetId ?? 'narrative:character:missing' },
                      poseAssetId: poses[0]?.assetId,
                    };
                })}><option value="illustration">Ilustración</option><option value="pmd">Pokémon PMD</option></select></label>
                {action.source.kind === 'illustration' ? <label>Pose inicial<select value={action.poseAssetId ?? action.source.assetId} onChange={event => updateAction(index, item => item.kind === 'enterActor' && item.source.kind === 'illustration' ? { ...item, source: { ...item.source, assetId: event.target.value }, poseAssetId: event.target.value } : item)}>{poses.map(item => <option key={item.assetId} value={item.assetId}>{item.kind === 'narrativeCharacter' ? `${item.characterName} · ${item.poseLabel}` : item.assetId}</option>)}</select></label> : <>
                  <label>Pokémon<select value={action.source.assetId} onChange={event => updateAction(index, item => {
                    if (item.kind !== 'enterActor' || item.source.kind !== 'pmd') return item;
                    const asset = pmdAssets.find(candidate => candidate.assetId === event.target.value);
                    return { ...item, source: { kind: 'pmd', assetId: event.target.value, animationName: asset?.animations[0]?.name } };
                  })}>{pmdAssets.map(item => <option key={item.assetId} value={item.assetId}>#{String(item.speciesId).padStart(4, '0')} · {item.formId}</option>)}</select></label>
                  <label>Animación<select value={action.source.animationName ?? ''} onChange={event => updateAction(index, item => item.kind === 'enterActor' && item.source.kind === 'pmd' ? { ...item, source: { ...item.source, animationName: event.target.value || undefined } } : item)}><option value="">Primera disponible</option>{pmdAssets.find(item => item.assetId === action.source.assetId)?.animations.map(animation => <option key={animation.name}>{animation.name}</option>)}</select></label>
                </>}
              </> : null}
              {action.kind === 'exitActor' || action.kind === 'setActorPose' || action.kind === 'setActorAnimation' || action.kind === 'moveActor' ? <label>ID del actor<input value={action.actorId} onChange={event => updateAction(index, item => (
                item.kind === 'exitActor' || item.kind === 'setActorPose' || item.kind === 'setActorAnimation' || item.kind === 'moveActor'
                  ? { ...item, actorId: event.target.value }
                  : item
              ))} /></label> : null}
              {action.kind === 'setActorPose' ? <label>Pose<select value={action.poseAssetId} onChange={event => updateAction(index, item => item.kind === 'setActorPose' ? { ...item, poseAssetId: event.target.value } : item)}>{poses.map(item => <option key={item.assetId} value={item.assetId}>{item.kind === 'narrativeCharacter' ? `${item.characterName} · ${item.poseLabel}` : item.assetId}</option>)}</select></label> : null}
              {action.kind === 'setActorAnimation' ? <label>Animación<select value={action.animationName} onChange={event => updateAction(index, item => item.kind === 'setActorAnimation' ? { ...item, animationName: event.target.value } : item)}>{[...new Set(pmdAssets.flatMap(item => item.animations.map(animation => animation.name)))].sort().map(name => <option key={name}>{name}</option>)}</select></label> : null}
              {action.kind === 'enterActor' || action.kind === 'exitActor' || action.kind === 'moveActor' ? <label>Movimiento<select value={action.motion ?? 'fade'} onChange={event => updateAction(index, item => (
                item.kind === 'enterActor' || item.kind === 'exitActor' || item.kind === 'moveActor'
                  ? { ...item, motion: event.target.value as NonNullable<typeof item.motion> }
                  : item
              ))}>{['enter','exit','slide','hop','shake','zoom','fade'].map(motion => <option key={motion}>{motion}</option>)}</select></label> : null}
              {action.kind === 'moveActor' || action.kind === 'enterActor' ? <fieldset className="vn-action__transform"><legend>Transformación</legend>
                <label>Posición<select value={action.transform.slot} onChange={event => updateAction(index, item => item.kind === 'moveActor' || item.kind === 'enterActor' ? { ...item, transform: { ...item.transform, slot: event.target.value as typeof item.transform.slot } } : item)}>{['farLeft','left','center','right','farRight'].map(slot => <option key={slot}>{slot}</option>)}</select></label>
                <label>X<input type="number" value={action.transform.offsetX ?? 0} onChange={event => updateAction(index, item => item.kind === 'moveActor' || item.kind === 'enterActor' ? { ...item, transform: { ...item.transform, offsetX: Number(event.target.value) || undefined } } : item)} /></label>
                <label>Y<input type="number" value={action.transform.offsetY ?? 0} onChange={event => updateAction(index, item => item.kind === 'moveActor' || item.kind === 'enterActor' ? { ...item, transform: { ...item.transform, offsetY: Number(event.target.value) || undefined } } : item)} /></label>
                <label>Escala<input type="number" min=".1" step=".05" value={action.transform.scale ?? 1} onChange={event => updateAction(index, item => item.kind === 'moveActor' || item.kind === 'enterActor' ? { ...item, transform: { ...item.transform, scale: Math.max(.1, Number(event.target.value) || 1) } } : item)} /></label>
                <label>Profundidad<input type="number" value={action.transform.depth ?? 0} onChange={event => updateAction(index, item => item.kind === 'moveActor' || item.kind === 'enterActor' ? { ...item, transform: { ...item.transform, depth: Number(event.target.value) || undefined } } : item)} /></label>
                <label><span><input type="checkbox" checked={action.transform.mirror ?? false} onChange={event => updateAction(index, item => item.kind === 'moveActor' || item.kind === 'enterActor' ? { ...item, transform: { ...item.transform, mirror: event.target.checked || undefined } } : item)} /> Espejo</span></label>
              </fieldset> : null}
              {action.kind === 'playAudio' ? <>
                <label>Audio<select value={action.audioAssetId} onChange={event => updateAction(index, item => {
                  if (item.kind !== 'playAudio') return item;
                  const asset = audio.find(candidate => candidate.assetId === event.target.value);
                  return { ...item, audioAssetId: event.target.value, channel: asset?.kind === 'audio' ? asset.audioKind : item.channel };
                })}>{audio.map(item => <option key={item.assetId} value={item.assetId}>{item.assetId}</option>)}</select></label>
                <label>Canal<select value={action.channel} onChange={event => updateAction(index, item => item.kind === 'playAudio' ? { ...item, channel: event.target.value as typeof item.channel } : item)}><option value="music">Música</option><option value="effect">Efecto</option><option value="voice">Voz</option></select></label>
                <label>Volumen<input type="number" min="0" max="1" step=".05" value={action.volume ?? 1} onChange={event => updateAction(index, item => item.kind === 'playAudio' ? { ...item, volume: Math.max(0, Math.min(1, Number(event.target.value))) } : item)} /></label>
                <label>Fundido de entrada<input type="number" min="0" value={action.fadeInMs ?? 0} onChange={event => updateAction(index, item => item.kind === 'playAudio' ? { ...item, fadeInMs: Math.max(0, Number(event.target.value) || 0) } : item)} /></label>
                <label><span><input type="checkbox" checked={action.loop ?? false} onChange={event => updateAction(index, item => item.kind === 'playAudio' ? { ...item, loop: event.target.checked || undefined } : item)} /> Bucle</span></label>
                <label><span><input type="checkbox" checked={action.continueAfterConversation ?? false} onChange={event => updateAction(index, item => item.kind === 'playAudio' ? { ...item, continueAfterConversation: event.target.checked || undefined } : item)} /> Mantener al cerrar</span></label>
              </> : null}
              {action.kind === 'stopAudio' ? <>
                <label>Canal<select value={action.channel} onChange={event => updateAction(index, item => item.kind === 'stopAudio' ? { ...item, channel: event.target.value as typeof item.channel } : item)}><option value="all">Todo</option><option value="music">Música</option><option value="effect">Efectos</option><option value="voice">Voz</option></select></label>
                <label>Recurso opcional<select value={action.audioAssetId ?? ''} onChange={event => updateAction(index, item => item.kind === 'stopAudio' ? { ...item, audioAssetId: event.target.value || undefined } : item)}><option value="">Todo el canal</option>{audio.map(item => <option key={item.assetId} value={item.assetId}>{item.assetId}</option>)}</select></label>
                <label>Fundido de salida<input type="number" min="0" value={action.fadeOutMs ?? 0} onChange={event => updateAction(index, item => item.kind === 'stopAudio' ? { ...item, fadeOutMs: Math.max(0, Number(event.target.value) || 0) } : item)} /></label>
              </> : null}
            </div>)}
          </section>
          {errors.length ? <section className="vn-errors"><h2>Diagnóstico</h2>{errors.map(error => <p key={error}>{error}</p>)}</section> : null}
        </> : <p>Selecciona una conversación y un diálogo.</p>}
      </aside>
    </div>

    <footer className="vn-editor__status">
      <span>{busy ? 'Trabajando…' : allErrors.length ? `${allErrors.length} error(es) en la biblioteca` : message}</span>
      <span>{dirtyFiles.length ? `${dirtyFiles.length} archivo(s) pendiente(s)` : workspace ? 'Guardado' : ''}</span>
      <ToolNavigation current="visualNovel" onNavigate={url => {
        if (!dirtyFiles.length) return true;
        setPendingToolUrl(url);
        return false;
      }} />
    </footer>

    {conflicts.length ? <div className="vn-dialog-backdrop"><section role="alertdialog" aria-modal="true" aria-labelledby="vn-external-conflicts-title">
      <h2 id="vn-external-conflicts-title">Cambios externos</h2><p>Se modificaron fuera del editor: {conflicts.join(', ')}. Recarga el proyecto antes de guardar.</p>
      <button type="button" onClick={() => setConflicts([])}>Cerrar</button>
    </section></div> : null}

    {pendingToolUrl ? <div className="vn-dialog-backdrop"><section role="dialog" aria-modal="true" aria-labelledby="vn-pending-changes-title">
      <h2 id="vn-pending-changes-title">Cambios pendientes</h2><p>Guarda o descarta los cambios antes de abrir otra herramienta.</p>
      <div><button type="button" onClick={() => setPendingToolUrl(undefined)}>Cancelar</button><button type="button" onClick={() => window.location.assign(pendingToolUrl)}>Descartar</button><button type="button" onClick={() => void save().then(saved => {
        if (saved) window.location.assign(pendingToolUrl);
      })}>Guardar y continuar</button></div>
    </section></div> : null}
  </main>;
}
