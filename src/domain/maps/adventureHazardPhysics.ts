export interface PhysicsPoint {
  x: number;
  y: number;
}

export interface PhysicsBounds extends PhysicsPoint {
  width: number;
  height: number;
}

/**
 * Intersección de un segmento contra AABB expandido por el radio/huella del
 * proyectil. Evita atravesar al jugador entre dos frames.
 */
export function sweptPointHitsBounds(
  from: PhysicsPoint,
  to: PhysicsPoint,
  target: PhysicsBounds,
  projectileWidth = 0,
  projectileHeight = projectileWidth,
) {
  const minimumX = target.x - projectileWidth / 2;
  const maximumX = target.x + target.width + projectileWidth / 2;
  const minimumY = target.y - projectileHeight / 2;
  const maximumY = target.y + target.height + projectileHeight / 2;
  const deltaX = to.x - from.x;
  const deltaY = to.y - from.y;
  let minimumTime = 0;
  let maximumTime = 1;
  for (const [origin, delta, minimum, maximum] of [
    [from.x, deltaX, minimumX, maximumX],
    [from.y, deltaY, minimumY, maximumY],
  ]) {
    if (Math.abs(delta) < Number.EPSILON) {
      if (origin < minimum || origin > maximum) return false;
      continue;
    }
    const inverse = 1 / delta;
    let near = (minimum - origin) * inverse;
    let far = (maximum - origin) * inverse;
    if (near > far) [near, far] = [far, near];
    minimumTime = Math.max(minimumTime, near);
    maximumTime = Math.min(maximumTime, far);
    if (minimumTime > maximumTime) return false;
  }
  return true;
}

export function lockedChargeDestination(
  source: PhysicsPoint,
  target: PhysicsPoint,
  maximumDistance: number,
) {
  const deltaX = target.x - source.x;
  const deltaY = target.y - source.y;
  const distance = Math.hypot(deltaX, deltaY);
  if (distance <= Number.EPSILON) return { ...source };
  const travel = Math.min(distance, Math.max(0, maximumDistance));
  return {
    x: source.x + deltaX / distance * travel,
    y: source.y + deltaY / distance * travel,
  };
}

export interface PausableIntervalState {
  elapsedMs: number;
  nextAtMs: number;
}

export function advancePausableInterval(
  state: PausableIntervalState,
  deltaMs: number,
  intervalMs: number,
  paused: boolean,
) {
  if (paused) return { state, fired: false };
  const elapsedMs = state.elapsedMs + Math.max(0, deltaMs);
  if (elapsedMs < state.nextAtMs) {
    return { state: { ...state, elapsedMs }, fired: false };
  }
  return {
    state: {
      elapsedMs,
      nextAtMs: state.nextAtMs + Math.max(1, intervalMs),
    },
    fired: true,
  };
}
