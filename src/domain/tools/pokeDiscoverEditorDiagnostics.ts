import type {
  AdventureMapV3,
  RequirementAtomV1,
  RequirementExpressionV1,
} from '../../../packages/contracts/src/index.js';
import { POKEDISCOVER_MISSION_CATALOG } from '../../data/adventure/missionCatalog.js';
import { POKE_DISCOVER_FIELD_TOOLS, POKE_DISCOVER_SHOP_CONTENT } from '../../data/adventure/pokeDiscoverShop.js';
import type { LoadedAdventureMapBundle } from '../maps/loadAdventureBundle.js';
import { validateTiledAdventureBundle } from '../maps/tiledAdventureValidator.js';
import { createAdventureTerrainRuntime, terrainCellAtGroundPoint } from '../maps/adventureTerrainRuntime.js';
import { readTiledCollisionShape, rectangleOverlapsCollision } from '../maps/tiledCollisionGeometry.js';
import { rasterizeRoamArea, readRoamArea, roamCellGroundPoint, roamCellKey } from '../maps/adventureRoaming.js';
import { COMPANION_GAMEPLAY_SPECIES } from '../companions/companionGameplayCatalog.js';
import { analyzePokeDiscoverEditorEconomy } from './pokeDiscoverEditorEconomyAnalysis.js';
import { listAdventureRequirementTargets } from './pokeDiscoverEditorRequirements.js';

export type PokeDiscoverEditorDiagnosticCategory =
  | 'duplicateId'
  | 'brokenReference'
  | 'circularDependency'
  | 'inaccessibleObjective'
  | 'missingVoiceFallback'
  | 'insufficientExperience'
  | 'mandatoryPurchase'
  | 'invalidData';

export interface PokeDiscoverEditorDiagnostic {
  diagnosticId: string;
  severity: 'error' | 'warning';
  category: PokeDiscoverEditorDiagnosticCategory;
  sourceId: string;
  message: string;
}

function diagnostic(
  category: PokeDiscoverEditorDiagnosticCategory,
  severity: PokeDiscoverEditorDiagnostic['severity'],
  sourceId: string,
  message: string,
): PokeDiscoverEditorDiagnostic {
  return { diagnosticId: `${category}:${sourceId}:${message}`, category, severity, sourceId, message };
}

function requirementAtoms(expression: RequirementExpressionV1): RequirementAtomV1[] {
  if ('all' in expression) return expression.all.flatMap(requirementAtoms);
  if ('any' in expression) return expression.any.flatMap(requirementAtoms);
  return [expression];
}

function guaranteedAllAtoms(expression: RequirementExpressionV1): RequirementAtomV1[] {
  if ('all' in expression) return expression.all.flatMap(guaranteedAllAtoms);
  if ('any' in expression) return [];
  return [expression];
}

const speciesIds = new Set(COMPANION_GAMEPLAY_SPECIES.map(species => species.speciesId));
const formIds = new Set(COMPANION_GAMEPLAY_SPECIES.flatMap(species => species.forms.map(form => form.formId)));
const speciesTags = new Set(COMPANION_GAMEPLAY_SPECIES.flatMap(species => Object.entries(species.traits).filter(([, enabled]) => enabled).map(([tag]) => tag)));
const companionTags = new Set(COMPANION_GAMEPLAY_SPECIES.flatMap(species => species.forms.flatMap(form => [
  ...form.narrativeTags,
  ...form.appearances.flatMap(appearance => appearance.narrativeTags),
])));
const capabilityStrength = new Map<string, number>();
for (const capability of [
  ...COMPANION_GAMEPLAY_SPECIES.flatMap(species => species.forms.flatMap(form => [
    ...form.fieldCapabilities,
    ...form.appearances.flatMap(appearance => appearance.additionalFieldCapabilities),
  ])),
  ...POKE_DISCOVER_FIELD_TOOLS.flatMap(tool => tool.capabilities),
]) capabilityStrength.set(capability.id, Math.max(capabilityStrength.get(capability.id) ?? 0, capability.strength ?? 1));
const inventoryIds = new Set<string>(POKE_DISCOVER_SHOP_CONTENT.flatMap(content => [
  content.contentId,
  ...('toolId' in content ? [content.toolId] : []),
  ...('keyItemId' in content ? [content.keyItemId] : []),
  ...('permissionId' in content ? [content.permissionId] : []),
  ...('cosmeticId' in content ? [content.cosmeticId] : []),
]));

