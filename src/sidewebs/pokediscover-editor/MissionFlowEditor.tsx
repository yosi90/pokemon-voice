import { useEffect, useMemo, useState } from 'react';
import type {
  MissionDefinitionV1,
  MissionFlowNodeV1,
  NarrativeConversationManifestV1,
  NarrativeConversationV1,
  RequirementExpressionV1,
} from '../../../packages/contracts/src/index.js';
import {
  advanceMissionFlow,
  createLegacyMissionFlow,
  validateMissionFlow,
} from '../../domain/expeditions/missionFlow.js';
import { nextStableEditorId } from '../../domain/tools/pokeDiscoverEditorBeats.js';
import { resolvePokeDiscoverToolUrl } from '../shared/ToolNavigation.js';
import { RequirementExpressionEditor } from './RequirementEditor.js';

interface AvailableMap {
  mapId: string;
  title: string;
  sectors: Array<{ sectorId: string; label: string }>;
}

function conversationOutcomes(conversation: NarrativeConversationV1) {
  return [...new Set(conversation.cues.flatMap(cue => [
    ...(cue.outcomeId ? [cue.outcomeId] : []),
    ...(cue.choices ?? []).flatMap(choice => choice.outcomeId ? [choice.outcomeId] : []),
    ...(cue.textInput?.outcomeId ? [cue.textInput.outcomeId] : []),
  ]))];
}

function targets(node: MissionFlowNodeV1) {
  if (node.kind === 'conversation') {
    return [...Object.values(node.outcomes), ...(node.defaultNextNodeId ? [node.defaultNextNodeId] : [])];
  }
  if (node.kind === 'expedition') return Object.values(node.outcomes);
  if (node.kind === 'condition') return [node.whenTrueNodeId, node.whenFalseNodeId];
  return [];
}

function nodeLabel(node: MissionFlowNodeV1) {
  if (node.kind === 'conversation') return `Conversación · ${node.conversationId}`;
  if (node.kind === 'expedition') return `Expedición · ${node.mapId}`;
  if (node.kind === 'condition') return 'Condición';
  return node.result === 'success' ? 'Final con éxito' : 'Final de fracaso';
}

