import { useMemo, useState } from 'react';
import {
  MEANINGFUL_EXPEDITION_INTERACTION_KINDS,
  type MeaningfulExpeditionInteractionKind,
} from '../../../packages/contracts/src/index.js';
import type { LoadedAdventureMapBundle } from '../../domain/maps/loadAdventureBundle.js';
import {
  previewPokeDiscoverImmediateRecipeIds,
  type PokeDiscoverImmediateRecipeRequest,
} from '../../domain/tools/pokeDiscoverEditorAuthoringRegistry.js';
import type { PokeDiscoverEditableTiledMap } from '../../domain/tools/pokeDiscoverEditorProject.js';

export type PokeDiscoverCellContentKind =
  | 'pokemon'
  | 'npc'
  | 'interaction'
  | 'secret'
  | 'entry';

const INTERACTION_LABELS: Record<MeaningfulExpeditionInteractionKind, string> = {
  npcConversation: 'Conversación con NPC',
  inspection: 'Inspección',
  pokemonInteraction: 'Interacción Pokémon',
  speciesIdentification: 'Identificación de especie',
  companionBehavior: 'Comportamiento del compañero',
  contextTrigger: 'Acción contextual',
  secret: 'Secreto',
  hint: 'Pista',
  collectible: 'Coleccionable',
  research: 'Investigación',
};

function initialRecipe(kind: PokeDiscoverCellContentKind): PokeDiscoverImmediateRecipeRequest['recipeId'] {
  if (kind === 'pokemon') return 'pokemon-placement';
  if (kind === 'npc') return 'npc-placement';
  if (kind === 'entry') return 'entry-point';
  if (kind === 'secret') return 'secret';
  return 'interaction';
}

export interface PokeDiscoverCellWizardValue {
  recipeId: PokeDiscoverImmediateRecipeRequest['recipeId'];
  assetId?: string;
  animation?: string;
  meaningfulKind: MeaningfulExpeditionInteractionKind;
  prompt: string;
  text: string;
  label: string;
}

