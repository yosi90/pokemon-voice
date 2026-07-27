export interface PokeDiscoverCameraPoint {
  x: number;
  y: number;
}

export function clampPokeDiscoverCameraZoom(
  value: number,
  minimum: number,
  maximum: number,
) {
  return Math.min(maximum, Math.max(minimum, value));
}

export function centerPokeDiscoverCamera({
  viewportWidth,
  viewportHeight,
  contentWidth,
  contentHeight,
  zoom,
}: {
  viewportWidth: number;
  viewportHeight: number;
  contentWidth: number;
  contentHeight: number;
  zoom: number;
}): PokeDiscoverCameraPoint {
  return {
    x: (viewportWidth - contentWidth * zoom) / 2,
    y: (viewportHeight - contentHeight * zoom) / 2,
  };
}

export function zoomPokeDiscoverCameraAtPoint({
  offset,
  currentZoom,
  nextZoom,
  focalPoint,
}: {
  offset: PokeDiscoverCameraPoint;
  currentZoom: number;
  nextZoom: number;
  focalPoint: PokeDiscoverCameraPoint;
}): PokeDiscoverCameraPoint {
  return {
    x: focalPoint.x - ((focalPoint.x - offset.x) / currentZoom) * nextZoom,
    y: focalPoint.y - ((focalPoint.y - offset.y) / currentZoom) * nextZoom,
  };
}

export function readPokeDiscoverCameraZoom(
  storageKey: string,
  fallback: number,
  minimum: number,
  maximum: number,
) {
  if (typeof window === 'undefined') return fallback;
  const stored = Number(window.localStorage.getItem(storageKey));
  return Number.isFinite(stored) && stored > 0
    ? clampPokeDiscoverCameraZoom(stored, minimum, maximum)
    : fallback;
}

export function writePokeDiscoverCameraZoom(storageKey: string, zoom: number) {
  if (typeof window !== 'undefined') window.localStorage.setItem(storageKey, String(zoom));
}
