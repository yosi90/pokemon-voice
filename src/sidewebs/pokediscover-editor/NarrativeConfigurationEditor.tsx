import { useState } from 'react';
import type {
  AdventureMapV2,
  CompanionBehaviorTriggerV1,
  ExpeditionExpressionTriggerV1,
  ExpressionMatcherV1,
  ResearchFactV1,
} from '../../../packages/contracts/src/index.js';
import {
  getBalancedPokeDiscoverRewards,
  POKE_DISCOVER_REWARD_PACKAGES,
  type BalancedPokeDiscoverReward,
} from '../../data/adventure/rewardBalance.js';
import { nextStableEditorId } from '../../domain/tools/pokeDiscoverEditorBeats.js';
import {
  updateEditorBehaviorTrigger,
  updateEditorExpressionTrigger,
  upsertEditorResearchFact,
} from '../../domain/tools/pokeDiscoverEditorNarrative.js';

const REWARD_KINDS: Array<{ value: BalancedPokeDiscoverReward; label: string }> = [
  { value: 'uniqueObservation', label: 'Observación única' },
  { value: 'mapSecret', label: 'Secreto del mapa' },
  { value: 'specialDiscovery', label: 'Descubrimiento especial' },
  { value: 'companionSecret', label: 'Secreto del compañero' },
];

function commaList(value: string) {
  return value.split(',').map(item => item.trim()).filter(Boolean);
}

function rewardKindFor(rewards: ResearchFactV1['rewards']): BalancedPokeDiscoverReward {
  return REWARD_KINDS.find(candidate => (
    JSON.stringify(getBalancedPokeDiscoverRewards(candidate.value)) === JSON.stringify(rewards)
  ))?.value ?? 'uniqueObservation';
}

function RewardPreview({ rewards }: { rewards: ResearchFactV1['rewards'] }) {
  return <p className="editor-narrative__reward-preview">{rewards.map(reward => (
    reward.kind === 'trainerExperience' ? `${reward.amount} EXP`
      : reward.kind === 'discoveryPoints' ? `${reward.amount} PD`
        : 'contentId' in reward ? reward.contentId : reward.kind
  )).join(' · ') || 'Sin recompensa'}</p>;
}

function IdempotentRewardFields({
  originId,
  packageId,
  onChange,
}: {
  originId?: string;
  packageId?: string;
  onChange: (value: { rewardOriginId?: string; rewardPackageId?: string }) => void;
}) {
  const packageIds = Object.keys(POKE_DISCOVER_REWARD_PACKAGES);
  const rewards = packageId ? POKE_DISCOVER_REWARD_PACKAGES[packageId as keyof typeof POKE_DISCOVER_REWARD_PACKAGES] : [];
  return <fieldset className="editor-narrative__reward">
    <legend>Recompensa única</legend>
    <label><span>Paquete de balance</span><select value={packageId ?? ''} onChange={event => onChange({ rewardOriginId: originId, rewardPackageId: event.target.value || undefined })}>
      <option value="">Sin recompensa</option>{packageIds.map(value => <option key={value}>{value}</option>)}
    </select></label>
    <label><span>Origen idempotente</span><input value={originId ?? ''} disabled={!packageId} onChange={event => onChange({ rewardOriginId: event.target.value, rewardPackageId: packageId })} /></label>
    <RewardPreview rewards={rewards} />
  </fieldset>;
}