function atomImpossibleReason(atom: RequirementAtomV1): string | undefined {
  if ('speciesId' in atom && ['registeredSpecies','sightedSpecies','researchStatus','researchField','companionSpecies'].includes(atom.kind) && !speciesIds.has(atom.speciesId)) return `la especie ${atom.speciesId} no existe en el catálogo local`;
  if (atom.kind === 'companionForm' && !formIds.has(atom.formId)) return `la forma ${atom.formId} no existe en el catálogo local`;
  if (atom.kind === 'registeredSpeciesByTag' && !speciesTags.has(atom.tag)) return `ninguna especie posee la etiqueta ${atom.tag}`;
  if (atom.kind === 'companionTag' && !companionTags.has(atom.tag)) return `ningún compañero posee la etiqueta ${atom.tag}`;
  if (atom.kind === 'fieldCapability' && (capabilityStrength.get(atom.capabilityId) ?? 0) < (atom.minimumStrength ?? 1)) return `ningún compañero o herramienta aporta ${atom.capabilityId} con fuerza ${atom.minimumStrength ?? 1}`;
  if (atom.kind === 'companionEvolutionStage' && atom.minimum > 3) return `no existe una etapa evolutiva ${atom.minimum}`;
  if (atom.kind === 'inventoryItem' && !inventoryIds.has(atom.itemId)) return `el objeto ${atom.itemId} no existe en la tienda o catálogo local`;
  return undefined;
}

function contradictoryAllReason(expression: RequirementExpressionV1) {
  const atoms = guaranteedAllAtoms(expression);
  const singleValue = <T>(values: T[], label: string) => new Set(values).size > 1 ? `${label} exige valores incompatibles` : undefined;
  const direct = singleValue(atoms.filter((atom): atom is Extract<RequirementAtomV1, { kind: 'companionSpecies' }> => atom.kind === 'companionSpecies').map(atom => atom.speciesId), 'companionSpecies')
    ?? singleValue(atoms.filter((atom): atom is Extract<RequirementAtomV1, { kind: 'companionForm' }> => atom.kind === 'companionForm').map(atom => atom.formId), 'companionForm');
  if (direct) return direct;
  for (const kind of ['worldFlag', 'missionFlag'] as const) {
    const values = new Map<string, Set<string>>();
    for (const atom of atoms.filter((candidate): candidate is Extract<RequirementAtomV1, { kind: typeof kind }> => candidate.kind === kind)) {
      const key = atom.flagId;
      values.set(key, new Set([...(values.get(key) ?? []), JSON.stringify(atom.expected ?? true)]));
    }
    for (const [flagId, expected] of values) if (expected.size > 1) return `${kind} ${flagId} exige valores incompatibles`;
  }
  return undefined;
}

function expressionImpossibleReason(expression: RequirementExpressionV1): string | undefined {
  if ('all' in expression) {
    const contradiction = contradictoryAllReason(expression);
    if (contradiction) return contradiction;
    return expression.all.map(expressionImpossibleReason).find(Boolean);
  }
  if ('any' in expression) {
    if (!expression.any.length) return 'el grupo any no contiene alternativas';
    const reasons = expression.any.map(expressionImpossibleReason);
    return reasons.every(Boolean) ? `ninguna alternativa es alcanzable (${reasons.join('; ')})` : undefined;
  }
  return atomImpossibleReason(expression);
}

