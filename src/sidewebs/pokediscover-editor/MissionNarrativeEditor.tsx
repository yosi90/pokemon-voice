import { useMemo, useState } from 'react';
import type {
  AdventureMissionDocumentV1,
  CharacterSpriteManifestV1,
  MissionDefinitionV1,
  NarrativePageV1,
  NarrativeSequenceV1,
} from '../../../packages/contracts/src/index.js';
import { nextStableEditorId } from '../../domain/tools/pokeDiscoverEditorBeats.js';
import { MissionFlowEditor } from './MissionFlowEditor.js';

function replaceMission(
  document: AdventureMissionDocumentV1,
  mission: MissionDefinitionV1,
) {
  return {
    ...document,
    missions: document.missions.map(candidate => (
      candidate.missionId === mission.missionId ? mission : candidate
    )),
  };
}

function replaceSequence(
  document: AdventureMissionDocumentV1,
  sequence: NarrativeSequenceV1,
) {
  return {
    ...document,
    narrativeSequences: document.narrativeSequences.map(candidate => (
      candidate.sequenceId === sequence.sequenceId ? sequence : candidate
    )),
  };
}

export function MissionNarrativeEditor({
  document,
  characterManifest,
  onChange,
  availableMaps = [],
}: {
  document: AdventureMissionDocumentV1;
  characterManifest: CharacterSpriteManifestV1;
  onChange: (document: AdventureMissionDocumentV1, description: string) => void;
  availableMaps?: Array<{
    mapId: string;
    title: string;
    sectors: Array<{ sectorId: string; label: string }>;
  }>;
}) {
  const [missionId, setMissionId] = useState(document.missions[0]?.missionId ?? '');
  const [sequenceId, setSequenceId] = useState(document.narrativeSequences[0]?.sequenceId ?? '');
  const [pageId, setPageId] = useState('');
  const mission = document.missions.find(candidate => candidate.missionId === missionId)
    ?? document.missions[0];
  const sequence = document.narrativeSequences.find(candidate => candidate.sequenceId === sequenceId)
    ?? document.narrativeSequences[0];
  const page = sequence?.pages.find(candidate => candidate.pageId === pageId) ?? sequence?.pages[0];
  const trainerExperienceReward = mission?.rewards.find(reward => reward.kind === 'trainerExperience');
  const discoveryPointsReward = mission?.rewards.find(reward => reward.kind === 'discoveryPoints');
  const trainerExperienceAmount = trainerExperienceReward && 'amount' in trainerExperienceReward
    ? trainerExperienceReward.amount
    : 0;
  const discoveryPointsAmount = discoveryPointsReward && 'amount' in discoveryPointsReward
    ? discoveryPointsReward.amount
    : 0;
  const appearanceOptions = useMemo(() => characterManifest.appearances ?? [], [characterManifest]);

  const updateMission = (next: MissionDefinitionV1) => {
    onChange(replaceMission(document, next), 'Actualizar misión');
  };
  const updateSequence = (next: NarrativeSequenceV1) => {
    onChange(replaceSequence(document, next), 'Actualizar diálogo de misión');
  };

  const createMission = () => {
    const nextId = nextStableEditorId(
      `mission:${document.mapId.split(':').at(-1)}`,
      document.missions.map(candidate => candidate.missionId),
    );
    const next: MissionDefinitionV1 = {
      schemaVersion: 1,
      missionId: nextId,
      mapId: document.mapId,
      title: 'Nueva misión',
      loadingText: 'Preparando la expedición…',
      briefing: 'Describe aquí el encargo del profesor.',
      availability: { kind: 'trainerLevel', minimum: 1 },
      objectives: [{
        objectiveId: `${nextId}:objective:01`,
        description: 'Completa el objetivo.',
        requirement: { kind: 'missionFlag', flagId: `${nextId}:completed` },
      }],
      mapVariantIds: [],
      rewards: [],
      unlocksFreeExpedition: false,
    };
    onChange({ ...document, missions: [...document.missions, next] }, 'Crear misión');
    setMissionId(nextId);
  };

  const createSequence = () => {
    const nextId = nextStableEditorId(
      `narrative:${document.mapId.split(':').at(-1)}`,
      document.narrativeSequences.map(candidate => candidate.sequenceId),
    );
    const firstPageId = `${nextId}:page:01`;
    const next: NarrativeSequenceV1 = {
      schemaVersion: 1,
      sequenceId: nextId,
      initialPageId: firstPageId,
      once: false,
      pages: [{
        pageId: firstPageId,
        speakerId: 'npc:professor-alcanfor',
        speakerName: 'Profesor Alcanfor',
        text: 'Escribe aquí el diálogo.',
        portraitState: 'speaking',
      }],
    };
    onChange({
      ...document,
      narrativeSequences: [...document.narrativeSequences, next],
    }, 'Crear diálogo de misión');
    setSequenceId(nextId);
    setPageId(firstPageId);
  };

  const addPage = () => {
    if (!sequence) return;
    const nextPageId = nextStableEditorId(
      `${sequence.sequenceId}:page`,
      sequence.pages.map(candidate => candidate.pageId),
    );
    const nextPage: NarrativePageV1 = {
      pageId: nextPageId,
      speakerId: 'npc:professor-alcanfor',
      speakerName: 'Profesor Alcanfor',
      text: 'Continúa el diálogo.',
      portraitState: 'speaking',
    };
    const pages = sequence.pages.map((candidate, index) => (
      index === sequence.pages.length - 1 && !candidate.nextPageId && !candidate.choices
        ? { ...candidate, nextPageId }
        : candidate
    ));
    updateSequence({ ...sequence, pages: [...pages, nextPage] });
    setPageId(nextPageId);
  };

  const updatePage = (next: NarrativePageV1) => {
    if (!sequence) return;
    updateSequence({
      ...sequence,
      pages: sequence.pages.map(candidate => candidate.pageId === next.pageId ? next : candidate),
    });
  };

  return <section className="editor-missions">
    <header>
      <div><span className="editor-eyebrow">Contenido portable</span><h2>Misiones y diálogos</h2></div>
      <span>{document.missions.length} misiones</span>
    </header>

    <div className="editor-missions__columns">
      <section>
        <div className="editor-narrative__selector">
          <label><span>Misión</span><select value={mission?.missionId ?? ''} onChange={event => setMissionId(event.target.value)}>
            {document.missions.map(candidate => <option key={candidate.missionId} value={candidate.missionId}>{candidate.title}</option>)}
          </select></label>
          <button type="button" onClick={createMission}>Nueva misión</button>
        </div>
        {mission ? <div className="editor-missions__form">
          <label><span>Título</span><input value={mission.title} onChange={event => updateMission({ ...mission, title: event.target.value })} /></label>
          <label><span>Texto de carga</span><input value={mission.loadingText} onChange={event => updateMission({ ...mission, loadingText: event.target.value })} /></label>
          <label><span>Briefing</span><textarea value={mission.briefing} onChange={event => updateMission({ ...mission, briefing: event.target.value })} /></label>
          <label><span>Apariencia del jugador</span><select value={mission.playerAppearanceId ?? ''} onChange={event => updateMission({ ...mission, playerAppearanceId: event.target.value || undefined })}>
            <option value="">Perfil del jugador</option>
            {appearanceOptions.map(appearance => <option key={appearance.appearanceId} value={appearance.appearanceId}>{appearance.label}</option>)}
          </select></label>
          <label><span>Experiencia</span><input type="number" min="0" value={trainerExperienceAmount} onChange={event => {
            const amount = Math.max(0, Number(event.target.value) || 0);
            updateMission({
              ...mission,
              rewards: [
                ...mission.rewards.filter(reward => reward.kind !== 'trainerExperience'),
                ...(amount ? [{ kind: 'trainerExperience' as const, amount }] : []),
              ],
            });
          }} /></label>
          <label><span>PD</span><input type="number" min="0" value={discoveryPointsAmount} onChange={event => {
            const amount = Math.max(0, Number(event.target.value) || 0);
            updateMission({
              ...mission,
              rewards: [
                ...mission.rewards.filter(reward => reward.kind !== 'discoveryPoints'),
                ...(amount ? [{ kind: 'discoveryPoints' as const, amount }] : []),
              ],
            });
          }} /></label>
          <label><span><input type="checkbox" checked={mission.unlocksFreeExpedition} onChange={event => updateMission({ ...mission, unlocksFreeExpedition: event.target.checked })} /> Desbloquea expedición libre</span></label>
          <fieldset>
            <legend>Objetivos</legend>
            {mission.objectives.map((objective, index) => <label key={objective.objectiveId}>
              <span>Objetivo {index + 1}</span>
              <input value={objective.description} onChange={event => updateMission({
                ...mission,
                objectives: mission.objectives.map(candidate => candidate.objectiveId === objective.objectiveId
                  ? { ...candidate, description: event.target.value }
                  : candidate),
              })} />
            </label>)}
            <button type="button" onClick={() => {
              const objectiveId = nextStableEditorId(
                `${mission.missionId}:objective`,
                mission.objectives.map(candidate => candidate.objectiveId),
              );
              updateMission({
                ...mission,
                objectives: [...mission.objectives, {
                  objectiveId,
                  description: 'Nuevo objetivo',
                  requirement: { kind: 'missionFlag', flagId: `${objectiveId}:completed` },
                }],
              });
            }}>Añadir objetivo</button>
          </fieldset>
          <fieldset>
            <legend>Diálogos de la misión</legend>
            {([
              ['offerSequenceId', 'Oferta'],
              ['briefingSequenceId', 'Briefing'],
              ['successSequenceId', 'Éxito'],
              ['failureSequenceId', 'Fracaso'],
            ] as const).map(([slot, label]) => <label key={slot}><span>{label}</span><select value={mission.narratives?.[slot] ?? ''} onChange={event => updateMission({
              ...mission,
              narratives: { ...mission.narratives, [slot]: event.target.value || undefined },
            })}>
              <option value="">Sin diálogo</option>
              {document.narrativeSequences.map(candidate => <option key={candidate.sequenceId} value={candidate.sequenceId}>{candidate.sequenceId}</option>)}
            </select></label>)}
          </fieldset>
        </div> : <p>Crea la primera misión para comenzar.</p>}
      </section>

      <section>
        {mission ? <MissionFlowEditor
          mission={mission}
          availableMaps={availableMaps}
          onChange={next => updateMission(next)}
        /> : null}
        <details className="editor-missions__legacy">
          <summary>Compatibilidad: secuencias inline V1</summary>
        <div className="editor-narrative__selector">
          <label><span>Secuencia narrativa</span><select value={sequence?.sequenceId ?? ''} onChange={event => { setSequenceId(event.target.value); setPageId(''); }}>
            {document.narrativeSequences.map(candidate => <option key={candidate.sequenceId}>{candidate.sequenceId}</option>)}
          </select></label>
          <button type="button" onClick={createSequence}>Nuevo diálogo</button>
        </div>
        {sequence ? <>
          <label><span><input type="checkbox" checked={sequence.once} onChange={event => updateSequence({ ...sequence, once: event.target.checked })} /> Solo una vez</span></label>
          <div className="editor-narrative__selector">
            <label><span>Página</span><select value={page?.pageId ?? ''} onChange={event => setPageId(event.target.value)}>
              {sequence.pages.map(candidate => <option key={candidate.pageId}>{candidate.pageId}</option>)}
            </select></label>
            <button type="button" onClick={addPage}>Añadir página</button>
          </div>
          {page ? <div className="editor-missions__form">
            <label><span>Hablante</span><input value={page.speakerName} onChange={event => updatePage({ ...page, speakerName: event.target.value })} /></label>
            <label><span>ID del hablante</span><input value={page.speakerId} onChange={event => updatePage({ ...page, speakerId: event.target.value })} /></label>
            <label><span>Retrato</span><select value={page.portraitState} onChange={event => updatePage({ ...page, portraitState: event.target.value as NarrativePageV1['portraitState'] })}>
              <option value="neutral">Neutral</option><option value="speaking">Hablando</option><option value="idea">Idea</option><option value="glitch">Glitch</option>
            </select></label>
            <label><span>Texto</span><textarea value={page.text} onChange={event => updatePage({ ...page, text: event.target.value })} /></label>
            <label><span>Siguiente página</span><select value={page.nextPageId ?? ''} onChange={event => updatePage({ ...page, nextPageId: event.target.value || undefined })}>
              <option value="">Finalizar</option>
              {sequence.pages.filter(candidate => candidate.pageId !== page.pageId).map(candidate => <option key={candidate.pageId}>{candidate.pageId}</option>)}
            </select></label>
          </div> : null}
        </> : <p>Crea un diálogo para usarlo en oferta, briefing, éxito, fracaso o eventos internos.</p>}
        </details>
      </section>
    </div>
  </section>;
}
