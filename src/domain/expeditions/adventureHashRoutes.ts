export type AdventureHashRoute =
  | { kind: 'pokedex' }
  | { kind: 'pokeDiscover' }
  | { kind: 'mission'; missionId: string }
  | { kind: 'expedition'; mapId: string; roomId: string };

const ROOT_HASH = '#/';
const POKE_DISCOVER_HASH = '#/pokediscover';

function decodeSegment(value: string | undefined) {
  if (!value) return undefined;
  try {
    return decodeURIComponent(value);
  } catch {
    return undefined;
  }
}

export function parseAdventureHashRoute(hash: string): AdventureHashRoute {
  const normalized = hash.startsWith('#') ? hash.slice(1) : hash;
  const segments = normalized.split('/').filter(Boolean);
  if (segments.length === 1 && segments[0] === 'pokediscover') {
    return { kind: 'pokeDiscover' };
  }
  if (segments.length === 2 && segments[0] === 'missions') {
    const missionId = decodeSegment(segments[1]);
    if (missionId) return { kind: 'mission', missionId };
  }
  if (segments.length === 3 && segments[0] === 'expeditions') {
    const mapId = decodeSegment(segments[1]);
    const roomId = decodeSegment(segments[2]);
    if (mapId && roomId) return { kind: 'expedition', mapId, roomId };
  }
  return { kind: 'pokedex' };
}

export function buildPokeDiscoverHash() {
  return POKE_DISCOVER_HASH;
}

export function buildMissionHash(missionId: string) {
  return `#/missions/${encodeURIComponent(missionId)}`;
}

export function buildExpeditionHash(mapId: string, roomId: string) {
  return `#/expeditions/${encodeURIComponent(mapId)}/${encodeURIComponent(roomId)}`;
}

export function replaceWithPokedexRoute() {
  window.history.replaceState(window.history.state, '', `${window.location.pathname}${window.location.search}`);
  return parseAdventureHashRoute(ROOT_HASH);
}
