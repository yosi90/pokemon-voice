import type { MouseEvent } from 'react';
import './tool-navigation.css';

export type PokeDiscoverToolId = 'editor' | 'visualNovel' | 'randomizer';

export const POKEDISCOVER_TOOLS: ReadonlyArray<{
  id: PokeDiscoverToolId;
  label: string;
  directory: string;
}> = Object.freeze([
  { id: 'editor', label: 'Mapas y misiones', directory: 'pokediscover-editor' },
  { id: 'visualNovel', label: 'Novela visual', directory: 'visual-novel-editor' },
  { id: 'randomizer', label: 'Randomizador', directory: 'pokediscover-randomizer' },
]);

export function resolvePokeDiscoverToolUrl(
  toolId: PokeDiscoverToolId,
  currentUrl = window.location.href,
) {
  const tool = POKEDISCOVER_TOOLS.find(candidate => candidate.id === toolId);
  if (!tool) throw new Error(`Herramienta desconocida: ${toolId}.`);
  return new URL(`../${tool.directory}/`, currentUrl).href;
}

export function ToolNavigation({
  current,
  onNavigate,
}: {
  current: PokeDiscoverToolId;
  onNavigate?: (url: string) => boolean | void | Promise<boolean | void>;
}) {
  const navigate = async (
    event: MouseEvent<HTMLAnchorElement>,
    toolId: PokeDiscoverToolId,
  ) => {
    const url = resolvePokeDiscoverToolUrl(toolId);
    if (!onNavigate) return;
    event.preventDefault();
    const allowed = await onNavigate(url);
    if (allowed !== false) window.location.assign(url);
  };
  return <nav className="tool-navigation" aria-label="Herramientas PokeDiscover">
    <span>Herramientas</span>
    {POKEDISCOVER_TOOLS.map(tool => tool.id === current
      ? <span key={tool.id} className="tool-navigation__current" aria-current="page">{tool.label}</span>
      : <a
          key={tool.id}
          href={resolvePokeDiscoverToolUrl(tool.id)}
          onClick={event => void navigate(event, tool.id)}
        >{tool.label}</a>)}
  </nav>;
}
