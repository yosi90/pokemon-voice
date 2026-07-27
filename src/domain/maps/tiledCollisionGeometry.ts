export interface CollisionRectangle {
  kind: 'rectangle';
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CollisionPolygon {
  kind: 'polygon';
  points: Array<{ x: number; y: number }>;
}

export type TiledCollisionShape = CollisionRectangle | CollisionPolygon;

type Point = { x: number; y: number };
type Rectangle = { x: number; y: number; width: number; height: number };

function pointInRectangle(point: Point, rectangle: Rectangle) {
  return point.x >= rectangle.x
    && point.x <= rectangle.x + rectangle.width
    && point.y >= rectangle.y
    && point.y <= rectangle.y + rectangle.height;
}

function pointInPolygon(point: Point, polygon: Point[]) {
  let inside = false;
  for (let current = 0, previous = polygon.length - 1; current < polygon.length; previous = current++) {
    const a = polygon[current];
    const b = polygon[previous];
    const intersects = ((a.y > point.y) !== (b.y > point.y))
      && point.x < (b.x - a.x) * (point.y - a.y) / ((b.y - a.y) || Number.EPSILON) + a.x;
    if (intersects) inside = !inside;
  }
  return inside;
}

function orientation(a: Point, b: Point, c: Point) {
  const value = (b.y - a.y) * (c.x - b.x) - (b.x - a.x) * (c.y - b.y);
  if (Math.abs(value) < 1e-9) return 0;
  return value > 0 ? 1 : 2;
}

function onSegment(a: Point, b: Point, c: Point) {
  return b.x <= Math.max(a.x, c.x)
    && b.x >= Math.min(a.x, c.x)
    && b.y <= Math.max(a.y, c.y)
    && b.y >= Math.min(a.y, c.y);
}

function segmentsIntersect(a: Point, b: Point, c: Point, d: Point) {
  const o1 = orientation(a, b, c);
  const o2 = orientation(a, b, d);
  const o3 = orientation(c, d, a);
  const o4 = orientation(c, d, b);
  if (o1 !== o2 && o3 !== o4) return true;
  if (o1 === 0 && onSegment(a, c, b)) return true;
  if (o2 === 0 && onSegment(a, d, b)) return true;
  if (o3 === 0 && onSegment(c, a, d)) return true;
  return o4 === 0 && onSegment(c, b, d);
}

export function rectangleOverlapsCollision(
  rectangle: Rectangle,
  collision: TiledCollisionShape,
) {
  if (collision.kind === 'rectangle') {
    return rectangle.x < collision.x + collision.width
      && rectangle.x + rectangle.width > collision.x
      && rectangle.y < collision.y + collision.height
      && rectangle.y + rectangle.height > collision.y;
  }
  const polygon = collision.points;
  if (polygon.length < 3) return false;
  if (polygon.some(point => pointInRectangle(point, rectangle))) return true;
  const corners = [
    { x: rectangle.x, y: rectangle.y },
    { x: rectangle.x + rectangle.width, y: rectangle.y },
    { x: rectangle.x + rectangle.width, y: rectangle.y + rectangle.height },
    { x: rectangle.x, y: rectangle.y + rectangle.height },
  ];
  if (corners.some(point => pointInPolygon(point, polygon))) return true;
  for (let polygonIndex = 0; polygonIndex < polygon.length; polygonIndex += 1) {
    const polygonStart = polygon[polygonIndex];
    const polygonEnd = polygon[(polygonIndex + 1) % polygon.length];
    for (let rectangleIndex = 0; rectangleIndex < corners.length; rectangleIndex += 1) {
      const rectangleStart = corners[rectangleIndex];
      const rectangleEnd = corners[(rectangleIndex + 1) % corners.length];
      if (segmentsIntersect(polygonStart, polygonEnd, rectangleStart, rectangleEnd)) return true;
    }
  }
  return false;
}

export function readTiledCollisionShape(
  object: Record<string, unknown>,
): TiledCollisionShape | undefined {
  const originX = Number(object.x) || 0;
  const originY = Number(object.y) || 0;
  if (Array.isArray(object.polygon) && object.polygon.length >= 3) {
    return {
      kind: 'polygon',
      points: (object.polygon as Array<Record<string, unknown>>).map(point => (
        transformTiledObjectPoint(object, {
          x: Number(point.x) || 0,
          y: Number(point.y) || 0,
        })
      )),
    };
  }
  const width = Number(object.width) || 0;
  const height = Number(object.height) || 0;
  if (width <= 0 || height <= 0) return undefined;
  if (Number(object.rotation) || 0) {
    return { kind: 'polygon', points: tiledObjectRectanglePoints(object) };
  }
  return { kind: 'rectangle', x: originX, y: originY, width, height };
}
import {
  tiledObjectRectanglePoints,
  transformTiledObjectPoint,
} from './tiledObjectTransform.js';