function collectStableIds(adventure: AdventureMapV3) {
  const entries: Array<{ id: string; kind: string }> = [];
  const add = (id: string | undefined, kind: string) => { if (id?.trim()) entries.push({ id, kind }); };
  for (const item of adventure.tiledMapAssets ?? []) add(item.assetId, 'asset Tiled');
  for (const item of adventure.sectors ?? []) add(item.sectorId, 'sector');
  for (const item of adventure.actorPlacements ?? []) add(item.placementId, 'actor');
  for (const item of adventure.characterPlacements ?? []) add(item.placementId, 'personaje');
  for (const item of adventure.transitions ?? []) add(item.transitionId, 'transición');
  for (const item of adventure.variants ?? []) add(item.variantId, 'variante');
  for (const item of adventure.rareEncounters ?? []) add(item.encounterId, 'encuentro raro');
  for (const item of adventure.behaviorTriggers ?? []) add(item.triggerId, 'comportamiento');
  for (const item of adventure.expressionTriggers ?? []) add(item.triggerId, 'trigger expresivo');
  for (const item of adventure.mapEventTriggers ?? []) add(item.triggerId, 'evento de mapa');
  for (const item of adventure.worldEvents ?? []) add(item.eventId, 'evento global');
  for (const item of adventure.interactions ?? []) add(item.interactionId, 'interacción');
  for (const item of adventure.dialogues ?? []) { add(item.dialogueId, 'diálogo'); for (const page of item.pages ?? []) add(page.pageId, 'página'); }
  for (const item of adventure.fieldNotebookHints ?? []) add(item.hintId, 'pista');
  for (const item of adventure.researchFacts ?? []) add(item.factId, 'investigación');
  for (const item of adventure.ambientSequences ?? []) { add(item.sequenceId, 'secuencia ambiental'); for (const beat of item.beats ?? []) add(beat.beatId, 'beat ambiental'); }
  for (const item of adventure.companionSequences ?? []) { add(item.sequenceId, 'secuencia de compañero'); for (const beat of item.beats ?? []) add(beat.beatId, 'beat de compañero'); }
  for (const item of adventure.mapSequences ?? []) { add(item.sequenceId, 'secuencia de mapa'); for (const beat of item.beats ?? []) add(beat.beatId, 'beat de mapa'); }
  return entries;
}

interface DependencyNode { id: string; requirement: RequirementExpressionV1; produces: string[] }

function dependencyToken(atom: RequirementAtomV1) {
  if (atom.kind === 'worldFlag') return `flag:${atom.flagId}:${JSON.stringify(atom.expected ?? true)}`;
  if (atom.kind === 'storyEvent') return `flag:${atom.eventId}:true`;
  if (atom.kind === 'unlockedSecret') return `secret:${atom.secretId}`;
  return undefined;
}

function circularDiagnostics(adventure: AdventureMapV3) {
  const nodes: DependencyNode[] = [
    ...(adventure.worldEvents ?? []).map(event => ({ id: event.eventId, requirement: event.activation, produces: Object.entries(event.setFlags).map(([id, value]) => `flag:${id}:${JSON.stringify(value)}`) })),
    ...(adventure.behaviorTriggers ?? []).map(trigger => ({ id: trigger.triggerId, requirement: trigger.requirement, produces: (trigger.completionEffects?.unlockSecretIds ?? []).map(id => `secret:${id}`) })),
    ...(adventure.expressionTriggers ?? []).map(trigger => ({ id: trigger.triggerId, requirement: trigger.activationRequirement, produces: (trigger.completionEffects?.unlockSecretIds ?? []).map(id => `secret:${id}`) })),
    ...(adventure.mapEventTriggers ?? []).map(trigger => ({ id: trigger.triggerId, requirement: trigger.requirement, produces: [] })),
  ];
  const producers = new Map<string, string[]>();
  for (const node of nodes) for (const token of node.produces) producers.set(token, [...(producers.get(token) ?? []), node.id]);
  const graph = new Map(nodes.map(node => [node.id, new Set(requirementAtoms(node.requirement).flatMap(atom => {
    const token = dependencyToken(atom);
    return token ? producers.get(token) ?? [] : [];
  }))]));
  let index = 0;
  const indices = new Map<string, number>();
  const low = new Map<string, number>();
  const stack: string[] = [];
  const stacked = new Set<string>();
  const components: string[][] = [];
  const visit = (node: string) => {
    indices.set(node, index); low.set(node, index); index += 1; stack.push(node); stacked.add(node);
    for (const next of graph.get(node) ?? []) {
      if (!indices.has(next)) { visit(next); low.set(node, Math.min(low.get(node)!, low.get(next)!)); }
      else if (stacked.has(next)) low.set(node, Math.min(low.get(node)!, indices.get(next)!));
    }
    if (low.get(node) === indices.get(node)) {
      const component: string[] = [];
      let current = '';
      do { current = stack.pop()!; stacked.delete(current); component.push(current); } while (current !== node);
      if (component.length > 1 || graph.get(node)?.has(node)) components.push(component.sort());
    }
  };
  for (const node of graph.keys()) if (!indices.has(node)) visit(node);
  return components.map(component => diagnostic('circularDependency', 'error', component[0], `Dependencia circular entre ${component.join(' → ')}.`));
}

