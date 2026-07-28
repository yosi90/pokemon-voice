export interface PokeDiscoverPathPoint {
  x: number;
  y: number;
}

export function snapPokeDiscoverPathPoint(
  point: PokeDiscoverPathPoint,
  origin: PokeDiscoverPathPoint,
  tileSize = 16,
) {
  return {
    x: origin.x + Math.round((point.x - origin.x) / tileSize) * tileSize,
    y: origin.y + Math.round((point.y - origin.y) / tileSize) * tileSize,
  };
}

function appendPoint(
  points: PokeDiscoverPathPoint[],
  point: PokeDiscoverPathPoint,
) {
  const current = points.at(-1);
  if (current?.x === point.x && current.y === point.y) return points;
  const previous = points.at(-2);
  if (previous?.x === point.x && previous.y === point.y) return points.slice(0, -1);
  return [...points, point];
}

export function extendPokeDiscoverOrthogonalPath(
  points: PokeDiscoverPathPoint[],
  rawPoint: PokeDiscoverPathPoint,
  origin: PokeDiscoverPathPoint,
  tileSize = 16,
) {
  const target = snapPokeDiscoverPathPoint(rawPoint, origin, tileSize);
  const current = points.at(-1) ?? origin;
  if (target.x === current.x || target.y === current.y) {
    return appendPoint(points, target);
  }
  const horizontalElbow = { x: target.x, y: current.y };
  const verticalElbow = { x: current.x, y: target.y };
  const horizontalDistance = Math.hypot(
    rawPoint.x - horizontalElbow.x,
    rawPoint.y - horizontalElbow.y,
  );
  const verticalDistance = Math.hypot(
    rawPoint.x - verticalElbow.x,
    rawPoint.y - verticalElbow.y,
  );
  const lastDirection = points.length > 1
    ? {
      x: current.x - points[points.length - 2].x,
      y: current.y - points[points.length - 2].y,
    }
    : undefined;
  const horizontalFirst = horizontalDistance < verticalDistance
    || (horizontalDistance === verticalDistance && (lastDirection?.x !== 0 || !lastDirection));
  const elbow = horizontalFirst ? horizontalElbow : verticalElbow;
  return appendPoint(appendPoint(points, elbow), target);
}

export function simplifyPokeDiscoverOrthogonalPath(points: PokeDiscoverPathPoint[]) {
  return points.filter((point, index) => {
    if (index === 0 || index === points.length - 1) return true;
    const previous = points[index - 1];
    const next = points[index + 1];
    return !((previous.x === point.x && point.x === next.x)
      || (previous.y === point.y && point.y === next.y));
  });
}

export function connectPokeDiscoverOrthogonalPath(
  start: PokeDiscoverPathPoint,
  points: readonly PokeDiscoverPathPoint[],
) {
  const first = points[0];
  if (!first) return [start];
  if (first.x === start.x && first.y === start.y) return [...points];
  if (first.x === start.x || first.y === start.y) return [start, ...points];
  return [start, { x: first.x, y: start.y }, ...points];
}
