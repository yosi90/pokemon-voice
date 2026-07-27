export interface TiledPoint {
  x: number;
  y: number;
}

export interface TiledObjectTransform {
  x?: unknown;
  y?: unknown;
  rotation?: unknown;
}

export interface TiledTileTransform {
  rotation: number;
  scaleX: 1 | -1;
  scaleY: 1 | -1;
}

export const TILED_FLIP_HORIZONTAL_FLAG = 0x80000000;
export const TILED_FLIP_VERTICAL_FLAG = 0x40000000;
export const TILED_FLIP_DIAGONAL_FLAG = 0x20000000;
export const TILED_HEXAGONAL_ROTATION_FLAG = 0x10000000;
export const TILED_GID_MASK = 0x0fffffff;

export function transformTiledObjectPoint(
  object: TiledObjectTransform,
  point: TiledPoint,
): TiledPoint {
  const originX = Number(object.x) || 0;
  const originY = Number(object.y) || 0;
  const radians = (Number(object.rotation) || 0) * Math.PI / 180;
  if (!radians) return { x: originX + point.x, y: originY + point.y };
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return {
    x: originX + point.x * cosine - point.y * sine,
    y: originY + point.x * sine + point.y * cosine,
  };
}

export function tiledObjectRectanglePoints(
  object: TiledObjectTransform & { width?: unknown; height?: unknown },
): TiledPoint[] {
  const width = Number(object.width) || 0;
  const height = Number(object.height) || 0;
  return [
    transformTiledObjectPoint(object, { x: 0, y: 0 }),
    transformTiledObjectPoint(object, { x: width, y: 0 }),
    transformTiledObjectPoint(object, { x: width, y: height }),
    transformTiledObjectPoint(object, { x: 0, y: height }),
  ];
}

/**
 * Tiled applies the diagonal (anti-diagonal) flip before the horizontal and
 * vertical flags. These equivalent canvas operations cover the eight
 * orthogonal combinations while keeping the tile centered.
 */
export function readTiledTileTransform(encodedGid: number): TiledTileTransform {
  const gid = encodedGid >>> 0;
  const horizontal = Boolean(gid & TILED_FLIP_HORIZONTAL_FLAG);
  const vertical = Boolean(gid & TILED_FLIP_VERTICAL_FLAG);
  const diagonal = Boolean(gid & TILED_FLIP_DIAGONAL_FLAG);
  if (!diagonal) {
    return {
      rotation: 0,
      scaleX: horizontal ? -1 : 1,
      scaleY: vertical ? -1 : 1,
    };
  }
  if (horizontal && vertical) return { rotation: Math.PI / 2, scaleX: -1, scaleY: 1 };
  if (horizontal) return { rotation: Math.PI / 2, scaleX: 1, scaleY: 1 };
  if (vertical) return { rotation: -Math.PI / 2, scaleX: 1, scaleY: 1 };
  return { rotation: Math.PI / 2, scaleX: 1, scaleY: -1 };
}