export function CellContentDraftEditor({
  bundle,
  tilemap,
  sectorId,
  kind,
  x,
  y,
  onConfirm,
  onCancel,
}: {
  bundle: LoadedAdventureMapBundle;
  tilemap: PokeDiscoverEditableTiledMap;
  sectorId: string;
  kind: PokeDiscoverCellContentKind;
  x: number;
  y: number;
  onConfirm: (value: PokeDiscoverCellWizardValue) => void;
  onCancel: () => void;
}) {
  const sector = bundle.adventure.sectors.find(candidate => candidate.sectorId === sectorId);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [recipeId, setRecipeId] = useState<PokeDiscoverImmediateRecipeRequest['recipeId']>(
    initialRecipe(kind),
  );
  const assets = useMemo(() => recipeId === 'pokemon-placement' || recipeId === 'pokemon-encounter'
    ? bundle.pmdManifest.assets.filter(asset => sector?.roster.pokemonAssetIds.includes(asset.assetId))
    : recipeId === 'npc-placement'
      ? bundle.characterManifest.assets.filter(asset => (
        asset.role === 'npc' && sector?.roster.npcAssetIds.includes(asset.assetId)
      ))
      : [], [bundle, recipeId, sector]);
  const [assetId, setAssetId] = useState(assets[0]?.assetId ?? '');
  const selectedPokemon = bundle.pmdManifest.assets.find(asset => asset.assetId === assetId);
  const [animation, setAnimation] = useState(
    selectedPokemon?.animations.find(candidate => candidate.name === 'Idle')?.name
      ?? selectedPokemon?.animations[0]?.name
      ?? 'Idle',
  );
  const [meaningfulKind, setMeaningfulKind] = useState<MeaningfulExpeditionInteractionKind>(
    kind === 'secret' ? 'secret' : 'contextTrigger',
  );
  const [prompt, setPrompt] = useState(kind === 'secret' ? 'Investigar el secreto' : 'Interactuar');
  const [text, setText] = useState('Contenido pendiente de configurar.');
  const [label, setLabel] = useState('Entrada principal');
  const preview = previewPokeDiscoverImmediateRecipeIds(bundle.adventure, tilemap, recipeId);
  const needsAsset = ['pokemon-placement', 'pokemon-encounter', 'npc-placement'].includes(recipeId);
  const validStepTwo = !needsAsset || Boolean(assetId);

  return <section className="editor-cell-draft" aria-label="Asistente de creación">
    <header>
      <div><span>Borrador fuera del mapa · {x}, {y}</span><strong>Crear construcción funcional</strong></div>
      <button type="button" aria-label="Cancelar creación" onClick={onCancel}>×</button>
    </header>
    <p>Paso {step} de 3. Nada se añadirá al TMJ ni al sidecar hasta confirmar.</p>

    {step === 1 ? <>
      <label><span>Construcción comprendida por el sidecar</span><select value={recipeId} onChange={event => {
        const next = event.target.value as PokeDiscoverImmediateRecipeRequest['recipeId'];
        setRecipeId(next);
        const nextAssets = next === 'pokemon-placement' || next === 'pokemon-encounter'
          ? bundle.pmdManifest.assets.filter(asset => sector?.roster.pokemonAssetIds.includes(asset.assetId))
          : next === 'npc-placement'
            ? bundle.characterManifest.assets.filter(asset => asset.role === 'npc'
              && sector?.roster.npcAssetIds.includes(asset.assetId))
            : [];
        setAssetId(nextAssets[0]?.assetId ?? '');
      }}>
        {kind === 'pokemon' ? <>
          <option value="pokemon-placement">Colocación Pokémon</option>
          <option value="pokemon-encounter">Encuentro Pokémon</option>
        </> : null}
        {kind === 'npc' ? <option value="npc-placement">Colocación NPC</option> : null}
        {kind === 'entry' ? <option value="entry-point">Entrada del jugador</option> : null}
        {kind === 'interaction' ? <option value="interaction">Interacción</option> : null}
        {kind === 'secret' ? <option value="secret">Secreto</option> : null}
      </select></label>
      <p>La clase técnica del ancla se derivará de esta receta y no puede elegirse manualmente.</p>
    </> : null}

    {step === 2 ? <>
      {needsAsset ? <label><span>Integrante del reparto del sector</span><select value={assetId} onChange={event => {
        setAssetId(event.target.value);
        const asset = bundle.pmdManifest.assets.find(candidate => candidate.assetId === event.target.value);
        setAnimation(asset?.animations.find(candidate => candidate.name === 'Idle')?.name
          ?? asset?.animations[0]?.name
          ?? 'Idle');
      }}>
        {assets.map(asset => <option key={asset.assetId} value={asset.assetId}>{asset.assetId}</option>)}
      </select></label> : null}
      {(recipeId === 'pokemon-placement' || recipeId === 'pokemon-encounter') ? <label>
        <span>Acción inicial soportada</span>
        <select value={animation} onChange={event => setAnimation(event.target.value)}>
          {selectedPokemon?.animations.map(candidate => (
            <option key={candidate.name} value={candidate.name}>{candidate.name}</option>
          ))}
        </select>
      </label> : null}
      {recipeId === 'interaction' ? <label><span>Acción significativa</span><select
        value={meaningfulKind}
        onChange={event => setMeaningfulKind(event.target.value as MeaningfulExpeditionInteractionKind)}
      >
        {MEANINGFUL_EXPEDITION_INTERACTION_KINDS
          .filter(value => value !== 'secret')
          .map(value => <option key={value} value={value}>{INTERACTION_LABELS[value]}</option>)}
      </select></label> : null}
      {(recipeId === 'interaction' || recipeId === 'secret') ? <>
        <label><span>Texto de acción</span><input value={prompt} onChange={event => setPrompt(event.target.value)} /></label>
        <label><span>Texto inicial</span><textarea value={text} onChange={event => setText(event.target.value)} /></label>
      </> : null}
      {recipeId === 'entry-point' ? <label><span>Nombre visible</span><input value={label} onChange={event => setLabel(event.target.value)} /></label> : null}
      {needsAsset && !assets.length ? <p role="alert">El reparto del sector no contiene recursos compatibles.</p> : null}
    </> : null}

    {step === 3 ? <dl>
      <dt>ID sidecar</dt><dd>{preview.primaryId}</dd>
      <dt>Nombre TMJ</dt><dd>{preview.anchorId}</dd>
      {preview.dialogueId ? <><dt>Diálogo</dt><dd>{preview.dialogueId}</dd></> : null}
      <dt>Clase derivada</dt><dd>{recipeId === 'entry-point'
        ? 'PlayerSpawn'
        : recipeId === 'npc-placement' || recipeId === 'pokemon-placement'
          ? 'ActorAnchor'
          : recipeId === 'pokemon-encounter'
            ? 'EncounterAnchor'
            : recipeId === 'secret'
              ? 'SecretAnchor'
              : 'InteractionAnchor'}</dd>
    </dl> : null}

    <div className="editor-cell-draft__actions">
      <button type="button" className="is-secondary" onClick={step === 1
        ? onCancel
        : () => setStep((step - 1) as 1 | 2)}>Atrás</button>
      {step < 3 ? <button type="button" disabled={step === 2 && !validStepTwo} onClick={() => setStep(
        (step + 1) as 2 | 3,
      )}>Continuar</button> : <button type="button" disabled={!validStepTwo} onClick={() => onConfirm({
        recipeId,
        assetId: assetId || undefined,
        animation: animation || undefined,
        meaningfulKind: recipeId === 'secret' ? 'secret' : meaningfulKind,
        prompt: prompt.trim(),
        text: text.trim(),
        label: label.trim(),
      })}>Confirmar y crear</button>}
    </div>
  </section>;
}
