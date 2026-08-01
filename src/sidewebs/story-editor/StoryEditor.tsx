import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Background,
  Controls,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  applyNodeChanges,
  type Connection,
  type Edge,
  type Node,
  type NodeChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type {
  MissionDefinitionV2,
  MissionFlowEffectV2,
  MissionFlowNodeV2,
  RequirementExpressionV1,
  RewardDefinitionV1,
  StoryOutlineV1,
  PokeVoiceSaveV1,
} from "../../../packages/contracts/src/index.js";
import { createPokeVoiceSaveV1 } from "../../domain/progress/pokeVoiceSave.js";
import { evaluateRequirement } from "../../domain/requirements/evaluateRequirement.js";
import {
  missionFlowNodeTargets,
  validateMissionFlow,
} from "../../domain/expeditions/missionFlow.js";
import { settleMissionFlow } from "../../domain/expeditions/missionFlowRuntime.js";
import { startAdventureMission } from "../../domain/expeditions/missionLifecycle.js";
import { nextStableEditorId } from "../../domain/tools/pokeDiscoverEditorBeats.js";
import {
  findStoryWorkspaceConflicts,
  getStoryDirtyPaths,
  loadStoryEditorWorkspace,
  removeStoryDraft,
  replaceStoryMission,
  saveStoryEditorWorkspace,
  validateStoryWorkspace,
  type StoryEditorMapProject,
  type StoryEditorWorkspace,
} from "../../domain/tools/storyEditorWorkspace.js";
import {
  readPokeDiscoverRecentFolder,
  rememberPokeDiscoverRecentFolder,
} from "../../domain/tools/pokeDiscoverEditorRecentFolder.js";
import type { PokeDiscoverDirectoryHandle } from "../../domain/tools/pokeDiscoverEditorWorkspace.js";
import { RequirementExpressionEditor } from "../pokediscover-editor/RequirementEditor.js";
import {
  resolvePokeDiscoverToolUrl,
  ToolNavigation,
} from "../shared/ToolNavigation.js";

interface Snapshot {
  maps: StoryEditorMapProject[];
  outline: StoryOutlineV1;
}

interface History {
  past: Snapshot[];
  present: Snapshot;
  future: Snapshot[];
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function createSimulationSave(mission?: MissionDefinitionV2): PokeVoiceSaveV1 {
  const base = createPokeVoiceSaveV1({ runId: "story-preview", now: Date.now() });
  return mission
    ? startAdventureMission(base, mission, {}, new Date().toISOString()).save
    : base;
}

function allMissions(maps: readonly StoryEditorMapProject[]) {
  return maps.flatMap((map) => map.missionDocument.missions);
}

function nodeLabel(
  node: MissionFlowNodeV2,
  maps: readonly StoryEditorMapProject[],
) {
  if (node.kind === "conversation")
    return `Conversación · ${node.conversationId}`;
  if (node.kind === "expedition")
    return `Expedición · ${maps.find((map) => map.adventure.mapId === node.mapId)?.adventure.title ?? node.mapId}`;
  if (node.kind === "condition") return "Condición";
  if (node.kind === "effect") return `Efectos · ${node.effects.length}`;
  if (node.kind === "travel") return "Viaje propuesto";
  return node.result === "success" ? "Final con éxito" : "Final de fracaso";
}

function requirementMissionIds(expression?: RequirementExpressionV1): string[] {
  if (!expression) return [];
  if ("all" in expression) return expression.all.flatMap(requirementMissionIds);
  if ("any" in expression) return expression.any.flatMap(requirementMissionIds);
  return expression.kind === "completedMission" ? [expression.missionId] : [];
}

function appendMissionRequirement(
  expression: RequirementExpressionV1 | undefined,
  missionId: string,
): RequirementExpressionV1 {
  const atom = { kind: "completedMission" as const, missionId };
  if (!expression) return atom;
  if ("all" in expression) return { all: [...expression.all, atom] };
  return { all: [expression, atom] };
}

function requirementLeafLabel(expression: Exclude<RequirementExpressionV1, { all: RequirementExpressionV1[] } | { any: RequirementExpressionV1[] }>) {
  if (expression.kind === "completedMission") return `Misión · ${expression.missionId}`;
  if (expression.kind === "companionUnlocked") return `Compañero · #${expression.speciesId}`;
  if (expression.kind === "registeredSpecies") return `Registrado · #${expression.speciesId}`;
  if (expression.kind === "sightedSpecies") return `Avistado · #${expression.speciesId}`;
  if (expression.kind === "inventoryItem") return `Objeto · ${expression.itemId}`;
  return expression.kind;
}

function requirementGraphForMission(
  mission: MissionDefinitionV2,
  missionIndex: number,
) {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const visit = (expression: RequirementExpressionV1, path: string, target: string, depth: number) => {
    if ("all" in expression || "any" in expression) {
      const kind = "all" in expression ? "all" : "any";
      const id = `story-gate:${mission.missionId}:${path}`;
      nodes.push({
        id,
        type: "story",
        data: { label: kind.toUpperCase(), kind: "gate", initial: false },
        position: { x: missionIndex * 250 - 180 - depth * 190, y: missionIndex * 80 + depth * 95 },
      });
      edges.push({ id: `${id}:${target}`, source: id, target });
      const children = "all" in expression ? expression.all : expression.any;
      children.forEach((child, index) => visit(child, `${path}:${index}`, id, depth + 1));
      return;
    }
    if (expression.kind === "completedMission") {
      edges.push({ id: `${expression.missionId}:${target}:${path}`, source: expression.missionId, target });
      return;
    }
    const id = `story-requirement:${mission.missionId}:${path}`;
    nodes.push({
      id,
      type: "story",
      data: { label: requirementLeafLabel(expression), kind: "requirement", initial: false },
      position: { x: missionIndex * 250 - 360 - depth * 170, y: missionIndex * 80 + depth * 95 },
    });
    edges.push({ id: `${id}:${target}`, source: id, target });
  };
  if (mission.availability) visit(mission.availability, "root", mission.missionId, 0);
  return { nodes, edges };
}

function newMission(
  mapId: string,
  existing: readonly MissionDefinitionV2[],
): MissionDefinitionV2 {
  const missionId = nextStableEditorId(
    `mission:${mapId.split(":").at(-1)}`,
    existing.map((item) => item.missionId),
  );
  const expeditionId = `${missionId}:flow:expedition:01`;
  const successId = `${missionId}:flow:success`;
  const failureId = `${missionId}:flow:failure`;
  return {
    schemaVersion: 2,
    missionId,
    mapId,
    title: "Nueva misión",
    loadingText: "Preparando el siguiente encargo…",
    briefing: "Describe el encargo y su intención narrativa.",
    category: "side",
    publicationStatus: "draft",
    lockedPresentation: { kind: "hidden" },
    availability: { kind: "trainerLevel", minimum: 1 },
    objectives: [],
    rewards: [],
    unlocksFreeExpedition: false,
    abandonment: { allowed: true },
    flow: {
      schemaVersion: 2,
      initialNodeId: expeditionId,
      nodes: [
        {
          kind: "expedition",
          nodeId: expeditionId,
          mapId,
          mapVariantIds: [],
          outcomes: { success: successId, failure: failureId },
        },
        { kind: "terminal", nodeId: successId, result: "success" },
        {
          kind: "terminal",
          nodeId: failureId,
          result: "failure",
          failureAction: "retryLastExpedition",
          rollbackPolicy: "preserveGains",
        },
      ],
    },
  };
}

function remapMissionCopy(
  source: MissionDefinitionV2,
  existing: readonly MissionDefinitionV2[],
) {
  const missionId = nextStableEditorId(
    `${source.missionId}:copy`,
    existing.map((item) => item.missionId),
  );
  const nodeMap = new Map(
    source.flow?.nodes.map((node, index) => [
      node.nodeId,
      `${missionId}:flow:${node.kind}:${String(index + 1).padStart(2, "0")}`,
    ]),
  );
  const target = (id: string) => nodeMap.get(id) ?? id;
  return {
    ...clone(source),
    missionId,
    title: `${source.title} (copia)`,
    publicationStatus: "draft" as const,
    objectives: source.objectives.map((objective, index) => ({
      ...objective,
      objectiveId: `${missionId}:objective:${String(index + 1).padStart(2, "0")}`,
    })),
    flow: source.flow
      ? {
          ...source.flow,
          initialNodeId: target(source.flow.initialNodeId),
          nodes: source.flow.nodes.map((node) => {
            const next = { ...clone(node), nodeId: target(node.nodeId) };
            if (next.kind === "conversation")
              return {
                ...next,
                outcomes: Object.fromEntries(
                  Object.entries(next.outcomes).map(([key, id]) => [
                    key,
                    target(id),
                  ]),
                ),
                defaultNextNodeId: next.defaultNextNodeId
                  ? target(next.defaultNextNodeId)
                  : undefined,
              };
            if (next.kind === "expedition")
              return {
                ...next,
                outcomes: Object.fromEntries(
                  Object.entries(next.outcomes).map(([key, id]) => [
                    key,
                    target(id),
                  ]),
                ),
              };
            if (next.kind === "condition")
              return {
                ...next,
                whenTrueNodeId: target(next.whenTrueNodeId),
                whenFalseNodeId: target(next.whenFalseNodeId),
              };
            if (next.kind === "effect")
              return {
                ...next,
                nextNodeId: target(next.nextNodeId),
                effects: next.effects.map((effect, index) => ({
                  ...effect,
                  effectId: `${missionId}:effect:${String(index + 1).padStart(2, "0")}`,
                })),
              };
            if (next.kind === "travel")
              return {
                ...next,
                expeditionNodeId: target(next.expeditionNodeId),
              };
            return next;
          }),
        }
      : undefined,
  } satisfies MissionDefinitionV2;
}

function flowEdges(mission: MissionDefinitionV2): Edge[] {
  return (mission.flow?.nodes ?? []).flatMap((node) =>
    missionFlowNodeTargets(node).map((target, index) => ({
      id: `${node.nodeId}:${index}:${target}`,
      source: node.nodeId,
      target,
      animated: node.kind === "travel",
    })),
  );
}

function FlowCard({
  data,
}: {
  data: { label: string; kind: string; initial: boolean };
}) {
  return (
    <div className={`story-node story-node--${data.kind}`}>
      <Handle type="target" position={Position.Left} />
      <span>{data.kind}</span>
      <strong>{data.label}</strong>
      {data.initial ? <em>Inicio</em> : null}
      {data.kind === "condition" ? (
        <>
          <Handle id="true" type="source" position={Position.Right} style={{ top: "38%" }} />
          <Handle id="false" type="source" position={Position.Right} style={{ top: "72%" }} />
        </>
      ) : data.kind !== "terminal" ? <Handle type="source" position={Position.Right} /> : null}
    </div>
  );
}

const nodeTypes = { story: FlowCard };

function replaceNode(mission: MissionDefinitionV2, node: MissionFlowNodeV2) {
  if (!mission.flow) return mission;
  return {
    ...mission,
    flow: {
      ...mission.flow,
      nodes: mission.flow.nodes.map((item) =>
        item.nodeId === node.nodeId ? node : item,
      ),
    },
  };
}

function nodeSelect(
  flow: NonNullable<MissionDefinitionV2["flow"]>,
  currentId: string,
  value: string,
  onChange: (value: string) => void,
) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value)}>
      {flow.nodes
        .filter((item) => item.nodeId !== currentId)
        .map((item) => (
          <option key={item.nodeId} value={item.nodeId}>
            {item.kind} · {item.nodeId.split(":").at(-1)}
          </option>
        ))}
    </select>
  );
}