export function auditPokeDiscoverEditorLogic(adventure: AdventureMapV3): PokeDiscoverEditorDiagnostic[] {
  const diagnostics: PokeDiscoverEditorDiagnostic[] = [];
  const ids = new Map<string, string[]>();
  for (const entry of collectStableIds(adventure)) ids.set(entry.id, [...(ids.get(entry.id) ?? []), entry.kind]);
  for (const [id, kinds] of ids) if (kinds.length > 1) diagnostics.push(diagnostic('duplicateId', 'error', id, `ID estable duplicado entre ${kinds.join(', ')}.`));

  for (const target of listAdventureRequirementTargets(adventure)) {
    const reason = expressionImpossibleReason(target.expression);
    if (reason) diagnostics.push(diagnostic('inaccessibleObjective', 'error', target.definitionId, `${target.label} es inaccesible: ${reason}.`));
  }
  for (const trigger of adventure.expressionTriggers ?? []) {
    if (!trigger.inputMethods.includes('voice')) continue;
    const textFallback = trigger.inputMethods.includes('text') && trigger.matchAny.some(matcher => matcher.kind !== 'acoustic');
    const actionFallback = trigger.inputMethods.includes('contextAction') && Boolean(trigger.fallbackActionId?.trim());
    if (!textFallback && !actionFallback) diagnostics.push(diagnostic('missingVoiceFallback', 'warning', trigger.triggerId, 'La interacción usa voz pero no tiene fallback efectivo de texto ni acción contextual.'));
  }
  const variants = new Set(adventure.variants.map(item => item.variantId));
  for (const missionId of adventure.missionIds ?? []) {
    const mission = POKEDISCOVER_MISSION_CATALOG.find(candidate => candidate.missionId === missionId);
    if (!mission) { diagnostics.push(diagnostic('brokenReference', 'error', missionId, 'La misión no existe en el catálogo local.')); continue; }
    if (mission.mapId !== adventure.mapId) diagnostics.push(diagnostic('brokenReference', 'error', missionId, `La misión apunta a ${mission.mapId} en lugar de ${adventure.mapId}.`));
    const missionVariantIds = mission.schemaVersion === 1
      ? mission.mapVariantIds
      : (mission.flow?.nodes ?? []).flatMap(node => (
        node.kind === 'expedition' && node.mapId === adventure.mapId ? node.mapVariantIds : []
      ));
    for (const variantId of missionVariantIds) if (!variants.has(variantId)) diagnostics.push(diagnostic('brokenReference', 'error', missionId, `La misión referencia la variante inexistente ${variantId}.`));
    for (const objective of mission.objectives) {
      const reason = expressionImpossibleReason(objective.requirement);
      if (reason) diagnostics.push(diagnostic('inaccessibleObjective', 'error', objective.objectiveId, `Objetivo inaccesible: ${reason}.`));
    }
  }
  diagnostics.push(...circularDiagnostics(adventure));
  for (const warning of analyzePokeDiscoverEditorEconomy(adventure).warnings) {
    diagnostics.push(diagnostic(warning.kind, 'warning', warning.sourceId, warning.message));
  }
  return diagnostics;
}

