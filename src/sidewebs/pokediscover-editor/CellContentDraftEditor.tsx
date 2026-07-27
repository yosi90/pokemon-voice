import { useMemo, useState } from 'react';
import type { LoadedAdventureMapBundle } from '../../domain/maps/loadAdventureBundle.js';

export type PokeDiscoverCellContentKind = 'pokemon' | 'npc' | 'interaction' | 'secret';

export function CellContentDraftEditor({
  bundle,
  kind,
  x,
  y,
  onConfirm,
  onCancel,
}: {
  bundle: LoadedAdventureMapBundle;
  kind: PokeDiscoverCellContentKind;
  x: number;
  y: number;
  onConfirm: (value: { assetId?: string; animation?: string; prompt?: string }) => void;
  onCancel: () => void;
}) {
  const assets = useMemo(() => kind === 'pokemon'
    ? bundle.pmdManifest.assets
    : kind === 'npc'
      ? bundle.characterManifest.assets.filter(asset => asset.role === 'npc')
      : [], [bundle, kind]);
  const [assetId, setAssetId] = useState(assets[0]?.assetId ?? '');
  const selectedPokemon = kind === 'pokemon'
    ? bundle.pmdManifest.assets.find(asset => asset.assetId === assetId)
    : undefined;
  const [animation, setAnimation] = useState(
    selectedPokemon?.animations.find(candidate => candidate.name === 'Idle')?.name
      ?? selectedPokemon?.animations[0]?.name
      ?? '',
  );
  const [prompt, setPrompt] = useState(kind === 'secret' ? 'Investigar el secreto' : 'Interactuar');
  const title = kind === 'pokemon'
    ? 'Nuevo Pokémon'
    : kind === 'npc'
      ? 'Nuevo personaje'
      : kind === 'secret'
        ? 'Nuevo secreto'
        : 'Nueva interacción';
  return <section className="editor-cell-draft" aria-label={title}>
    <header><div><span>Borrador en {x}, {y}</span><strong>{title}</strong></div><button type="button" aria-label="Cancelar creación" onClick={onCancel}>×</button></header>
    {(kind === 'pokemon' || kind === 'npc') ? <label><span>Recurso</span><select value={assetId} onChange={event => {
      setAssetId(event.target.value);
      if (kind === 'pokemon') {
        const asset = bundle.pmdManifest.assets.find(candidate => candidate.assetId === event.target.value);
        setAnimation(asset?.animations.find(candidate => candidate.name === 'Idle')?.name ?? asset?.animations[0]?.name ?? '');
      }
    }}>
      {assets.map(asset => <option key={asset.assetId} value={asset.assetId}>{asset.assetId}</option>)}
    </select></label> : null}
    {kind === 'pokemon' ? <label><span>Animación inicial</span><select value={animation} onChange={event => setAnimation(event.target.value)}>
      {selectedPokemon?.animations.map(candidate => <option key={candidate.name}>{candidate.name}</option>)}
    </select></label> : null}
    {(kind === 'interaction' || kind === 'secret') ? <label><span>Texto de acción</span><input value={prompt} onChange={event => setPrompt(event.target.value)} /></label> : null}
    <p>Se crearán conjuntamente la posición del TMJ y su contenido.</p>
    <div className="editor-cell-draft__actions">
      <button type="button" className="is-secondary" onClick={onCancel}>Cancelar</button>
      <button type="button" disabled={(kind === 'pokemon' || kind === 'npc') && !assetId} onClick={() => onConfirm({
        assetId: assetId || undefined,
        animation: animation || undefined,
        prompt: prompt.trim() || undefined,
      })}>Crear</button>
    </div>
  </section>;
}