function MatcherFields({ matcher, onChange }: { matcher: ExpressionMatcherV1; onChange: (matcher: ExpressionMatcherV1) => void }) {
  if (matcher.kind === 'phrase') return <label><span>Frases, separadas por comas</span><textarea value={matcher.phrases.join(', ')} onChange={event => onChange({ ...matcher, phrases: commaList(event.target.value) })} /></label>;
  if (matcher.kind === 'intent') return <>
    <label><span>Intención</span><select value={matcher.intent} onChange={event => onChange({ ...matcher, intent: event.target.value as typeof matcher.intent })}>{['compliment','calm','warn','sing','custom'].map(value => <option key={value}>{value}</option>)}</select></label>
    <label><span>Ejemplos, separados por comas</span><textarea value={matcher.examples.join(', ')} onChange={event => onChange({ ...matcher, examples: commaList(event.target.value) })} /></label>
  </>;
  return <>
    <label><span>Rasgo acústico</span><select value={matcher.feature} onChange={event => onChange({ ...matcher, feature: event.target.value as typeof matcher.feature })}><option value="loudness">Volumen</option><option value="sustainedNote">Nota sostenida</option><option value="simpleHum">Tarareo</option></select></label>
    <label><span>Duración mínima (ms)</span><input type="number" min="0" value={matcher.minimumDurationMs ?? 0} onChange={event => onChange({ ...matcher, minimumDurationMs: Math.max(0, Number(event.target.value) || 0) })} /></label>
    <label><span>Nivel mínimo (0–1)</span><input type="number" min="0" max="1" step="0.05" value={matcher.minimumLevel ?? 0} onChange={event => onChange({ ...matcher, minimumLevel: Math.min(1, Math.max(0, Number(event.target.value) || 0)) })} /></label>
  </>;
}

