import { useState } from 'react';
import type { AdventureMapV3, RequirementAtomV1, RequirementExpressionV1 } from '../../../packages/contracts/src/index.js';
import {
  createRequirementAtom,
  listAdventureRequirementTargets,
  removeRequirementNode,
  replaceRequirementNode,
  requirementTargetKey,
  updateAdventureRequirement,
} from '../../domain/tools/pokeDiscoverEditorRequirements.js';

const ATOM_LABELS: Record<RequirementAtomV1['kind'], string> = {
  trainerLevel: 'Nivel de entrenador', completedMaps: 'Mapas completados', unlockedSecrets: 'Secretos desbloqueados', completedResearchEntries: 'Investigaciones completas',
  registeredSpecies: 'Especie registrada', registeredSpeciesByTag: 'Especies por etiqueta', sightedSpecies: 'Especie avistada', researchStatus: 'Estado de investigación', researchField: 'Campo investigado',
  achievement: 'Logro', modeCompleted: 'Modo completado', worldFlag: 'Flag global', fieldCapability: 'Capacidad de campo', companionSpecies: 'Especie compañera', companionForm: 'Forma compañera',
  companionType: 'Tipo del compañero', companionSize: 'Tamaño del compañero', companionEvolutionStage: 'Etapa evolutiva', companionTag: 'Etiqueta del compañero', knownNpc: 'NPC conocido', conversation: 'Conversación',
  counter: 'Contador', missionCounter: 'Contador de misión', missionFlag: 'Flag de misión', inventoryItem: 'Objeto de inventario', unlockedSecret: 'Secreto concreto', storyEvent: 'Evento narrativo',
};

function numberField(label: string, value: number, onChange: (value: number) => void) {
  return <label><span>{label}</span><input type="number" min="0" value={value} onChange={event => onChange(Math.max(0, Number(event.target.value) || 0))} /></label>;
}

function textField(label: string, value: string, onChange: (value: string) => void) {
  return <label><span>{label}</span><input value={value} onChange={event => onChange(event.target.value)} /></label>;
}

function AtomFields({ atom, onChange }: { atom: RequirementAtomV1; onChange: (atom: RequirementAtomV1) => void }) {
  const patch = (values: object) => onChange({ ...atom, ...values } as RequirementAtomV1);
  if ('speciesId' in atom) return <>
    {numberField('Especie #', atom.speciesId, speciesId => patch({ speciesId }))}
    {'status' in atom ? <label><span>Estado</span><select value={atom.status} onChange={event => patch({ status: event.target.value })}><option value="notSeen">No vista</option><option value="sighted">Avistada</option><option value="partial">Parcial</option><option value="complete">Completa</option></select></label> : null}
    {'field' in atom ? <label><span>Campo</span><select value={atom.field} onChange={event => patch({ field: event.target.value })}><option value="biometrics">Biometría</option><option value="behavior">Conducta</option><option value="habitat">Hábitat</option><option value="exceptional">Excepcional</option></select></label> : null}
  </>;
  if ('counterId' in atom) return <>
    {textField('ID del contador', atom.counterId, counterId => patch({ counterId }))}
    <label><span>Comparación</span><select value={atom.comparison} onChange={event => patch({ comparison: event.target.value })}>{['eq', 'gte', 'lte', 'gt', 'lt'].map(value => <option key={value}>{value}</option>)}</select></label>
    {numberField('Valor', atom.value, value => patch({ value }))}
  </>;
  if ('capabilityId' in atom) return <>
    <label><span>Capacidad</span><select value={atom.capabilityId} onChange={event => patch({ capabilityId: event.target.value })}>{['cut','surf','fly','dig','archaeology','rock-smash','rock-tomb','light','climb','carry','ride-ground','ride-water','ride-air'].map(value => <option key={value}>{value}</option>)}</select></label>
    {numberField('Fuerza mínima', atom.minimumStrength ?? 1, minimumStrength => patch({ minimumStrength }))}
  </>;
  if ('minimumClass' in atom) return <label><span>Tamaño mínimo</span><select value={atom.minimumClass} onChange={event => patch({ minimumClass: event.target.value })}>{['tiny','small','medium','large','huge'].map(value => <option key={value}>{value}</option>)}</select></label>;
  if ('typeId' in atom) return <label><span>Tipo</span><select value={atom.typeId} onChange={event => patch({ typeId: event.target.value })}>{['normal','fire','water','electric','grass','ice','fighting','poison','ground','flying','psychic','bug','rock','ghost','dragon','dark','steel','fairy'].map(value => <option key={value}>{value}</option>)}</select></label>;
  if ('minimum' in atom) return numberField('Mínimo', atom.minimum, minimum => patch({ minimum }));
  if ('tag' in atom) return <>{textField('Etiqueta', String(atom.tag), tag => patch({ tag }))}{'minimum' in atom ? numberField('Mínimo', Number(atom.minimum), minimum => patch({ minimum })) : null}</>;
  const idField = Object.keys(atom).find(key => key !== 'kind' && key.endsWith('Id')) as keyof RequirementAtomV1 | undefined;
  if (idField) return textField('ID estable', String(atom[idField] ?? ''), value => patch({ [idField]: value }));
  return null;
}