export function auditPokeDiscoverEditorProject(bundle: LoadedAdventureMapBundle): PokeDiscoverEditorDiagnostic[] {
  const tiledMaps = Object.fromEntries(bundle.sectors.map(room => [room.sector.tiledMapAssetId, room.tilemap]));
  const validationErrors = validateTiledAdventureBundle({
    adventure: bundle.adventure,
    tiledMaps,
    pmdManifest: bundle.pmdManifest,
    characterManifest: bundle.characterManifest,
    mediaManifest: bundle.mediaManifest,
    missionDocument: bundle.missionDocument,
  }) as string[];
  const diagnostics = [...auditPokeDiscoverEditorLogic(bundle.adventure)];
  for (const room of bundle.sectors) {
    const areas = new Map((room.tilemap.layers.find(layer => layer.name === 'Roaming')?.objects as Array<Record<string, unknown>> | undefined ?? [])
      .map(readRoamArea).filter((area): area is NonNullable<typeof area> => Boolean(area))
      .map(area => [area.areaId, area]));
    const collisionShapes = (room.tilemap.layers.find(layer => layer.name === 'Collision')?.objects as Array<Record<string, unknown>> | undefined ?? [])
      .map(readTiledCollisionShape).filter((shape): shape is NonNullable<typeof shape> => Boolean(shape));
    const terrain = createAdventureTerrainRuntime(room.tilemap);
    const placements = [...bundle.adventure.actorPlacements, ...bundle.adventure.characterPlacements]
      .filter(placement => placement.sectorId === room.sector.sectorId && placement.roaming);
    const cellsByArea = new Map<string, number>();
    for (const placement of placements) {
      const area = areas.get(placement.roaming!.areaId);
      if (!area) continue;
      const allowed = placement.terrainRules?.allowedSurfaceTypes ?? ['ground'];
      const cells = rasterizeRoamArea(area, {
        width: room.tilemap.width,
        height: room.tilemap.height,
        canOccupy: cell => {
          const point = roamCellGroundPoint(cell);
          const footprint = { x: point.x - 8, y: point.y - 16, width: 16, height: 16 };
          const surface = terrainCellAtGroundPoint(terrain, point.x, point.y)?.surfaceType ?? 'void';
          return allowed.includes(surface) && !collisionShapes.some(shape => rectangleOverlapsCollision(footprint, shape));
        },
      });
      cellsByArea.set(area.areaId, Math.max(cellsByArea.get(area.areaId) ?? 0, cells.length));
      if (cells.length < 2) diagnostics.push(diagnostic('inaccessibleObjective', 'error', placement.placementId, `El área ${area.areaId} no deja una ruta ni una casilla de emergencia.`));
      const cellKeys = new Set(cells.map(roamCellKey));
      if (cells.length) {
        const reached = new Set<string>();
        const queue = [cells[0]];
        for (let cursor = 0; cursor < queue.length; cursor += 1) {
          const cell = queue[cursor];
          const key = roamCellKey(cell);
          if (reached.has(key)) continue;
          reached.add(key);
          for (const next of [{ x: cell.x - 1, y: cell.y }, { x: cell.x + 1, y: cell.y }, { x: cell.x, y: cell.y - 1 }, { x: cell.x, y: cell.y + 1 }]) {
            if (cellKeys.has(roamCellKey(next)) && !reached.has(roamCellKey(next))) queue.push(next);
          }
        }
        if (reached.size !== cells.length) diagnostics.push(diagnostic('invalidData', 'warning', area.areaId, 'El área de roaming está dividida en regiones inconexas.'));
      }
      if (placement.roaming!.speedPixelsPerSecond >= 80) {
        const actor = bundle.adventure.actorPlacements.find(candidate => candidate.placementId === placement.placementId);
        const character = bundle.adventure.characterPlacements.find(candidate => candidate.placementId === placement.placementId);
        const hasRun = actor
          ? bundle.pmdManifest.assets.find(asset => asset.assetId === actor.assetId)?.animations.some(animation => animation.name === 'Run')
          : Boolean(bundle.characterManifest.assets.find(asset => asset.assetId === character?.assetId)?.runFrames?.length);
        if (!hasRun) diagnostics.push(diagnostic('invalidData', 'warning', placement.placementId, 'La velocidad es de carrera, pero el asset usará Walk acelerado porque no declara Run.'));
      }
    }
    for (const [areaId, cells] of cellsByArea) {
      const actors = placements.filter(placement => placement.roaming?.areaId === areaId).length;
      if (actors && cells / actors < 6) diagnostics.push(diagnostic('invalidData', 'warning', areaId, `Alta densidad: ${actors} actores comparten ${cells} celdas navegables.`));
    }
  }
  for (const message of validationErrors) {
    if (/duplicad[oa]s?/i.test(message)) continue;
    const sourceId = message.split(': ').at(0) ?? bundle.adventure.mapId;
    const category = /inexistente|ausente|referencia|no declarado/i.test(message) ? 'brokenReference' : 'invalidData';
    diagnostics.push(diagnostic(category, 'error', sourceId, message));
  }
  return [...new Map(diagnostics.map(item => [item.diagnosticId, item])).values()];
}