export function NarrativeConfigurationEditor({ adventure, onAdventureChange }: { adventure: AdventureMapV2; onAdventureChange: (adventure: AdventureMapV2) => void }) {
  const [tab, setTab] = useState<'research' | 'behavior' | 'expression'>('research');
  const [researchId, setResearchId] = useState('');
  const [behaviorId, setBehaviorId] = useState('');
  const [expressionId, setExpressionId] = useState('');
  const [matcherIndex, setMatcherIndex] = useState(0);
  const facts = adventure.researchFacts ?? [];
  const fact = facts.find(candidate => candidate.factId === researchId) ?? facts[0];
  const behavior = adventure.behaviorTriggers.find(candidate => candidate.triggerId === behaviorId) ?? adventure.behaviorTriggers[0];
  const expression = adventure.expressionTriggers.find(candidate => candidate.triggerId === expressionId) ?? adventure.expressionTriggers[0];
  const matcher = expression?.matchAny[matcherIndex] ?? expression?.matchAny[0];
  const interactions = adventure.interactions ?? [];
  const companionSequences = adventure.companionSequences ?? [];

  const createResearch = () => {
    const interaction = interactions[0];
    if (!interaction) return;
    const factId = nextStableEditorId(`research:${adventure.mapId.split(':').at(-1)}`, facts.map(candidate => candidate.factId));
    const next: ResearchFactV1 = {
      schemaVersion: 1,
      factId,
      speciesId: 1,
      field: 'behavior',
      contribution: 'observation',
      mapId: adventure.mapId,
      interactionId: interaction.interactionId,
      text: 'Describe aquí el descubrimiento de campo.',
      rewards: getBalancedPokeDiscoverRewards('uniqueObservation'),
    };
    onAdventureChange(upsertEditorResearchFact(adventure, next));
    setResearchId(factId);
  };
  const updateFact = (next: ResearchFactV1) => onAdventureChange(upsertEditorResearchFact(adventure, next));
  const updateBehavior = (next: CompanionBehaviorTriggerV1) => onAdventureChange(updateEditorBehaviorTrigger(adventure, next));
  const updateExpression = (next: ExpeditionExpressionTriggerV1) => onAdventureChange(updateEditorExpressionTrigger(adventure, next));
  const updateMatcher = (next: ExpressionMatcherV1) => {
    if (!expression) return;
    updateExpression({ ...expression, matchAny: expression.matchAny.map((candidate, index) => index === matcherIndex ? next : candidate) });
  };

  return <section className="editor-narrative" aria-labelledby="editor-narrative-title">
    <header><div><span className="editor-eyebrow">Contenido PokeDiscover</span><h2 id="editor-narrative-title">Investigación e interacciones</h2></div><span>Recompensas balanceadas</span></header>
    <div className="editor-narrative__tabs" role="tablist" aria-label="Tipo de configuración">
      <button type="button" role="tab" aria-selected={tab === 'research'} onClick={() => setTab('research')}>Investigación</button>
      <button type="button" role="tab" aria-selected={tab === 'behavior'} onClick={() => setTab('behavior')}>Compañante</button>
      <button type="button" role="tab" aria-selected={tab === 'expression'} onClick={() => setTab('expression')}>Expresiva</button>
    </div>

    {tab === 'research' ? <div className="editor-narrative__panel">
      <div className="editor-narrative__selector"><label><span>Hecho de investigación</span><select value={fact?.factId ?? ''} disabled={!fact} onChange={event => setResearchId(event.target.value)}>{facts.map(candidate => <option key={candidate.factId}>{candidate.factId}</option>)}</select></label><button type="button" disabled={!interactions.length} onClick={createResearch}>Añadir investigación</button></div>
      {fact ? <div className="editor-narrative__grid">
        <label><span>Especie #</span><input type="number" min="1" value={fact.speciesId} onChange={event => updateFact({ ...fact, speciesId: Math.max(1, Number(event.target.value) || 1) })} /></label>
        <label><span>Campo</span><select value={fact.field} onChange={event => updateFact({ ...fact, field: event.target.value as typeof fact.field })}><option value="biometrics">Biometría</option><option value="behavior">Conducta</option><option value="habitat">Hábitat</option><option value="exceptional">Excepcional</option></select></label>
        <label><span>Contribución</span><select value={fact.contribution} onChange={event => updateFact({ ...fact, contribution: event.target.value as typeof fact.contribution })}><option value="observation">Observación</option><option value="fieldCompletion">Completa el campo</option><option value="additionalNote">Nota adicional</option></select></label>
        <label><span>Interacción de origen</span><select value={fact.interactionId} onChange={event => updateFact({ ...fact, interactionId: event.target.value })}>{interactions.map(item => <option key={item.interactionId}>{item.interactionId}</option>)}</select></label>
        <label className="is-wide"><span>Texto descubierto</span><textarea value={fact.text} onChange={event => updateFact({ ...fact, text: event.target.value })} /></label>
        <label><span>Balance</span><select value={rewardKindFor(fact.rewards)} onChange={event => updateFact({ ...fact, rewards: getBalancedPokeDiscoverRewards(event.target.value as BalancedPokeDiscoverReward) })}>{REWARD_KINDS.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
        <RewardPreview rewards={fact.rewards} />
        <p className="editor-narrative__origin">Origen único: <strong>{fact.factId}</strong></p>
      </div> : <p className="editor-catalog__empty-field">Añade el primer hecho para comenzar.</p>}
    </div> : null}

    {tab === 'behavior' ? <div className="editor-narrative__panel">
      {behavior ? <>
        <label><span>Comportamiento</span><select value={behavior.triggerId} onChange={event => setBehaviorId(event.target.value)}>{adventure.behaviorTriggers.map(item => <option key={item.triggerId}>{item.triggerId}</option>)}</select></label>
        <div className="editor-narrative__grid">
          <label><span>Modo</span><select value={behavior.mode} onChange={event => updateBehavior({ ...behavior, mode: event.target.value as typeof behavior.mode })}><option value="prompt">Prompt</option><option value="automatic">Automático</option><option value="ambient">Ambiental</option></select></label>
          <label><span>Repetición</span><select value={behavior.repeatPolicy ?? 'oncePerVisit'} onChange={event => updateBehavior({ ...behavior, repeatPolicy: event.target.value as NonNullable<typeof behavior.repeatPolicy> })}><option value="oncePerVisit">Una vez por visita</option><option value="persistent">Persistente</option><option value="repeatable">Repetible</option></select></label>
          <label><span>Secuencia</span><select value={behavior.sequenceId} onChange={event => updateBehavior({ ...behavior, sequenceId: event.target.value })}>{companionSequences.map(item => <option key={item.sequenceId}>{item.sequenceId}</option>)}</select></label>
          <label><span>Acción visible</span><input value={behavior.actionLabel ?? ''} onChange={event => updateBehavior({ ...behavior, actionLabel: event.target.value })} /></label>
          <label className="is-wide"><span>Pista narrativa</span><textarea value={behavior.loreHint ?? ''} onChange={event => updateBehavior({ ...behavior, loreHint: event.target.value })} /></label>
        </div>
        <IdempotentRewardFields originId={behavior.rewardOriginId} packageId={behavior.rewardPackageId} onChange={reward => updateBehavior({ ...behavior, ...reward })} />
      </> : <p className="editor-catalog__empty-field">No hay comportamientos de compañero.</p>}
    </div> : null}

    {tab === 'expression' ? <div className="editor-narrative__panel">
      {expression ? <>
        <label><span>Interacción expresiva</span><select value={expression.triggerId} onChange={event => { setExpressionId(event.target.value); setMatcherIndex(0); }}>{adventure.expressionTriggers.map(item => <option key={item.triggerId}>{item.triggerId}</option>)}</select></label>
        <div className="editor-narrative__grid">
          <label><span>Prompt</span><input value={expression.prompt ?? ''} onChange={event => updateExpression({ ...expression, prompt: event.target.value })} /></label>
          <label><span>Secuencia de éxito</span><select value={expression.successSequenceId} onChange={event => updateExpression({ ...expression, successSequenceId: event.target.value })}>{companionSequences.map(item => <option key={item.sequenceId}>{item.sequenceId}</option>)}</select></label>
          <label className="is-wide"><span>Métodos de entrada</span><span className="editor-narrative__checks">{['voice','text','contextAction'].map(method => <label key={method}><input type="checkbox" checked={expression.inputMethods.includes(method as typeof expression.inputMethods[number])} onChange={event => updateExpression({ ...expression, inputMethods: event.target.checked ? [...expression.inputMethods, method as typeof expression.inputMethods[number]] : expression.inputMethods.filter(item => item !== method) })} />{method}</label>)}</span></label>
        </div>
        <fieldset className="editor-narrative__matcher"><legend>Respuesta aceptada</legend>
          <div className="editor-narrative__selector"><label><span>Respuesta aceptada</span><select value={Math.min(matcherIndex, expression.matchAny.length - 1)} onChange={event => setMatcherIndex(Number(event.target.value))}>{expression.matchAny.map((item, index) => <option key={`${item.kind}:${index}`} value={index}>{index + 1} · {item.kind === 'phrase' ? 'Frase' : item.kind === 'intent' ? 'Intención' : 'Sonido'}</option>)}</select></label><button type="button" onClick={() => { updateExpression({ ...expression, matchAny: [...expression.matchAny, { kind: 'phrase', phrases: ['frase'] }] }); setMatcherIndex(expression.matchAny.length); }}>Añadir respuesta</button></div>
          {matcher ? <><label><span>Cómo reconocerla</span><select value={matcher.kind} onChange={event => updateMatcher(event.target.value === 'phrase' ? { kind: 'phrase', phrases: ['frase'] } : event.target.value === 'intent' ? { kind: 'intent', intent: 'custom', examples: ['ejemplo'] } : { kind: 'acoustic', feature: 'loudness', minimumDurationMs: 300, minimumLevel: .5 })}><option value="phrase">Frase exacta o parecida</option><option value="intent">Intención</option><option value="acoustic">Característica del sonido</option></select></label><MatcherFields matcher={matcher} onChange={updateMatcher} /></> : null}
        </fieldset>
        <IdempotentRewardFields originId={expression.rewardOriginId} packageId={expression.rewardPackageId} onChange={reward => updateExpression({ ...expression, ...reward })} />
      </> : <p className="editor-catalog__empty-field">No hay interacciones expresivas.</p>}
    </div> : null}
  </section>;
}