export function MissionFlowEditor({
  mission,
  availableMaps,
  onChange,
}: {
  mission: MissionDefinitionV1;
  availableMaps: AvailableMap[];
  onChange: (mission: MissionDefinitionV1) => void;
}) {
  const [conversationDocuments, setConversationDocuments] = useState<NarrativeConversationV1[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState(mission.flow?.initialNodeId ?? '');
  const [previewNodeId, setPreviewNodeId] = useState(mission.flow?.initialNodeId ?? '');
  const [loadError, setLoadError] = useState('');
  const flow = mission.flow;
  const node = flow?.nodes.find(candidate => candidate.nodeId === selectedNodeId)
    ?? flow?.nodes[0];
  const previewNode = flow?.nodes.find(candidate => candidate.nodeId === previewNodeId);
  const errors = flow ? validateMissionFlow(flow) : [];
  const conversationById = useMemo(
    () => new Map(conversationDocuments.map(item => [item.conversationId, item])),
    [conversationDocuments],
  );

  useEffect(() => {
    const base = new URL('../../', window.location.href);
    void fetch(new URL('assets/adventure/narratives/manifest.v1.json', base))
      .then(response => {
        if (!response.ok) throw new Error(`No se pudo cargar narrativa (${response.status}).`);
        return response.json() as Promise<NarrativeConversationManifestV1>;
      })
      .then(manifest => Promise.all(manifest.conversations.map(entry => (
        fetch(new URL(entry.documentPath, base)).then(response => {
          if (!response.ok) throw new Error(`No se pudo cargar ${entry.documentPath}.`);
          return response.json() as Promise<NarrativeConversationV1>;
        })
      ))))
      .then(setConversationDocuments)
      .catch(cause => setLoadError(cause instanceof Error ? cause.message : 'No se pudo cargar narrativa.'));
  }, []);

  const updateFlow = (next: NonNullable<MissionDefinitionV1['flow']>) => {
    onChange({ ...mission, flow: next });
  };

  const replaceNode = (next: MissionFlowNodeV1) => {
    if (!flow) return;
    updateFlow({
      ...flow,
      nodes: flow.nodes.map(candidate => candidate.nodeId === next.nodeId ? next : candidate),
    });
  };

  const addNode = (kind: MissionFlowNodeV1['kind']) => {
    if (!flow) return;
    const nodeId = nextStableEditorId(
      `${mission.missionId}:flow:${kind}`,
      flow.nodes.map(item => item.nodeId),
    );
    const firstMap = availableMaps.find(item => item.mapId === mission.mapId) ?? availableMaps[0];
    const firstConversation = conversationDocuments[0];
    let next: MissionFlowNodeV1;
    if (kind === 'conversation') next = {
      kind,
      nodeId,
      conversationId: firstConversation?.conversationId ?? 'narrative:select',
      outcomes: {},
    };
    else if (kind === 'expedition') next = {
      kind,
      nodeId,
      mapId: firstMap?.mapId ?? mission.mapId,
      entrySectorId: firstMap?.sectors[0]?.sectorId,
      mapVariantIds: [],
      outcomes: {},
    };
    else if (kind === 'condition') {
      const terminal = flow.nodes.find(item => item.kind === 'terminal')?.nodeId
        ?? flow.initialNodeId;
      next = {
        kind,
        nodeId,
        requirement: { kind: 'missionFlag', flagId: `${mission.missionId}:condition` },
        whenTrueNodeId: terminal,
        whenFalseNodeId: terminal,
      };
    } else next = { kind, nodeId, result: 'success' };
    updateFlow({ ...flow, nodes: [...flow.nodes, next] });
    setSelectedNodeId(nodeId);
  };

  const moveNode = (direction: -1 | 1) => {
    if (!flow || !node) return;
    const index = flow.nodes.findIndex(item => item.nodeId === node.nodeId);
    const target = index + direction;
    if (target < 0 || target >= flow.nodes.length) return;
    const nodes = [...flow.nodes];
    [nodes[index], nodes[target]] = [nodes[target], nodes[index]];
    updateFlow({ ...flow, nodes });
  };

  const duplicateNode = () => {
    if (!flow || !node) return;
    const nodeId = nextStableEditorId(
      `${mission.missionId}:flow:${node.kind}`,
      flow.nodes.map(item => item.nodeId),
    );
    const duplicated = { ...structuredClone(node), nodeId } as MissionFlowNodeV1;
    const index = flow.nodes.findIndex(item => item.nodeId === node.nodeId);
    const nodes = [...flow.nodes];
    nodes.splice(index + 1, 0, duplicated);
    updateFlow({ ...flow, nodes });
    setSelectedNodeId(nodeId);
  };

  const addOutcome = (outcomeId: string) => {
    if (!flow || !node || (node.kind !== 'conversation' && node.kind !== 'expedition')) return;
    const target = flow.nodes.find(item => item.nodeId !== node.nodeId)?.nodeId;
    if (!target) return;
    replaceNode({ ...node, outcomes: { ...node.outcomes, [outcomeId]: target } });
  };

  const removeNode = () => {
    if (!flow || !node || node.nodeId === flow.initialNodeId) return;
    if (flow.nodes.some(candidate => candidate.nodeId !== node.nodeId
      && targets(candidate).includes(node.nodeId))) return;
    const nodes = flow.nodes.filter(candidate => candidate.nodeId !== node.nodeId);
    updateFlow({ ...flow, nodes });
    setSelectedNodeId(nodes[0]?.nodeId ?? '');
  };

  const simulate = (outcomeId?: string, requirementResult = true) => {
    if (!flow || !previewNode) return;
    try {
      setPreviewNodeId(advanceMissionFlow(flow, previewNode.nodeId, {
        outcomeId,
        evaluateRequirement: () => requirementResult,
      }));
    } catch {
      // El diagnóstico visible conserva el nodo actual.
    }
  };

  if (!flow) return <section className="editor-mission-flow editor-mission-flow--empty">
    <div>
      <span className="editor-eyebrow">Compositor por bloques</span>
      <h3>Convierte la misión en una timeline</h3>
      <p>La migración conserva sus diálogos, variantes, mapa y finales actuales.</p>
    </div>
    <button type="button" onClick={() => {
      const next = createLegacyMissionFlow(mission);
      onChange({ ...mission, flow: next });
      setSelectedNodeId(next.initialNodeId);
      setPreviewNodeId(next.initialNodeId);
    }}>Crear flujo de misión</button>
  </section>;

  return <section className="editor-mission-flow">
    <header>
      <div><span className="editor-eyebrow">Timeline de misión</span><h3>Bloques y carriles</h3></div>
      <a href={resolvePokeDiscoverToolUrl('visualNovel')}>Abrir editor de conversaciones</a>
    </header>
    {loadError ? <p className="editor-mission-flow__error">{loadError}</p> : null}
    <div className="editor-mission-flow__layout">
      <div className="editor-mission-flow__lane">
        {flow.nodes.map((candidate, index) => <button
          type="button"
          key={candidate.nodeId}
          className={`is-${candidate.kind}`}
          aria-pressed={candidate.nodeId === node?.nodeId}
          onClick={() => setSelectedNodeId(candidate.nodeId)}
        >
          <span>{index + 1}</span>
          <strong>{nodeLabel(candidate)}</strong>
          <small>{targets(candidate).length
            ? `${targets(candidate).length} salida(s)`
            : candidate.kind === 'terminal' ? 'Fin de misión' : 'Sin enlazar'}</small>
          {flow.initialNodeId === candidate.nodeId ? <em>Inicio</em> : null}
        </button>)}
        <div className="editor-mission-flow__add">
          <button type="button" onClick={() => addNode('conversation')}>+ Conversación</button>
          <button type="button" onClick={() => addNode('expedition')}>+ Expedición</button>
          <button type="button" onClick={() => addNode('condition')}>+ Condición</button>
          <button type="button" onClick={() => addNode('terminal')}>+ Final</button>
        </div>
      </div>

      {node ? <div className="editor-mission-flow__inspector">
        <header><strong>{nodeLabel(node)}</strong><div>
          <button type="button" disabled={flow.nodes[0]?.nodeId === node.nodeId} onClick={() => moveNode(-1)}>↑</button>
          <button type="button" disabled={flow.nodes.at(-1)?.nodeId === node.nodeId} onClick={() => moveNode(1)}>↓</button>
          <button type="button" onClick={duplicateNode}>Duplicar</button>
          <button type="button" disabled={node.nodeId === flow.initialNodeId || flow.nodes.some(candidate => candidate.nodeId !== node.nodeId && targets(candidate).includes(node.nodeId))} onClick={removeNode}>Eliminar</button>
        </div></header>
        <details><summary>Detalles técnicos</summary><code>{node.nodeId}</code></details>
        <label><span>Bloque inicial</span><input type="checkbox" checked={node.nodeId === flow.initialNodeId} onChange={() => updateFlow({ ...flow, initialNodeId: node.nodeId })} /></label>

        {node.kind === 'conversation' ? <>
          <label><span>Conversación</span><select value={node.conversationId} onChange={event => replaceNode({ ...node, conversationId: event.target.value })}>
            {conversationDocuments.map(item => <option key={item.conversationId} value={item.conversationId}>{item.title}</option>)}
          </select></label>
          <label><span>Continuación predeterminada</span><select value={node.defaultNextNodeId ?? ''} onChange={event => replaceNode({ ...node, defaultNextNodeId: event.target.value || undefined })}>
            <option value="">Depende del resultado</option>
            {flow.nodes.filter(item => item.nodeId !== node.nodeId).map(item => <option key={item.nodeId} value={item.nodeId}>{nodeLabel(item)}</option>)}
          </select></label>
          <fieldset><legend>Resultados de la conversación</legend>
            {conversationOutcomes(conversationById.get(node.conversationId) ?? {
              schemaVersion: 1, conversationId: '', title: '', tags: [], initialCueId: '', once: false, cues: [],
            }).filter(outcomeId => !(outcomeId in node.outcomes)).map(outcomeId => <button type="button" key={outcomeId} onClick={() => addOutcome(outcomeId)}>Enlazar {outcomeId}</button>)}
            {Object.entries(node.outcomes).map(([outcomeId, target]) => <div className="editor-mission-flow__outcome" key={outcomeId}><label><span>{outcomeId}</span><select value={target} onChange={event => replaceNode({ ...node, outcomes: { ...node.outcomes, [outcomeId]: event.target.value } })}>{flow.nodes.filter(item => item.nodeId !== node.nodeId).map(item => <option key={item.nodeId} value={item.nodeId}>{nodeLabel(item)}</option>)}</select></label><button type="button" aria-label={`Eliminar resultado ${outcomeId}`} onClick={() => {
              const outcomes = { ...node.outcomes };
              delete outcomes[outcomeId];
              replaceNode({ ...node, outcomes });
            }}>×</button></div>)}
          </fieldset>
        </> : null}

        {node.kind === 'expedition' ? <>
          <label><span>Mapa</span><select value={node.mapId} onChange={event => {
            const selected = availableMaps.find(item => item.mapId === event.target.value);
            replaceNode({ ...node, mapId: event.target.value, entrySectorId: selected?.sectors[0]?.sectorId });
          }}>{availableMaps.map(item => <option key={item.mapId} value={item.mapId}>{item.title}</option>)}</select></label>
          <label><span>Sector de entrada</span><select value={node.entrySectorId ?? ''} onChange={event => replaceNode({ ...node, entrySectorId: event.target.value || undefined })}><option value="">Entrada predeterminada</option>{availableMaps.find(item => item.mapId === node.mapId)?.sectors.map(item => <option key={item.sectorId} value={item.sectorId}>{item.label}</option>)}</select></label>
          <label><span>Lugar de entrada opcional</span><input value={node.entryLocationId ?? ''} onChange={event => replaceNode({ ...node, entryLocationId: event.target.value.trim() || undefined })} /></label>
          <label><span>Variantes</span><input value={node.mapVariantIds.join(', ')} onChange={event => replaceNode({ ...node, mapVariantIds: event.target.value.split(',').map(value => value.trim()).filter(Boolean) })} /></label>
          <fieldset><legend>Resultados emitidos por el mapa</legend>
            <button type="button" onClick={() => addOutcome(`outcome:${Object.keys(node.outcomes).length + 1}`)}>Añadir resultado</button>
            {Object.entries(node.outcomes).map(([outcomeId, target]) => <div className="editor-mission-flow__outcome" key={outcomeId}><input value={outcomeId} onChange={event => {
              const outcomes = { ...node.outcomes };
              delete outcomes[outcomeId];
              outcomes[event.target.value] = target;
              replaceNode({ ...node, outcomes });
            }} /><select value={target} onChange={event => replaceNode({ ...node, outcomes: { ...node.outcomes, [outcomeId]: event.target.value } })}>{flow.nodes.filter(item => item.nodeId !== node.nodeId).map(item => <option key={item.nodeId} value={item.nodeId}>{nodeLabel(item)}</option>)}</select><button type="button" aria-label={`Eliminar resultado ${outcomeId}`} onClick={() => {
              const outcomes = { ...node.outcomes };
              delete outcomes[outcomeId];
              replaceNode({ ...node, outcomes });
            }}>×</button></div>)}
          </fieldset>
        </> : null}

        {node.kind === 'condition' ? <>
          <RequirementExpressionEditor value={node.requirement} onChange={(requirement: RequirementExpressionV1) => replaceNode({ ...node, requirement })} />
          <label><span>Si se cumple</span><select value={node.whenTrueNodeId} onChange={event => replaceNode({ ...node, whenTrueNodeId: event.target.value })}>{flow.nodes.filter(item => item.nodeId !== node.nodeId).map(item => <option key={item.nodeId} value={item.nodeId}>{nodeLabel(item)}</option>)}</select></label>
          <label><span>Si no se cumple</span><select value={node.whenFalseNodeId} onChange={event => replaceNode({ ...node, whenFalseNodeId: event.target.value })}>{flow.nodes.filter(item => item.nodeId !== node.nodeId).map(item => <option key={item.nodeId} value={item.nodeId}>{nodeLabel(item)}</option>)}</select></label>
        </> : null}

        {node.kind === 'terminal' ? <label><span>Resultado</span><select value={node.result} onChange={event => replaceNode({ ...node, result: event.target.value as typeof node.result })}><option value="success">Completar misión</option><option value="failure">Fracasar y volver a PokeDiscover</option></select></label> : null}
      </div> : null}
    </div>

    <section className="editor-mission-flow__preview">
      <header><strong>Simulación aislada</strong><button type="button" onClick={() => setPreviewNodeId(flow.initialNodeId)}>Reiniciar</button></header>
      {previewNode ? <div><span>{nodeLabel(previewNode)}</span>
        {previewNode.kind === 'conversation' ? <>
          {Object.keys(previewNode.outcomes).map(outcome => <button type="button" key={outcome} onClick={() => simulate(outcome)}>{outcome}</button>)}
          {previewNode.defaultNextNodeId ? <button type="button" onClick={() => simulate()}>Continuar</button> : null}
        </> : null}
        {previewNode.kind === 'expedition' ? Object.keys(previewNode.outcomes).map(outcome => <button type="button" key={outcome} onClick={() => simulate(outcome)}>{outcome}</button>) : null}
        {previewNode.kind === 'condition' ? <><button type="button" onClick={() => simulate(undefined, true)}>Cumple</button><button type="button" onClick={() => simulate(undefined, false)}>No cumple</button></> : null}
        {previewNode.kind === 'terminal' ? <strong>{previewNode.result === 'success' ? 'Misión completada' : 'Misión fracasada'}</strong> : null}
      </div> : null}
    </section>
    {errors.length ? <div className="editor-mission-flow__errors">{errors.map(error => <p key={error}>{error}</p>)}</div> : null}
  </section>;
}
