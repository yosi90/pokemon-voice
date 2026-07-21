export type GridFacing = 'up' | 'down' | 'left' | 'right';

export const CLASSIC_TURN_HOLD_MS = 140;

export interface PressedGridDirection {
  code: string;
  facing: GridFacing;
  startedAt: number;
  facingAtPress: GridFacing;
}

export function pressGridDirection(
  pressed: readonly PressedGridDirection[],
  direction: PressedGridDirection,
) {
  return [...pressed.filter(candidate => candidate.code !== direction.code), direction];
}

export function releaseGridDirection(
  pressed: readonly PressedGridDirection[],
  code: string,
) {
  return pressed.filter(candidate => candidate.code !== code);
}

export function activeGridDirection(pressed: readonly PressedGridDirection[]) {
  return pressed[pressed.length - 1];
}

export function gridStep(point: { x: number; y: number }, facing: GridFacing, tiles = 1) {
  const distance = 16 * tiles;
  if (facing === 'left') return { x: point.x - distance, y: point.y };
  if (facing === 'right') return { x: point.x + distance, y: point.y };
  if (facing === 'up') return { x: point.x, y: point.y - distance };
  return { x: point.x, y: point.y + distance };
}

export function canStartClassicStep({
  facing,
  requestedFacing,
  heldForMs,
  chainingStep = false,
}: {
  facing: GridFacing;
  requestedFacing: GridFacing;
  heldForMs: number;
  chainingStep?: boolean;
}) {
  return chainingStep || facing === requestedFacing || heldForMs >= CLASSIC_TURN_HOLD_MS;
}

export function facingFromDelta(dx: number, dy: number, fallback: GridFacing): GridFacing {
  if (Math.abs(dx) >= Math.abs(dy) && dx !== 0) return dx < 0 ? 'left' : 'right';
  if (dy !== 0) return dy < 0 ? 'up' : 'down';
  return fallback;
}

export function findGridPath({
  from,
  to,
  canOccupy,
  maxVisited = 2_000,
}: {
  from: { x: number; y: number };
  to: { x: number; y: number };
  canOccupy: (x: number, y: number) => boolean;
  maxVisited?: number;
}) {
  const key = (point: { x: number; y: number }) => `${point.x},${point.y}`;
  const start = { x: from.x, y: from.y };
  const queue = [start];
  const parents = new Map<string, { x: number; y: number } | undefined>([[key(start), undefined]]);
  for (let cursor = 0; cursor < queue.length && cursor < maxVisited; cursor += 1) {
    const current = queue[cursor];
    if (current.x === to.x && current.y === to.y) {
      const path = [current];
      let parent = parents.get(key(current));
      while (parent) {
        path.push(parent);
        parent = parents.get(key(parent));
      }
      return path.reverse();
    }
    for (const facing of ['up', 'left', 'right', 'down'] as const) {
      const next = gridStep(current, facing);
      const nextKey = key(next);
      if (parents.has(nextKey) || !canOccupy(next.x, next.y)) continue;
      parents.set(nextKey, current);
      queue.push(next);
    }
  }
  return [];
}
