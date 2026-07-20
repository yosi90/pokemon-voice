import type { ExpeditionInteractionV1 } from '../../../packages/contracts/src/index.js';

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
  roomId: string;
  target: ExpeditionInteractionV1['target'];
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
  roomId,
  player,
  facing,
  resolveTarget,
}: {
  definitions: readonly T[];
  roomId: string;
  player: InteractionGroundPoint;
  facing: InteractionFacing;
  resolveTarget: (definition: T) => RuntimeInteractionTarget | undefined;
}) {
  for (const definition of definitions) {
    if (definition.roomId !== roomId) continue;
    const target = resolveTarget(definition);
    if (!target) continue;
    const expected = interactionPointInFront(player, facing, definition.rangeTiles ?? 1);
    if (Math.abs(target.x - expected.x) <= 8 && Math.abs(target.y - expected.y) <= 8) return definition;
  }
  return undefined;
}

export function findFacingInteraction(request: {
  interactions: readonly ExpeditionInteractionV1[];
  roomId: string;
  player: InteractionGroundPoint;
  facing: InteractionFacing;
  resolveTarget: (interaction: ExpeditionInteractionV1) => RuntimeInteractionTarget | undefined;
}) {
  return findFacingSpatialDefinition({
    definitions: request.interactions,
    roomId: request.roomId,
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