function RequirementNode({
  expression, path, root, onReplace, onRemove,
}: {
  expression: RequirementExpressionV1;
  path: number[];
  root?: boolean;
  onReplace: (path: number[], expression: RequirementExpressionV1) => void;
  onRemove: (path: number[]) => void;
}) {
  const group = 'all' in expression
    ? { key: 'all' as const, children: expression.all }
    : 'any' in expression ? { key: 'any' as const, children: expression.any } : undefined;
  const groupKey = group?.key;
  const children = group?.children;
  const atom = group ? undefined : expression as RequirementAtomV1;
  return <div className={`editor-requirement-node ${groupKey ? 'is-group' : 'is-atom'}`}>
    <div className="editor-requirement-node__head">
      <label><span>Tipo de nodo</span><select aria-label="Tipo de nodo" value={groupKey ?? 'condition'} onChange={event => {
        const value = event.target.value;
        onReplace(path, value === 'condition' ? createRequirementAtom('trainerLevel') : { [value]: [createRequirementAtom('trainerLevel')] } as RequirementExpressionV1);
      }}><option value="condition">Condición</option><option value="all">Todas (all)</option><option value="any">Cualquiera (any)</option></select></label>
      {!root ? <button type="button" className="is-danger" onClick={() => onRemove(path)}>Quitar</button> : null}
    </div>
    {groupKey && children ? <>
      <div className="editor-requirement-children">
        {children.map((child, index) => <RequirementNode key={`${path.join('.')}:${index}`} expression={child} path={[...path, index]} onReplace={onReplace} onRemove={onRemove} />)}
        {!children.length ? <p>Este grupo está vacío.</p> : null}
      </div>
      <div className="editor-requirement-node__add"><button type="button" onClick={() => onReplace(path, { [groupKey]: [...children, createRequirementAtom('trainerLevel')] } as RequirementExpressionV1)}>Añadir condición</button><button type="button" onClick={() => onReplace(path, { [groupKey]: [...children, { all: [createRequirementAtom('trainerLevel')] }] } as RequirementExpressionV1)}>Añadir grupo</button></div>
    </> : null}
    {atom ? <div className="editor-requirement-atom">
      <label><span>Condición</span><select aria-label="Condición" value={atom.kind} onChange={event => onReplace(path, createRequirementAtom(event.target.value as RequirementAtomV1['kind']))}>{Object.entries(ATOM_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <AtomFields atom={atom} onChange={nextAtom => onReplace(path, nextAtom)} />
    </div> : null}
  </div>;
}

export function RequirementEditor({ adventure, onAdventureChange }: { adventure: AdventureMapV3; onAdventureChange: (adventure: AdventureMapV3) => void }) {
  const targets = listAdventureRequirementTargets(adventure);
  const [targetKey, setTargetKey] = useState('');
  const target = targets.find(candidate => requirementTargetKey(candidate) === targetKey) ?? targets[0];
  const update = (expression: RequirementExpressionV1) => target && onAdventureChange(updateAdventureRequirement(adventure, target, expression));
  return <section className="editor-requirements" aria-labelledby="editor-requirements-title">
    <header><div><span className="editor-eyebrow">Contrato compartido</span><h2 id="editor-requirements-title">Requisitos visuales</h2></div><span>{targets.length} definiciones</span></header>
    {target ? <>
      <label className="editor-requirements__target"><span>Definición condicionada</span><select value={requirementTargetKey(target)} onChange={event => setTargetKey(event.target.value)}>{targets.map(candidate => <option key={requirementTargetKey(candidate)} value={requirementTargetKey(candidate)}>{candidate.label}</option>)}</select></label>
      <RequirementNode
        root
        expression={target.expression}
        path={[]}
        onReplace={(path, replacement) => update(replaceRequirementNode(target.expression, path, replacement))}
        onRemove={path => update(removeRequirementNode(target.expression, path))}
      />
    </> : <p className="editor-catalog__empty-field">Este proyecto todavía no contiene definiciones con requisitos.</p>}
  </section>;
}
