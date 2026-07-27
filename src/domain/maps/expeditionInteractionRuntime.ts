import type { ExpeditionInteractionV3 } from '../../../packages/contracts/src/index.js';

export type InteractionFacing = 'up' | 'down' | 'left' | 'right';

export interface InteractionGroundPoint {
  x: number;
  y: number;
}

export interface RuntimeInteractionTarget extends InteractionGroundPoint {
  placementId?: string;
  anchorId?: string;
}

export interface SpatialFacingDefinition {
  sectorId: string;
  target: ExpeditionInteractionV3['target'];
  rangeTiles?: number;
}

const FACING_DELTAS: Readonly<Record<InteractionFacing, InteractionGroundPoint>> = Object.freeze({
  up: { x: 0, y: -16 },
  down: { x: 0, y: 16 },
  left: { x: -16, y: 0 },
  right: { x: 16, y: 0 },
});

export function interactionPointInFront(
  player: InteractionGroundPoint,
  facing: InteractionFacing,
  rangeTiles = 1,
) {
  const delta = FACING_DELTAS[facing];
  return {
    x: player.x + delta.x * rangeTiles,
    y: player.y + delta.y * rangeTiles,
  };
}

export function findFacingSpatialDefinition<T extends SpatialFacingDefinition>({
  definitions,
  sectorId,
  player,
  facing,
  resolveTarget,
}: {
  definitions: readonly T[];
  sectorId: string;
  player: InteractionGroundPoint;
  facing: InteractionFacing;
  resolveTarget: (definition: T) => RuntimeInteractionTarget | undefined;
}) {
  for (const definition of definitions) {
    if (definition.sectorId !== sectorId) continue;
    const target = resolveTarget(definition);
    if (!target) continue;
    const expected = interactionPointInFront(player, facing, definition.rangeTiles ?? 1);
    if (Math.abs(target.x - expected.x) <= 8 && Math.abs(target.y - expected.y) <= 8) return definition;
  }
  return undefined;
}

export function findFacingInteraction(request: {
  interactions: readonly ExpeditionInteractionV3[];
  sectorId: string;
  player: InteractionGroundPoint;
  facing: InteractionFacing;
  resolveTarget: (interaction: ExpeditionInteractionV3) => RuntimeInteractionTarget | undefined;
}) {
  return findFacingSpatialDefinition({
    definitions: request.interactions,
    sectorId: request.sectorId,
    player: request.player,
    facing: request.facing,
    resolveTarget: request.resolveTarget,
  });
}

export function facingTowardTarget(player: InteractionGroundPoint, target: InteractionGroundPoint): InteractionFacing {
  const horizontal = target.x - player.x;
  const vertical = target.y - player.y;
  if (Math.abs(horizontal) > Math.abs(vertical)) return horizontal < 0 ? 'left' : 'right';
  return vertical < 0 ? 'up' : 'down';
}