function RewardEditor({
  rewards,
  onChange,
}: {
  rewards: RewardDefinitionV1[];
  onChange: (value: RewardDefinitionV1[]) => void;
}) {
  const add = (kind: RewardDefinitionV1["kind"]) =>
    onChange([
      ...rewards,
      kind === "trainerExperience" || kind === "discoveryPoints"
        ? { kind, amount: 10 }
        : kind === "item"
          ? { kind, category: "keyItem", contentId: "key-item:id" }
          : { kind, contentId: `${kind}:id` },
    ]);
  return (
    <fieldset className="story-fields">
      <legend>Recompensas</legend>
      {rewards.map((reward, index) => (
        <div className="story-inline" key={`${reward.kind}:${index}`}>
          <strong>{reward.kind}</strong>
          {"amount" in reward ? (
            <input
              aria-label={`Cantidad ${reward.kind}`}
              type="number"
              min="0"
              value={reward.amount}
              onChange={(event) =>
                onChange(
                  rewards.map((item, itemIndex) =>
                    itemIndex === index
                      ? {
                          ...reward,
                          amount: Math.max(0, Number(event.target.value) || 0),
                        }
                      : item,
                  ),
                )
              }
            />
          ) : (
            <input
              aria-label={`Contenido ${reward.kind}`}
              value={reward.contentId}
              onChange={(event) =>
                onChange(
                  rewards.map((item, itemIndex) =>
                    itemIndex === index
                      ? { ...reward, contentId: event.target.value }
                      : item,
                  ),
                )
              }
            />
          )}
          <button
            type="button"
            onClick={() =>
              onChange(rewards.filter((_, itemIndex) => itemIndex !== index))
            }
          >
            Quitar
          </button>
        </div>
      ))}
      <div className="story-button-row">
        {(
          [
            "trainerExperience",
            "discoveryPoints",
            "item",
            "permission",
            "cosmetic",
          ] as const
        ).map((kind) => (
          <button type="button" key={kind} onClick={() => add(kind)}>
            + {kind}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function MissionInspector({
  mission,
  maps,
  onChange,
}: {
  mission: MissionDefinitionV2;
  maps: StoryEditorMapProject[];
  onChange: (mission: MissionDefinitionV2) => void;
}) {
  return (
    <div className="story-inspector__fields">
      <label>
        <span>Título</span>
        <input
          value={mission.title}
          onChange={(event) =>
            onChange({ ...mission, title: event.target.value })
          }
        />
      </label>
      <label>
        <span>Estado</span>
        <select
          value={mission.publicationStatus}
          onChange={(event) =>
            onChange({
              ...mission,
              publicationStatus: event.target
                .value as MissionDefinitionV2["publicationStatus"],
            })
          }
        >
          <option value="draft">Borrador</option>
          <option value="published">Publicada</option>
          <option value="archived">Archivada</option>
        </select>
      </label>
      <label>
        <span>Categoría</span>
        <select
          value={mission.category}
          onChange={(event) =>
            onChange({
              ...mission,
              category: event.target.value as MissionDefinitionV2["category"],
            })
          }
        >
          <option value="main">Principal</option>
          <option value="side">Secundaria</option>
        </select>
      </label>
      <label>
        <span>Mapa propietario</span>
        <select
          value={mission.mapId}
          onChange={(event) =>
            onChange({ ...mission, mapId: event.target.value })
          }
        >
          {maps.map((map) => (
            <option key={map.adventure.mapId} value={map.adventure.mapId}>
              {map.adventure.title}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>Texto de carga</span>
        <input
          value={mission.loadingText}
          onChange={(event) =>
            onChange({ ...mission, loadingText: event.target.value })
          }
        />
      </label>
      <label>
        <span>Briefing</span>
        <textarea
          value={mission.briefing}
          onChange={(event) =>
            onChange({ ...mission, briefing: event.target.value })
          }
        />
      </label>
      <label>
        <span>Presentación bloqueada</span>
        <select
          value={mission.lockedPresentation.kind}
          onChange={(event) =>
            onChange({
              ...mission,
              lockedPresentation:
                event.target.value === "hinted"
                  ? {
                      kind: "hinted",
                      loreHint: "Aún no sabes suficiente sobre este encargo.",
                    }
                  : { kind: event.target.value as "hidden" | "public" },
            })
          }
        >
          <option value="hidden">Oculta</option>
          <option value="hinted">Con pista narrativa</option>
          <option value="public">Requisitos públicos</option>
        </select>
      </label>
      {mission.lockedPresentation.kind === "hinted" ? (
        <label>
          <span>Pista</span>
          <textarea
            value={mission.lockedPresentation.loreHint}
            onChange={(event) =>
              onChange({
                ...mission,
                lockedPresentation: {
                  kind: "hinted",
                  loreHint: event.target.value,
                },
              })
            }
          />
        </label>
      ) : null}
      <fieldset>
        <legend>Disponibilidad</legend>
        {mission.availability ? (
          <RequirementExpressionEditor
            value={mission.availability}
            onChange={(availability) => onChange({ ...mission, availability })}
          />
        ) : (
          <button
            type="button"
            onClick={() =>
              onChange({
                ...mission,
                availability: { kind: "trainerLevel", minimum: 1 },
              })
            }
          >
            Añadir requisito
          </button>
        )}
      </fieldset>
      <fieldset className="story-fields">
        <legend>Objetivos</legend>
        {mission.objectives.map((objective, index) => (
          <details key={objective.objectiveId}>
            <summary>
              {objective.description || `Objetivo ${index + 1}`}
            </summary>
            <label>
              <span>Descripción</span>
              <input
                value={objective.description}
                onChange={(event) =>
                  onChange({
                    ...mission,
                    objectives: mission.objectives.map((item) =>
                      item.objectiveId === objective.objectiveId
                        ? { ...item, description: event.target.value }
                        : item,
                    ),
                  })
                }
              />
            </label>
            <label className="story-check">
              <input
                type="checkbox"
                checked={Boolean(objective.optional)}
                onChange={(event) =>
                  onChange({
                    ...mission,
                    objectives: mission.objectives.map((item) =>
                      item.objectiveId === objective.objectiveId
                        ? {
                            ...item,
                            optional: event.target.checked || undefined,
                          }
                        : item,
                    ),
                  })
                }
              />
              Opcional
            </label>
            <RequirementExpressionEditor
              value={objective.requirement}
              onChange={(requirement) =>
                onChange({
                  ...mission,
                  objectives: mission.objectives.map((item) =>
                    item.objectiveId === objective.objectiveId
                      ? { ...item, requirement }
                      : item,
                  ),
                })
              }
            />
            <button
              type="button"
              onClick={() =>
                onChange({
                  ...mission,
                  objectives: mission.objectives.filter(
                    (item) => item.objectiveId !== objective.objectiveId,
                  ),
                })
              }
            >
              Eliminar objetivo
            </button>
          </details>
        ))}
        <button
          type="button"
          onClick={() => {
            const objectiveId = nextStableEditorId(
              `${mission.missionId}:objective`,
              mission.objectives.map((item) => item.objectiveId),
            );
            onChange({
              ...mission,
              objectives: [
                ...mission.objectives,
                {
                  objectiveId,
                  description: "Nuevo objetivo",
                  requirement: {
                    kind: "missionFlag",
                    flagId: `${objectiveId}:completed`,
                  },
                },
              ],
            });
          }}
        >
          Añadir objetivo
        </button>
      </fieldset>
      <RewardEditor
        rewards={mission.rewards}
        onChange={(rewards) => onChange({ ...mission, rewards })}
      />
      <label className="story-check">
        <input
          type="checkbox"
          checked={mission.unlocksFreeExpedition}
          onChange={(event) =>
            onChange({
              ...mission,
              unlocksFreeExpedition: event.target.checked,
            })
          }
        />
        Desbloquea expedición libre del mapa propietario
      </label>
      <label className="story-check">
        <input
          type="checkbox"
          checked={mission.abandonment.allowed}
          onChange={(event) =>
            onChange({
              ...mission,
              abandonment: {
                ...mission.abandonment,
                allowed: event.target.checked,
              },
            })
          }
        />
        Permite abandono manual
      </label>
      {!mission.abandonment.allowed ? (
        <label>
          <span>Explicación al jugador</span>
          <input
            value={mission.abandonment.blockedText ?? ""}
            onChange={(event) =>
              onChange({
                ...mission,
                abandonment: {
                  allowed: false,
                  blockedText: event.target.value,
                },
              })
            }
          />
        </label>
      ) : null}
      <details>
        <summary>Identificador estable</summary>
        <code>{mission.missionId}</code>
      </details>
    </div>
  );
}

function EffectFields({
  effect,
  onChange,
}: {
  effect: MissionFlowEffectV2;
  onChange: (effect: MissionFlowEffectV2) => void;
}) {
  if (effect.kind === "grantRewards")
    return (
      <RewardEditor
        rewards={effect.rewards}
        onChange={(rewards) => onChange({ ...effect, rewards })}
      />
    );
  if (effect.kind === "setMissionFlag" || effect.kind === "setWorldFlag")
    return (
      <>
        <input
          value={effect.flagId}
          onChange={(event) =>
            onChange({ ...effect, flagId: event.target.value })
          }
        />
        <input
          value={String(effect.value)}
          onChange={(event) =>
            onChange({ ...effect, value: event.target.value })
          }
        />
      </>
    );
  return (
    <>
      <input
        value={effect.counterId}
        onChange={(event) =>
          onChange({ ...effect, counterId: event.target.value })
        }
      />
      <input
        type="number"
        value={effect.amount}
        onChange={(event) =>
          onChange({ ...effect, amount: Number(event.target.value) || 0 })
        }
      />
    </>
  );
}

function NodeInspector({
  mission,
  node,
  maps,
  conversations,
  onChange,
}: {
  mission: MissionDefinitionV2;
  node: MissionFlowNodeV2;
  maps: StoryEditorMapProject[];
  conversations: StoryEditorWorkspace["conversations"];
  onChange: (mission: MissionDefinitionV2) => void;
}) {
  const flow = mission.flow!;
  const update = (next: MissionFlowNodeV2) =>
    onChange(replaceNode(mission, next));
  const selectedMap =
    node.kind === "expedition"
      ? maps.find((map) => map.adventure.mapId === node.mapId)
      : undefined;
  const conversation =
    node.kind === "conversation"
      ? conversations.find(
          (item) => item.conversationId === node.conversationId,
        )
      : undefined;
  const conversationOutcomes = [
    ...new Set(
      conversation?.cues.flatMap((cue) =>
        [
          cue.outcomeId,
          ...(cue.choices ?? []).map((choice) => choice.outcomeId),
          cue.textInput?.outcomeId,
        ].filter((value): value is string => Boolean(value)),
      ) ?? [],
    ),
  ];
  const mapOutcomes = selectedMap?.adventure.schemaVersion === 3
    ? [...new Set((selectedMap.adventure.mapSequences ?? []).flatMap(sequence =>
      sequence.beats.flatMap(beat => beat.actions.flatMap(action =>
        action.kind === "emitMissionOutcome" ? [action.outcomeId] : [],
      )),
    ))]
    : [];
  return (
    <div className="story-inspector__fields">
      <h3>{nodeLabel(node, maps)}</h3>
      <label className="story-check">
        <input
          type="checkbox"
          checked={flow.initialNodeId === node.nodeId}
          onChange={() =>
            onChange({
              ...mission,
              flow: { ...flow, initialNodeId: node.nodeId },
            })
          }
        />
        Bloque inicial
      </label>
      {node.kind === "conversation" ? (
        <>
          <label>
            <span>Conversación</span>
            <select
              value={node.conversationId}
              onChange={(event) =>
                update({
                  ...node,
                  conversationId: event.target.value,
                  outcomes: {},
                })
              }
            >
              {conversations.map((item) => (
                <option key={item.conversationId} value={item.conversationId}>
                  {item.title}
                </option>
              ))}
            </select>
          </label>
          <a
            href={`${resolvePokeDiscoverToolUrl("visualNovel")}?conversation=${encodeURIComponent(node.conversationId)}`}
          >
            Abrir conversación
          </a>
          <label>
            <span>Continuación predeterminada</span>
            {nodeSelect(
              flow,
              node.nodeId,
              node.defaultNextNodeId ?? "",
              (value) =>
                update({ ...node, defaultNextNodeId: value || undefined }),
            )}
          </label>
          <fieldset>
            <legend>Resultados</legend>
            {conversationOutcomes
              .filter((id) => !(id in node.outcomes))
              .map((id) => (
                <button
                  type="button"
                  key={id}
                  onClick={() =>
                    update({
                      ...node,
                      outcomes: {
                        ...node.outcomes,
                        [id]:
                          flow.nodes.find((item) => item.nodeId !== node.nodeId)
                            ?.nodeId ?? "",
                      },
                    })
                  }
                >
                  Enlazar {id}
                </button>
              ))}
            {Object.entries(node.outcomes).map(([outcome, target]) => (
              <label key={outcome}>
                <span>{outcome}</span>
                {nodeSelect(flow, node.nodeId, target, (value) =>
                  update({
                    ...node,
                    outcomes: { ...node.outcomes, [outcome]: value },
                  }),
                )}
              </label>
            ))}
          </fieldset>
        </>
      ) : null}
      {node.kind === "expedition" ? (
        <>
          <label>
            <span>Mapa</span>
            <select
              value={node.mapId}
              onChange={(event) =>
                update({
                  ...node,
                  mapId: event.target.value,
                  entrySectorId: undefined,
                  entryLocationId: undefined,
                })
              }
            >
              {maps.map((map) => (
                <option key={map.adventure.mapId} value={map.adventure.mapId}>
                  {map.adventure.title}
                </option>
              ))}
            </select>
          </label>
          <a
            href={`${resolvePokeDiscoverToolUrl("editor")}?map=${encodeURIComponent(node.mapId)}`}
          >
            Abrir mapa
          </a>
          <label>
            <span>Sector</span>
            <select
              value={node.entrySectorId ?? ""}
              onChange={(event) =>
                update({
                  ...node,
                  entrySectorId: event.target.value || undefined,
                })
              }
            >
              <option value="">Entrada predeterminada</option>
              {(selectedMap?.adventure.schemaVersion === 3
                ? selectedMap.adventure.sectors.map((item) => item.sectorId)
                : (selectedMap?.adventure.rooms.map((item) => item.roomId) ??
                  [])
              ).map((id) => (
                <option key={id}>{id}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Lugar de entrada</span>
            <select
              value={node.entryLocationId ?? ""}
              onChange={(event) =>
                update({
                  ...node,
                  entryLocationId: event.target.value || undefined,
                })
              }
            >
              <option value="">Sin lugar específico</option>
              {(selectedMap?.adventure.entryPoints ?? []).map((item) => (
                <option key={item.entryPointId} value={item.entryPointId}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Variantes</span>
            <input
              value={node.mapVariantIds.join(", ")}
              onChange={(event) =>
                update({
                  ...node,
                  mapVariantIds: event.target.value
                    .split(",")
                    .map((value) => value.trim())
                    .filter(Boolean),
                })
              }
            />
          </label>
          <fieldset>
            <legend>Resultados del mapa</legend>
            {mapOutcomes.filter(id => !(id in node.outcomes)).map(id => (
              <button
                type="button"
                key={id}
                onClick={() => update({
                  ...node,
                  outcomes: {
                    ...node.outcomes,
                    [id]: flow.nodes.find(item => item.nodeId !== node.nodeId)?.nodeId ?? "",
                  },
                })}
              >
                Enlazar {id}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                const id = `outcome:${Object.keys(node.outcomes).length + 1}`;
                update({
                  ...node,
                  outcomes: {
                    ...node.outcomes,
                    [id]:
                      flow.nodes.find((item) => item.nodeId !== node.nodeId)
                        ?.nodeId ?? "",
                  },
                });
              }}
            >
              Añadir resultado
            </button>
            {Object.entries(node.outcomes).map(([outcome, target]) => (
              <div className="story-inline" key={outcome}>
                <input
                  value={outcome}
                  onChange={(event) => {
                    const outcomes = { ...node.outcomes };
                    delete outcomes[outcome];
                    outcomes[event.target.value] = target;
                    update({ ...node, outcomes });
                  }}
                />
                {nodeSelect(flow, node.nodeId, target, (value) =>
                  update({
                    ...node,
                    outcomes: { ...node.outcomes, [outcome]: value },
                  }),
                )}
              </div>
            ))}
          </fieldset>
        </>
      ) : null}
      {node.kind === "condition" ? (
        <>
          <RequirementExpressionEditor
            value={node.requirement}
            onChange={(requirement) => update({ ...node, requirement })}
          />
          <label>
            <span>Si se cumple</span>
            {nodeSelect(flow, node.nodeId, node.whenTrueNodeId, (value) =>
              update({ ...node, whenTrueNodeId: value }),
            )}
          </label>
          <label>
            <span>Si no</span>
            {nodeSelect(flow, node.nodeId, node.whenFalseNodeId, (value) =>
              update({ ...node, whenFalseNodeId: value }),
            )}
          </label>
        </>
      ) : null}
      {node.kind === "effect" ? (
        <>
          <fieldset>
            <legend>Efectos idempotentes</legend>
            {node.effects.map((effect, index) => (
              <div className="story-effect" key={effect.effectId}>
                <select
                  value={effect.kind}
                  onChange={(event) => {
                    const kind = event.target
                      .value as MissionFlowEffectV2["kind"];
                    const effectId = effect.effectId;
                    const next: MissionFlowEffectV2 =
                      kind === "grantRewards"
                        ? { effectId, kind, rewards: [] }
                        : kind === "setMissionFlag" || kind === "setWorldFlag"
                          ? { effectId, kind, flagId: "flag:id", value: true }
                          : {
                              effectId,
                              kind,
                              counterId: "counter:id",
                              amount: 1,
                            };
                    update({
                      ...node,
                      effects: node.effects.map((item, itemIndex) =>
                        itemIndex === index ? next : item,
                      ),
                    });
                  }}
                >
                  <option value="setMissionFlag">Flag de misión</option>
                  <option value="incrementMissionCounter">
                    Contador de misión
                  </option>
                  <option value="setWorldFlag">Flag global</option>
                  <option value="incrementGlobalCounter">
                    Contador global
                  </option>
                  <option value="grantRewards">Recompensas</option>
                </select>
                <EffectFields
                  effect={effect}
                  onChange={(next) =>
                    update({
                      ...node,
                      effects: node.effects.map((item, itemIndex) =>
                        itemIndex === index ? next : item,
                      ),
                    })
                  }
                />
                <button
                  type="button"
                  onClick={() =>
                    update({
                      ...node,
                      effects: node.effects.filter(
                        (_, itemIndex) => itemIndex !== index,
                      ),
                    })
                  }
                >
                  Quitar
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => {
                const effectId = nextStableEditorId(
                  `${mission.missionId}:effect`,
                  flow.nodes.flatMap((item) =>
                    item.kind === "effect"
                      ? item.effects.map((effect) => effect.effectId)
                      : [],
                  ),
                );
                update({
                  ...node,
                  effects: [
                    ...node.effects,
                    {
                      effectId,
                      kind: "setMissionFlag",
                      flagId: `${effectId}:flag`,
                      value: true,
                    },
                  ],
                });
              }}
            >
              Añadir efecto
            </button>
          </fieldset>
          <label>
            <span>Continuar</span>
            {nodeSelect(flow, node.nodeId, node.nextNodeId, (value) =>
              update({ ...node, nextNodeId: value }),
            )}
          </label>
        </>
      ) : null}
      {node.kind === "travel" ? (
        <>
          <label>
            <span>Texto</span>
            <textarea
              value={node.prompt}
              onChange={(event) =>
                update({ ...node, prompt: event.target.value })
              }
            />
          </label>
          <label>
            <span>Destino</span>
            <select
              value={node.expeditionNodeId}
              onChange={(event) =>
                update({ ...node, expeditionNodeId: event.target.value })
              }
            >
              {flow.nodes
                .filter((item) => item.kind === "expedition")
                .map((item) => (
                  <option key={item.nodeId} value={item.nodeId}>
                    {nodeLabel(item, maps)}
                  </option>
                ))}
            </select>
          </label>
          <label>
            <span>Aceptar</span>
            <input
              value={node.acceptLabel}
              onChange={(event) =>
                update({ ...node, acceptLabel: event.target.value })
              }
            />
          </label>
          <label>
            <span>Aplazar</span>
            <input
              value={node.postponeLabel}
              onChange={(event) =>
                update({ ...node, postponeLabel: event.target.value })
              }
            />
          </label>
        </>
      ) : null}
      {node.kind === "terminal" ? (
        <>
          <label>
            <span>Resultado</span>
            <select
              value={node.result}
              onChange={(event) =>
                update({
                  ...node,
                  result: event.target.value as "success" | "failure",
                })
              }
            >
              <option value="success">Éxito</option>
              <option value="failure">Fracaso</option>
            </select>
          </label>
          {node.result === "failure" ? (
            <>
              <label>
                <span>Al fracasar</span>
                <select
                  value={node.failureAction ?? "retryLastExpedition"}
                  onChange={(event) =>
                    update({
                      ...node,
                      failureAction: event.target.value as NonNullable<
                        typeof node.failureAction
                      >,
                    })
                  }
                >
                  <option value="retryLastExpedition">
                    Reintentar último tramo
                  </option>
                  <option value="restartMission">Reiniciar misión</option>
                  <option value="abandonMission">Abandonar misión</option>
                </select>
              </label>
              <label>
                <span>Ganancias</span>
                <select
                  value={node.rollbackPolicy ?? "preserveGains"}
                  onChange={(event) =>
                    update({
                      ...node,
                      rollbackPolicy: event.target.value as NonNullable<
                        typeof node.rollbackPolicy
                      >,
                    })
                  }
                >
                  <option value="preserveGains">Conservar</option>
                  <option value="restoreSnapshot">Restaurar snapshot</option>
                </select>
              </label>
            </>
          ) : null}
        </>
      ) : null}
      <details>
        <summary>ID técnico</summary>
        <code>{node.nodeId}</code>
      </details>
    </div>
  );
}

export function StoryEditor() {
  const [workspace, setWorkspace] = useState<StoryEditorWorkspace>();
  const [history, setHistory] = useState<History>();
  const [selectedMissionId, setSelectedMissionId] = useState("");
  const [selectedNodeId, setSelectedNodeId] = useState("");
  const [view, setView] = useState<"global" | "mission">("global");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | MissionDefinitionV2["publicationStatus"]
  >("all");
  const [mapFilter, setMapFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [chapterFilter, setChapterFilter] = useState("all");
  const [message, setMessage] = useState(
    "Abre la raíz de pokemon voice para comenzar.",
  );
  const [busy, setBusy] = useState(false);
  const [simulationNodeId, setSimulationNodeId] = useState("");
  const [simulationHistory, setSimulationHistory] = useState<string[]>([]);
  const [simulationSave, setSimulationSave] = useState<PokeVoiceSaveV1>(() =>
    createSimulationSave(),
  );
  const snapshot = history?.present;
  const missions = useMemo(
    () => (snapshot ? allMissions(snapshot.maps) : []),
    [snapshot],
  );
  const selectedMission =
    missions.find((item) => item.missionId === selectedMissionId) ??
    missions[0];
  const selectedNode =
    selectedMission?.flow?.nodes.find(
      (item) => item.nodeId === selectedNodeId,
    ) ?? selectedMission?.flow?.nodes[0];
  const dirtyPaths = useMemo(
    () =>
      workspace && snapshot
        ? getStoryDirtyPaths(workspace, snapshot.maps, snapshot.outline)
        : [],
    [snapshot, workspace],
  );
  const diagnostics = useMemo(
    () =>
      workspace && snapshot
        ? validateStoryWorkspace(
            snapshot.maps,
            snapshot.outline,
            workspace.conversations,
          )
        : [],
    [snapshot, workspace],
  );

  const load = useCallback(async (root: PokeDiscoverDirectoryHandle) => {
    setBusy(true);
    try {
      const loaded = await loadStoryEditorWorkspace(root);
      setWorkspace(loaded);
      setHistory({
        past: [],
        present: { maps: clone(loaded.maps), outline: clone(loaded.outline) },
        future: [],
      });
      const queryMission = new URL(window.location.href).searchParams.get(
        "mission",
      );
      const first =
        allMissions(loaded.maps).find(
          (item) => item.missionId === queryMission,
        ) ?? allMissions(loaded.maps)[0];
      setSelectedMissionId(first?.missionId ?? "");
      setSelectedNodeId(first?.flow?.initialNodeId ?? "");
      setMessage(
        `${allMissions(loaded.maps).length} misiones y ${loaded.conversations.length} conversaciones cargadas.`,
      );
      await rememberPokeDiscoverRecentFolder({
        directoryHandle: root,
        files: [],
        projectName: root.name,
      });
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "No se pudo abrir la historia.",
      );
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void readPokeDiscoverRecentFolder().then((recent) => {
      if (recent?.directoryHandle) void load(recent.directoryHandle);
    });
  }, [load]);

  useEffect(() => {
    if (!dirtyPaths.length) return;
    const unload = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", unload);
    return () => window.removeEventListener("beforeunload", unload);
  }, [dirtyPaths.length]);

  const commit = (
    update: (snapshot: Snapshot) => Snapshot,
    description: string,
  ) => {
    setHistory((current) =>
      current
        ? {
            past: [...current.past, clone(current.present)],
            present: update(clone(current.present)),
            future: [],
          }
        : current,
    );
    setMessage(description);
  };
  const updateMission = (
    mission: MissionDefinitionV2,
    description = "Misión actualizada.",
  ) =>
    commit(
      (current) => ({
        ...current,
        maps: replaceStoryMission(current.maps, mission),
      }),
      description,
    );

  const openRoot = async () => {
    const picker = (
      window as Window & {
        showDirectoryPicker?: (options?: {
          id?: string;
          mode?: "readwrite";
        }) => Promise<PokeDiscoverDirectoryHandle>;
      }
    ).showDirectoryPicker;
    if (!picker) {
      setMessage("Este navegador no ofrece acceso directo a carpetas.");
      return;
    }
    const root = await picker({ id: "pokevoice-story", mode: "readwrite" });
    await load(root);
  };

  const save = async () => {
    if (!workspace || !snapshot) return false;
    setBusy(true);
    try {
      const saved = await saveStoryEditorWorkspace(
        workspace,
        snapshot.maps,
        snapshot.outline,
      );
      setWorkspace(saved);
      setHistory({
        past: [],
        present: { maps: clone(saved.maps), outline: clone(saved.outline) },
        future: [],
      });
      setMessage("Historia guardada de forma transaccional.");
      return true;
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "No se pudo guardar.",
      );
      return false;
    } finally {
      setBusy(false);
    }
  };

  const create = () => {
    if (!snapshot?.maps.length) return;
    const options = snapshot.maps
      .map((map) => `${map.adventure.mapId} — ${map.adventure.title}`)
      .join("\n");
    const selectedMapId = window.prompt(
      `Mapa propietario de la nueva misión:\n\n${options}`,
      snapshot.maps[0].adventure.mapId,
    );
    if (!selectedMapId) return;
    const ownerIndex = snapshot.maps.findIndex(
      (map) => map.adventure.mapId === selectedMapId.trim(),
    );
    if (ownerIndex < 0) {
      setMessage("El mapa propietario indicado no existe.");
      return;
    }
    const mission = newMission(
      snapshot.maps[ownerIndex].adventure.mapId,
      missions,
    );
    commit(
      (current) => ({
        ...current,
        maps: current.maps.map((map, index) =>
          index !== ownerIndex
            ? map
            : {
                ...map,
                missionDocument: {
                  ...map.missionDocument,
                  missions: [...map.missionDocument.missions, mission],
                },
              },
        ),
      }),
      "Borrador creado.",
    );
    setSelectedMissionId(mission.missionId);
    setSelectedNodeId(mission.flow?.initialNodeId ?? "");
    setView("mission");
  };

  const duplicate = () => {
    if (!selectedMission || !snapshot) return;
    const copy = remapMissionCopy(selectedMission, missions);
    commit(
      (current) => ({
        ...current,
        maps: current.maps.map((map) =>
          map.adventure.mapId === copy.mapId
            ? {
                ...map,
                missionDocument: {
                  ...map.missionDocument,
                  missions: [...map.missionDocument.missions, copy],
                },
              }
            : map,
        ),
      }),
      "Misión duplicada como borrador.",
    );
    setSelectedMissionId(copy.missionId);
    setSelectedNodeId(copy.flow?.initialNodeId ?? "");
  };

  const permanentlyDeleteDraft = () => {
    if (!selectedMission || selectedMission.publicationStatus !== "draft")
      return;
    const referenced = missions.some(
      (mission) =>
        mission.missionId !== selectedMission.missionId &&
        requirementMissionIds(mission.availability).includes(
          selectedMission.missionId,
        ),
    );
    if (referenced) {
      setMessage(
        "No se puede borrar: otra misión todavía depende de este borrador.",
      );
      return;
    }
    if (
      !window.confirm(
        `Borrar definitivamente el borrador “${selectedMission.title}”?`,
      )
    )
      return;
    const missionId = selectedMission.missionId;
    commit(
      (current) => ({
        maps: removeStoryDraft(current.maps, missionId),
        outline: {
          ...current.outline,
          acts: current.outline.acts.map((act) => ({
            ...act,
            chapters: act.chapters.map((chapter) => ({
              ...chapter,
              missionIds: chapter.missionIds.filter((id) => id !== missionId),
            })),
          })),
          missionPositions: Object.fromEntries(
            Object.entries(current.outline.missionPositions).filter(
              ([id]) => id !== missionId,
            ),
          ),
          flowNodePositions: Object.fromEntries(
            Object.entries(current.outline.flowNodePositions).filter(
              ([id]) => id !== missionId,
            ),
          ),
        },
      }),
      "Borrador eliminado.",
    );
    setSelectedMissionId("");
    setSelectedNodeId("");
  };

  const addNode = (kind: MissionFlowNodeV2["kind"]) => {
    if (!selectedMission?.flow) return;
    const flow = selectedMission.flow;
    const nodeId = nextStableEditorId(
      `${selectedMission.missionId}:flow:${kind}`,
      flow.nodes.map((item) => item.nodeId),
    );
    const fallback = flow.nodes[0]?.nodeId ?? nodeId;
    const mapId = selectedMission.mapId;
    const conversationId =
      workspace?.conversations[0]?.conversationId ?? "narrative:select";
    const next: MissionFlowNodeV2 =
      kind === "conversation"
        ? {
            kind,
            nodeId,
            conversationId,
            outcomes: {},
            defaultNextNodeId: fallback,
          }
        : kind === "expedition"
          ? { kind, nodeId, mapId, mapVariantIds: [], outcomes: {} }
          : kind === "condition"
            ? {
                kind,
                nodeId,
                requirement: { kind: "trainerLevel", minimum: 1 },
                whenTrueNodeId: fallback,
                whenFalseNodeId: fallback,
              }
            : kind === "effect"
              ? { kind, nodeId, effects: [], nextNodeId: fallback }
              : kind === "travel"
                ? {
                    kind,
                    nodeId,
                    expeditionNodeId:
                      flow.nodes.find((item) => item.kind === "expedition")
                        ?.nodeId ?? fallback,
                    prompt: "¿Quieres viajar al siguiente destino?",
                    acceptLabel: "Viajar ahora",
                    postponeLabel: "Más tarde",
                  }
                : { kind, nodeId, result: "success" };
    updateMission(
      { ...selectedMission, flow: { ...flow, nodes: [...flow.nodes, next] } },
      `Bloque ${kind} añadido.`,
    );
    setSelectedNodeId(nodeId);
  };

  const missionNodes = useMemo<Node[]>(
    () =>
      selectedMission?.flow?.nodes.map((node, index) => ({
        id: node.nodeId,
        type: "story",
        data: {
          label: nodeLabel(node, snapshot?.maps ?? []),
          kind: node.kind,
          initial: selectedMission.flow?.initialNodeId === node.nodeId,
        },
        position: snapshot?.outline.flowNodePositions[
          selectedMission.missionId
        ]?.[node.nodeId] ?? {
          x: (index % 3) * 260,
          y: Math.floor(index / 3) * 130,
        },
      })) ?? [],
    [selectedMission, snapshot],
  );
  const globalNodes = useMemo<Node[]>(
    () => {
      const missionNodes = missions.map((mission, index) => ({
        id: mission.missionId,
        type: "story",
        data: { label: mission.title, kind: mission.category, initial: false },
        position: snapshot?.outline.missionPositions[mission.missionId] ?? {
          x: (index % 4) * 250,
          y: Math.floor(index / 4) * 125,
        },
      }));
      return [
        ...missionNodes,
        ...missions.flatMap((mission, index) => requirementGraphForMission(mission, index).nodes),
      ];
    },
    [missions, snapshot],
  );
  const globalEdges = useMemo<Edge[]>(
    () => missions.flatMap((mission, index) => requirementGraphForMission(mission, index).edges),
    [missions],
  );

  const moveGraphNodes = (
    changes: NodeChange[],
    scope: "global" | "mission",
  ) => {
    if (!changes.some((change) => change.type === "position")) return;
    const current = scope === "global" ? globalNodes : missionNodes;
    const next = applyNodeChanges(changes, current);
    if (!snapshot || (scope === "mission" && !selectedMission)) return;
    commit(
      (value) => ({
        ...value,
        outline:
          scope === "global"
            ? {
                ...value.outline,
                missionPositions: {
                  ...value.outline.missionPositions,
                  ...Object.fromEntries(
                    next.map((node) => [node.id, node.position]),
                  ),
                },
              }
            : {
                ...value.outline,
                flowNodePositions: {
                  ...value.outline.flowNodePositions,
                  [selectedMission!.missionId]: Object.fromEntries(
                    next.map((node) => [node.id, node.position]),
                  ),
                },
              },
      }),
      "Posición del grafo actualizada.",
    );
  };

  const connectGlobal = (connection: Connection) => {
    if (
      !connection.source ||
      !connection.target ||
      connection.source === connection.target
    )
      return;
    const target = missions.find(
      (item) => item.missionId === connection.target,
    );
    if (
      !target ||
      requirementMissionIds(target.availability).includes(connection.source)
    )
      return;
    updateMission(
      {
        ...target,
        availability: appendMissionRequirement(
          target.availability,
          connection.source,
        ),
      },
      "Dependencia de misión añadida.",
    );
  };

  const connectMission = (connection: Connection) => {
    if (!selectedMission?.flow || !connection.source || !connection.target) return;
    const source = selectedMission.flow.nodes.find(node => node.nodeId === connection.source);
    const target = selectedMission.flow.nodes.find(node => node.nodeId === connection.target);
    if (!source || !target || source.kind === "terminal") return;
    let next: MissionFlowNodeV2;
    if (source.kind === "conversation" || source.kind === "expedition") {
      const outcomeId = nextStableEditorId(
        "outcome",
        Object.keys(source.outcomes),
      );
      next = { ...source, outcomes: { ...source.outcomes, [outcomeId]: target.nodeId } };
    } else if (source.kind === "condition") {
      next = connection.sourceHandle === "false"
        ? { ...source, whenFalseNodeId: target.nodeId }
        : { ...source, whenTrueNodeId: target.nodeId };
    } else if (source.kind === "effect") {
      next = { ...source, nextNodeId: target.nodeId };
    } else {
      if (target.kind !== "expedition") {
        setMessage("Un viaje solo puede conectarse con un bloque de expedición.");
        return;
      }
      next = { ...source, expeditionNodeId: target.nodeId };
    }
    updateMission(replaceNode(selectedMission, next), "Conexión de flujo añadida.");
  };

  const chapterMissionIds = chapterFilter === "all"
    ? undefined
    : new Set(snapshot?.outline.acts
      .flatMap(act => act.chapters)
      .find(chapter => chapter.chapterId === chapterFilter)?.missionIds ?? []);

  const filtered = missions.filter(
    (mission) =>
      (statusFilter === "all" || mission.publicationStatus === statusFilter) &&
      (mapFilter === "all" || mission.mapId === mapFilter) &&
      (categoryFilter === "all" || mission.category === categoryFilter) &&
      (!chapterMissionIds || chapterMissionIds.has(mission.missionId)) &&
      `${mission.title} ${mission.missionId}`
        .toLocaleLowerCase()
        .includes(search.toLocaleLowerCase()),
  );
  const simulationNode =
    selectedMission?.flow?.nodes.find(
      (item) => item.nodeId === simulationNodeId,
    ) ??
    selectedMission?.flow?.nodes.find(
      (item) => item.nodeId === selectedMission.flow?.initialNodeId,
    );
  const simulateTo = (target: string) => {
    setSimulationHistory((current) => [
      ...current,
      simulationNode?.nodeId ?? "",
    ]);
    setSimulationNodeId(target);
  };
  const simulationRequirementMet =
    simulationNode?.kind === "condition"
      ? evaluateRequirement(simulationNode.requirement, {
          save: simulationSave,
        }).met
      : false;

  useEffect(() => {
    setSimulationSave(createSimulationSave(selectedMission));
    setSimulationNodeId(selectedMission?.flow?.initialNodeId ?? "");
    setSimulationHistory([]);
  }, [selectedMission?.missionId]);

  const applySimulationEffects = () => {
    if (!selectedMission || simulationNode?.kind !== "effect") return;
    const progress =
      simulationSave.pokeDiscover.missionProgressById[selectedMission.missionId];
    if (!progress) return;
    const positioned: PokeVoiceSaveV1 = {
      ...simulationSave,
      pokeDiscover: {
        ...simulationSave.pokeDiscover,
        missionProgressById: {
          ...simulationSave.pokeDiscover.missionProgressById,
          [selectedMission.missionId]: {
            ...progress,
            checkpointId: simulationNode.nodeId,
            flowNodeId: simulationNode.nodeId,
          },
        },
      },
    };
    const result = settleMissionFlow(positioned, selectedMission);
    setSimulationSave(result.save);
    setSimulationHistory((current) => [...current, simulationNode.nodeId]);
    setSimulationNodeId(result.node?.nodeId ?? simulationNode.nextNodeId);
  };

  return (
    <main className="story-app">
      <header className="story-topbar">
        <div>
          <span>POKÉDISCOVER TOOLS</span>
          <h1>Gestor de historia</h1>
        </div>
        <ToolNavigation
          current="story"
          onNavigate={(url) => {
            if (
              dirtyPaths.length &&
              !window.confirm("Hay cambios sin guardar. ¿Descartarlos?")
            )
              return false;
            window.location.assign(url);
            return false;
          }}
        />
        <div className="story-actions">
          <button type="button" onClick={() => void openRoot()} disabled={busy}>
            Abrir raíz
          </button>
          <button
            type="button"
            onClick={() =>
              setHistory((current) =>
                current?.past.length
                  ? {
                      past: current.past.slice(0, -1),
                      present: current.past.at(-1)!,
                      future: [clone(current.present), ...current.future],
                    }
                  : current,
              )
            }
            disabled={!history?.past.length}
          >
            Deshacer
          </button>
          <button
            type="button"
            onClick={() =>
              setHistory((current) =>
                current?.future.length
                  ? {
                      past: [...current.past, clone(current.present)],
                      present: current.future[0],
                      future: current.future.slice(1),
                    }
                  : current,
              )
            }
            disabled={!history?.future.length}
          >
            Rehacer
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={!workspace || busy || !dirtyPaths.length}
          >
            Guardar <b>{dirtyPaths.length || ""}</b>
          </button>
        </div>
      </header>
      <section className="story-status" role="status">
        <span className={dirtyPaths.length ? "is-dirty" : ""} />
        {message}
      </section>
      {!snapshot ? (
        <section className="story-welcome">
          <div className="story-ball">H</div>
          <h2>La historia completa, en un solo lugar</h2>
          <p>
            Abre la raíz del proyecto para reunir mapas, conversaciones y
            misiones.
          </p>
          <button type="button" onClick={() => void openRoot()}>
            Abrir pokemon voice
          </button>
        </section>
      ) : (
        <div className="story-shell">
          <aside className="story-library">
            <header>
              <h2>Misiones</h2>
              <button type="button" onClick={create}>
                Nueva
              </button>
            </header>
            <input
              aria-label="Buscar misiones"
              placeholder="Buscar…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <select
              aria-label="Filtrar estado"
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as typeof statusFilter)
              }
            >
              <option value="all">Todos los estados</option>
              <option value="draft">Borradores</option>
              <option value="published">Publicadas</option>
              <option value="archived">Archivadas</option>
            </select>
            <select aria-label="Filtrar mapa" value={mapFilter} onChange={(event) => setMapFilter(event.target.value)}>
              <option value="all">Todos los mapas</option>
              {snapshot.maps.map(map => <option key={map.adventure.mapId} value={map.adventure.mapId}>{map.adventure.title}</option>)}
            </select>
            <select aria-label="Filtrar categoría" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
              <option value="all">Todas las categorías</option>
              {[...new Set(missions.map(mission => mission.category))].map(category => <option key={category} value={category}>{category}</option>)}
            </select>
            <select aria-label="Filtrar capítulo" value={chapterFilter} onChange={(event) => setChapterFilter(event.target.value)}>
              <option value="all">Todos los actos y capítulos</option>
              {snapshot.outline.acts.flatMap(act => act.chapters.map(chapter => <option key={chapter.chapterId} value={chapter.chapterId}>{act.title} · {chapter.title}</option>))}
            </select>
            <div className="story-library__list">
              {filtered.map((mission) => (
                <button
                  type="button"
                  key={mission.missionId}
                  aria-pressed={
                    selectedMission?.missionId === mission.missionId
                  }
                  onClick={() => {
                    setSelectedMissionId(mission.missionId);
                    setSelectedNodeId(mission.flow?.initialNodeId ?? "");
                  }}
                >
                  <span className={`is-${mission.publicationStatus}`}>
                    {mission.publicationStatus}
                  </span>
                  <strong>{mission.title}</strong>
                  <small>
                    {
                      snapshot.maps.find(
                        (map) => map.adventure.mapId === mission.mapId,
                      )?.adventure.title
                    }
                  </small>
                </button>
              ))}
            </div>
          </aside>
          <section className="story-workspace">
            <nav className="story-tabs">
              <button
                type="button"
                aria-pressed={view === "global"}
                onClick={() => setView("global")}
              >
                Historia global
              </button>
              <button
                type="button"
                aria-pressed={view === "mission"}
                disabled={!selectedMission}
                onClick={() => setView("mission")}
              >
                Flujo de misión
              </button>
            </nav>
            {view === "global" ? (
              <div className="story-global">
                <section className="story-outline">
                  <header>
                    <div>
                      <span>Orden editorial</span>
                      <h2>Actos y capítulos</h2>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        commit(
                          (current) => ({
                            ...current,
                            outline: {
                              ...current.outline,
                              acts: [
                                ...current.outline.acts,
                                {
                                  schemaVersion: 1,
                                  actId: nextStableEditorId(
                                    `${current.outline.storyId}:act`,
                                    current.outline.acts.map(
                                      (item) => item.actId,
                                    ),
                                  ),
                                  title: `Acto ${current.outline.acts.length + 1}`,
                                  chapters: [],
                                },
                              ],
                            },
                          }),
                          "Acto añadido.",
                        )
                      }
                    >
                      + Acto
                    </button>
                  </header>
                  {snapshot.outline.acts.map((act, actIndex) => (
                    <article key={act.actId}>
                      <header>
                        <input
                          aria-label="Título del acto"
                          value={act.title}
                          onChange={(event) =>
                            commit(
                              (current) => ({
                                ...current,
                                outline: {
                                  ...current.outline,
                                  acts: current.outline.acts.map((item) =>
                                    item.actId === act.actId
                                      ? { ...item, title: event.target.value }
                                      : item,
                                  ),
                                },
                              }),
                              "Acto actualizado.",
                            )
                          }
                        />
                        <div>
                          <button
                            type="button"
                            disabled={!actIndex}
                            onClick={() =>
                              commit((current) => {
                                const acts = [...current.outline.acts];
                                [acts[actIndex - 1], acts[actIndex]] = [
                                  acts[actIndex],
                                  acts[actIndex - 1],
                                ];
                                return {
                                  ...current,
                                  outline: { ...current.outline, acts },
                                };
                              }, "Acto reordenado.")
                            }
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              commit(
                                (current) => ({
                                  ...current,
                                  outline: {
                                    ...current.outline,
                                    acts: current.outline.acts.map((item) =>
                                      item.actId === act.actId
                                        ? {
                                            ...item,
                                            chapters: [
                                              ...item.chapters,
                                              {
                                                schemaVersion: 1,
                                                chapterId: nextStableEditorId(
                                                  `${act.actId}:chapter`,
                                                  item.chapters.map(
                                                    (chapter) =>
                                                      chapter.chapterId,
                                                  ),
                                                ),
                                                title: `Capítulo ${item.chapters.length + 1}`,
                                                missionIds: [],
                                              },
                                            ],
                                          }
                                        : item,
                                    ),
                                  },
                                }),
                                "Capítulo añadido.",
                              )
                            }
                          >
                            + Capítulo
                          </button>
                        </div>
                      </header>
                      {act.chapters.map((chapter) => (
                        <section key={chapter.chapterId}>
                          <input
                            aria-label="Título del capítulo"
                            value={chapter.title}
                            onChange={(event) =>
                              commit(
                                (current) => ({
                                  ...current,
                                  outline: {
                                    ...current.outline,
                                    acts: current.outline.acts.map((item) =>
                                      item.actId === act.actId
                                        ? {
                                            ...item,
                                            chapters: item.chapters.map(
                                              (candidate) =>
                                                candidate.chapterId ===
                                                chapter.chapterId
                                                  ? {
                                                      ...candidate,
                                                      title: event.target.value,
                                                    }
                                                  : candidate,
                                            ),
                                          }
                                        : item,
                                    ),
                                  },
                                }),
                                "Capítulo actualizado.",
                              )
                            }
                          />
                          <div>
                            {chapter.missionIds.map((id, index) => (
                              <button
                                type="button"
                                key={id}
                                onClick={() => setSelectedMissionId(id)}
                              >
                                <span>{index + 1}</span>
                                {missions.find((item) => item.missionId === id)
                                  ?.title ?? id}
                              </button>
                            ))}
                          </div>
                          <select
                            value=""
                            onChange={(event) => {
                              const missionId = event.target.value;
                              if (!missionId) return;
                              commit(
                                (current) => ({
                                  ...current,
                                  outline: {
                                    ...current.outline,
                                    acts: current.outline.acts.map((item) => ({
                                      ...item,
                                      chapters: item.chapters.map(
                                        (candidate) => ({
                                          ...candidate,
                                          missionIds:
                                            candidate.chapterId ===
                                            chapter.chapterId
                                              ? [
                                                  ...candidate.missionIds.filter(
                                                    (id) => id !== missionId,
                                                  ),
                                                  missionId,
                                                ]
                                              : candidate.missionIds.filter(
                                                  (id) => id !== missionId,
                                                ),
                                        }),
                                      ),
                                    })),
                                  },
                                }),
                                "Misión asignada al capítulo.",
                              );
                            }}
                          >
                            <option value="">Añadir misión…</option>
                            {missions
                              .filter(
                                (mission) =>
                                  !chapter.missionIds.includes(
                                    mission.missionId,
                                  ),
                              )
                              .map((mission) => (
                                <option
                                  key={mission.missionId}
                                  value={mission.missionId}
                                >
                                  {mission.title}
                                </option>
                              ))}
                          </select>
                        </section>
                      ))}
                    </article>
                  ))}
                </section>
                <section className="story-graph">
                  <header>
                    <span>Dependencias reales</span>
                    <h2>Árbol de misiones</h2>
                    <p>
                      Conecta una misión con otra para exigir que la primera
                      esté completada.
                    </p>
                  </header>
                  <ReactFlow
                    nodes={globalNodes}
                    edges={globalEdges}
                    nodeTypes={nodeTypes}
                    onNodesChange={(changes) =>
                      moveGraphNodes(changes, "global")
                    }
                    onConnect={connectGlobal}
                    onNodeClick={(_, node) => {
                      if (missions.some(mission => mission.missionId === node.id)) {
                        setSelectedMissionId(node.id);
                      }
                    }}
                    fitView
                  >
                    <Background />
                    <MiniMap />
                    <Controls />
                  </ReactFlow>
                </section>
              </div>
            ) : selectedMission ? (
              <div className="story-mission">
                <header>
                  <div>
                    <span>
                      {selectedMission.publicationStatus} ·{" "}
                      {selectedMission.category}
                    </span>
                    <h2>{selectedMission.title}</h2>
                  </div>
                  <div>
                    <button type="button" onClick={duplicate}>
                      Duplicar
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        updateMission(
                          {
                            ...selectedMission,
                            publicationStatus:
                              selectedMission.publicationStatus === "archived"
                                ? "draft"
                                : "archived",
                          },
                          "Estado editorial actualizado.",
                        )
                      }
                    >
                      {selectedMission.publicationStatus === "archived"
                        ? "Recuperar"
                        : "Archivar"}
                    </button>
                    {selectedMission.publicationStatus === "draft" ? (
                      <button type="button" onClick={permanentlyDeleteDraft}>
                        Borrar borrador
                      </button>
                    ) : null}
                  </div>
                </header>
                <div className="story-mission__body">
                  <section className="story-flow">
                    <div className="story-palette">
                      {(
                        [
                          "conversation",
                          "expedition",
                          "condition",
                          "effect",
                          "travel",
                          "terminal",
                        ] as const
                      ).map((kind) => (
                        <button
                          type="button"
                          key={kind}
                          onClick={() => addNode(kind)}
                        >
                          + {kind}
                        </button>
                      ))}
                    </div>
                    <div className="story-flow__canvas">
                      <ReactFlow
                        nodes={missionNodes}
                        edges={flowEdges(selectedMission)}
                        nodeTypes={nodeTypes}
                        onNodesChange={(changes) =>
                          moveGraphNodes(changes, "mission")
                        }
                        onConnect={connectMission}
                        onNodeClick={(_, node) => setSelectedNodeId(node.id)}
                        fitView
                      >
                        <Background />
                        <MiniMap />
                        <Controls />
                      </ReactFlow>
                    </div>
                    <ol className="story-flow__timeline">
                      {selectedMission.flow?.nodes.map((node) => (
                        <li key={node.nodeId}>
                          <button
                            type="button"
                            aria-pressed={selectedNode?.nodeId === node.nodeId}
                            onClick={() => setSelectedNodeId(node.nodeId)}
                          >
                            <strong>{nodeLabel(node, snapshot.maps)}</strong>
                            <small>
                              {missionFlowNodeTargets(node).length} salida(s)
                            </small>
                          </button>
                        </li>
                      ))}
                    </ol>
                    <section className="story-simulation">
                      <header>
                        <strong>Simulación aislada</strong>
                        <button
                          type="button"
                          onClick={() => {
                            setSimulationNodeId(
                              selectedMission.flow?.initialNodeId ?? "",
                            );
                            setSimulationHistory([]);
                            setSimulationSave(createSimulationSave(selectedMission));
                          }}
                        >
                          Reiniciar
                        </button>
                      </header>
                      {simulationNode ? (
                        <div>
                          <span>
                            {nodeLabel(simulationNode, snapshot.maps)}
                          </span>
                          {simulationNode.kind === "conversation" ||
                          simulationNode.kind === "expedition"
                            ? Object.entries(simulationNode.outcomes).map(
                                ([id, target]) => (
                                  <button
                                    type="button"
                                    key={id}
                                    onClick={() => simulateTo(target)}
                                  >
                                    {id}
                                  </button>
                                ),
                              )
                            : null}
                          {simulationNode.kind === "conversation" &&
                          simulationNode.defaultNextNodeId ? (
                            <button
                              type="button"
                              onClick={() =>
                                simulateTo(simulationNode.defaultNextNodeId!)
                              }
                            >
                              Continuar
                            </button>
                          ) : null}
                          {simulationNode.kind === "condition" ? (
                            <>
                              <button
                                type="button"
                                onClick={() =>
                                  simulateTo(simulationNode.whenTrueNodeId)
                                }
                              >
                                Cumple {simulationRequirementMet ? "✓" : ""}
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  simulateTo(simulationNode.whenFalseNodeId)
                                }
                              >
                                No cumple
                              </button>
                            </>
                          ) : null}
                          {simulationNode.kind === "effect" ? (
                            <button
                              type="button"
                              onClick={applySimulationEffects}
                            >
                              Aplicar {simulationNode.effects.length} efecto(s)
                            </button>
                          ) : null}
                          {simulationNode.kind === "travel" ? (
                            <>
                              <button
                                type="button"
                                onClick={() =>
                                  simulateTo(simulationNode.expeditionNodeId)
                                }
                              >
                                {simulationNode.acceptLabel}
                              </button>
                              <button type="button">
                                {simulationNode.postponeLabel}
                              </button>
                            </>
                          ) : null}
                          {simulationNode.kind === "terminal" ? (
                            <strong>{simulationNode.result}</strong>
                          ) : null}
                        </div>
                      ) : null}
                      <small>
                        {simulationHistory.length} bloque(s) recorridos · sin
                        escritura de progreso
                      </small>
                    </section>
                  </section>
                  <aside className="story-inspector">
                    <details open>
                      <summary>Misión</summary>
                      <MissionInspector
                        mission={selectedMission}
                        maps={snapshot.maps}
                        onChange={updateMission}
                      />
                    </details>
                    {selectedNode ? (
                      <details open>
                        <summary>Bloque seleccionado</summary>
                        <NodeInspector
                          mission={selectedMission}
                          node={selectedNode}
                          maps={snapshot.maps}
                          conversations={workspace!.conversations}
                          onChange={updateMission}
                        />
                      </details>
                    ) : null}
                  </aside>
                </div>
              </div>
            ) : null}
          </section>
          <aside className="story-diagnostics">
            <header>
              <strong>Diagnóstico</strong>
              <span>{diagnostics.length}</span>
            </header>
            {diagnostics.length ? (
              diagnostics
                .slice(0, 30)
                .map((error) => <p key={error}>{error}</p>)
            ) : (
              <p className="is-ok">
                La historia no contiene errores estructurales.
              </p>
            )}
            <details>
              <summary>Archivos pendientes ({dirtyPaths.length})</summary>
              {dirtyPaths.map((path) => (
                <code key={path}>{path}</code>
              ))}
            </details>
            <button
              type="button"
              onClick={() =>
                void findStoryWorkspaceConflicts(workspace!).then((conflicts) =>
                  setMessage(
                    conflicts.length
                      ? `Conflictos: ${conflicts.join(", ")}`
                      : "No hay cambios externos.",
                  ),
                )
              }
            >
              Comprobar cambios externos
            </button>
          </aside>
        </div>
      )}
    </main>
  );
}
