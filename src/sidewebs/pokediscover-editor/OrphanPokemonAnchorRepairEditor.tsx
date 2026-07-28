import { useEffect, useMemo, useState } from 'react';
import type { LoadedAdventureMapBundle } from '../../domain/maps/loadAdventureBundle.js';
import type { PokeDiscoverAuthoringIssue } from '../../domain/tools/pokeDiscoverEditorAuthoringAudit.js';
import { prepareOrphanPokemonAnchorRepair } from '../../domain/tools/pokeDiscoverOrphanAnchorRepair.js';
import { inferPokemonAssetsFromAnchorName } from '../../domain/tools/pokeDiscoverRosterInference.js';
import type { PokeDiscoverWorkspaceSnapshot } from '../../domain/tools/pokeDiscoverEditorWorkspace.js';
import { PmdAnimationPreview } from './PmdAnimationPreview.js';

function pokemonName(assetId: string) {
  return assetId.split(':')[1]?.replace(/^\d+-/u, '')
    .split('-')
    .map(word => word.charAt(0).toLocaleUpperCase('es') + word.slice(1))
    .join(' ') ?? assetId;
}

export function OrphanPokemonAnchorRepairEditor({
  snapshot,
  bundle,
  issue,
  onConfirm,
  onError,
}: {
  snapshot: PokeDiscoverWorkspaceSnapshot;
  bundle: LoadedAdventureMapBundle;
  issue: PokeDiscoverAuthoringIssue;
  onConfirm: (snapshot: PokeDiscoverWorkspaceSnapshot, placementId: string) => string | undefined;
  onError: (message: string) => void;
}) {
  const matches = inferPokemonAssetsFromAnchorName(
    issue.currentName ?? '',
    bundle.pmdManifest,
  );
  const asset = matches.length === 1 ? matches[0] : undefined;
  const suggestedAnimation = useMemo(() => {
    if (!asset) return '';
    const anchorSegments = (issue.currentName ?? '').toLocaleLowerCase('es').split(':');
    return asset.animations.find(candidate => (
      anchorSegments.includes(candidate.name.toLocaleLowerCase('es'))
    ))?.name
      ?? asset.animations.find(candidate => candidate.name === 'Idle')?.name
      ?? asset.animations[0]?.name
      ?? '';
  }, [asset, issue.currentName]);
  const [animation, setAnimation] = useState(suggestedAnimation);
  const [repairError, setRepairError] = useState('');

  useEffect(() => {
    setAnimation(suggestedAnimation);
    setRepairError('');
  }, [issue.issueId, suggestedAnimation]);

  if (!asset) return <p className="editor-sanitation-no-repair">
    El nombre del ancla no permite identificar un único Pokémon del catálogo.
    Puede eliminarse si realmente no forma parte del mapa.
  </p>;

  const sector = snapshot.adventure.sectors.find(value => value.sectorId === issue.sectorId);
  const belongsToRoster = Boolean(sector?.roster.pokemonAssetIds.includes(asset.assetId));
  const previewAnimation = asset.animations.find(value => value.name === animation)
    ?? asset.animations[0];
  const applyRepair = () => {
    try {
      const repaired = prepareOrphanPokemonAnchorRepair({
        snapshot,
        issue,
        assetId: asset.assetId,
        animation,
      });
      setRepairError(onConfirm(repaired.snapshot, repaired.placementId) ?? '');
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'No se pudo preparar la adaptación.';
      setRepairError(message);
      onError(message);
    }
  };

  return <section className="editor-orphan-pokemon-repair" aria-label="Adaptar ancla Pokémon">
    <header>
      <div>
        <span>Pokémon reconocido</span>
        <strong>{pokemonName(asset.assetId)}</strong>
      </div>
      {previewAnimation ? (
        <PmdAnimationPreview animation={previewAnimation} label={`${pokemonName(asset.assetId)} · ${animation}`} />
      ) : null}
    </header>
    {!belongsToRoster ? <p role="alert">
      Antes de adaptarlo, añade {pokemonName(asset.assetId)} al reparto Pokémon del sector.
    </p> : null}
    <p>
      Se conservará la posición del objeto y se convertirá en una colocación válida del mapa.
      Las escenas, triggers y rutas se configurarán después desde el mapa.
    </p>
    <label>
      <span>Animación inicial</span>
      <select
        aria-label="Animación inicial del Pokémon"
        value={animation}
        onChange={event => {
          setAnimation(event.target.value);
          setRepairError('');
        }}
      >
        {asset.animations.map(candidate => (
          <option key={candidate.name} value={candidate.name}>{candidate.name}</option>
        ))}
      </select>
    </label>
    {repairError ? <p className="editor-orphan-pokemon-repair__error" role="alert">
      {repairError}
    </p> : null}
    <button
      type="button"
      className="is-primary"
      disabled={!belongsToRoster || !animation}
      onClick={applyRepair}
    >
      Corregir y continuar
    </button>
  </section>;
}
