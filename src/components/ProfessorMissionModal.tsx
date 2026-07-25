import { useEffect, useRef, useState } from 'react';
import type { MissionDefinitionV1, MissionStatus, RewardDefinitionV1 } from '../../packages/contracts/src/index.js';
import type { PokemonCatalogRecord } from '../domain/catalog/pokemonCatalogModel.js';
import { getCompanionCandidates } from '../domain/companions/companionCandidates.js';
import { getCompanionArtworkUrl } from '../domain/companions/companionGameplayCatalog.js';
import { getBrowserPokeVoiceSave } from '../store/browserPokeVoiceSaveStore.js';
import { getPokeDiscoverMission } from '../data/adventure/missionCatalog.js';
import { getPokeDiscoverShopContent } from '../data/adventure/pokeDiscoverShop.js';
import { getMissionStatus } from '../domain/expeditions/missionLifecycle.js';
import { CompanionSelector } from './CompanionSelector.js';
import { PokeDiscoverShop } from './PokeDiscoverShop.js';

const TRAINER_AVATARS = Object.freeze({
  achaman: 'assets/images/achaman/achaman-saludando.png',
  guayota: 'assets/images/guayota/guayota-y-horquilla-saludando.png',
});

const MISSION_STATUS_LABELS: Readonly<Record<MissionStatus, string>> = Object.freeze({
  locked: 'Bloqueado',
  available: 'Disponible',
  active: 'En curso',
  completed: 'Completado',
});

function describeMissionReward(reward: RewardDefinitionV1) {
  if (reward.kind === 'trainerExperience') return `${reward.amount} PX de entrenador`;
  if (reward.kind === 'discoveryPoints') return `${reward.amount} Puntos de Descubrimiento`;
  if (!('contentId' in reward)) return 'Recompensa de investigación';
  const content = getPokeDiscoverShopContent(reward.contentId);
  if (content) return content.displayName;
  if (reward.kind === 'item') return reward.category === 'tool' ? 'Nueva herramienta' : 'Nuevo objeto clave';
  return reward.kind === 'permission' ? 'Nuevo permiso de campo' : 'Nuevo cosmético';
}

function MissionBoard({
  catalog,
  missions,
  save,
  selectedMissionId,
  onSelectMission,
  onChooseCompanion,
  onOpenMapPreview,
}: {
  catalog: readonly PokemonCatalogRecord[];
  missions: readonly MissionDefinitionV1[];
  save: ReturnType<typeof getBrowserPokeVoiceSave>;
  selectedMissionId?: string;
  onSelectMission: (missionId: string) => void;
  onChooseCompanion: () => void;
  onOpenMapPreview: () => void;
}) {
  const selectedMission = missions.find(mission => mission.missionId === selectedMissionId) ?? missions[0];
  const selectedStatus = selectedMission ? getMissionStatus(save, selectedMission) : undefined;
  const candidates = getCompanionCandidates(catalog, save);
  const selectedCompanion = candidates.find(candidate => candidate.selected);
  const hasEligibleCompanion = candidates.some(candidate => candidate.eligibility.status === 'eligible');
  const needsCompanion = hasEligibleCompanion && !selectedCompanion;
  const canEnter = selectedStatus !== 'locked' && !needsCompanion;

  return (
    <div className="professor-mission-board">
      <aside className="professor-mission-board__selector" aria-label="Selector de encargos">
        <span className="professor-mission-board__eyebrow">Encargos conocidos</span>
        {missions.map(mission => {
          const status = getMissionStatus(save, mission);
          const selected = mission.missionId === selectedMission?.missionId;
          return (
            <button
              className={`professor-mission-card professor-mission-card--${status} ${selected ? 'is-selected' : ''}`}
              type="button"
              key={mission.missionId}
              aria-pressed={selected}
              onClick={() => onSelectMission(mission.missionId)}
            >
              <span className="professor-mission-card__status">{MISSION_STATUS_LABELS[status]}</span>
              <strong>{mission.title}</strong>
              <span>Ver briefing</span>
            </button>
          );
        })}
      </aside>

      {selectedMission && selectedStatus ? (
        <article className="professor-mission-briefing" aria-label={`Briefing: ${selectedMission.title}`}>
          <header>
            <div>
              <span className="professor-mission-board__eyebrow">Briefing del profesor</span>
              <h4>{selectedMission.title}</h4>
            </div>
            <span className={`professor-mission-card__status professor-mission-card__status--${selectedStatus}`}>
              {MISSION_STATUS_LABELS[selectedStatus]}
            </span>
          </header>
          <p className="professor-mission-briefing__summary">{selectedMission.briefing}</p>

          <section className="professor-mission-briefing__section" aria-labelledby="mission-objectives-title">
            <h5 id="mission-objectives-title">Objetivos</h5>
            <ul>
              {selectedMission.objectives.map(objective => (
                <li key={objective.objectiveId}>{objective.description}{objective.optional ? ' (opcional)' : ''}</li>
              ))}
            </ul>
          </section>

          <section className="professor-mission-briefing__section" aria-labelledby="mission-rewards-title">
            <h5 id="mission-rewards-title">Recompensas</h5>
            <ul className="professor-mission-rewards">
              {selectedMission.rewards.map((reward, index) => (
                <li key={`${reward.kind}:${index}`}>
                  <span aria-hidden="true">{reward.kind === 'trainerExperience' ? '★' : reward.kind === 'discoveryPoints' ? '◆' : '🎁'}</span>
                  {describeMissionReward(reward)}
                </li>
              ))}
              {selectedMission.unlocksFreeExpedition ? <li><span aria-hidden="true">🗺</span>Expedición libre en este mapa</li> : null}
            </ul>
          </section>

          <section className="professor-mission-loadout" aria-label="Compañero preparado">
            <div className="professor-mission-loadout__copy">
              <span className="professor-mission-board__eyebrow">Compañero</span>
              {selectedCompanion ? (
                <div className="professor-mission-loadout__selected">
                  <img src={getCompanionArtworkUrl(selectedCompanion.assetId, selectedCompanion.record.species.speciesId)} alt="" />
                  <strong>{selectedCompanion.displayName}</strong>
                </div>
              ) : (
                <p>{hasEligibleCompanion ? 'Elige quién te acompañará antes de salir.' : 'Alcanfor preparará tu primer compañero.'}</p>
              )}
            </div>
            {hasEligibleCompanion ? (
              <button type="button" onClick={onChooseCompanion}>
                {selectedCompanion ? 'Cambiar compañero' : 'Elegir compañero'}
              </button>
            ) : null}
          </section>

          <footer className="professor-mission-briefing__actions">
            {needsCompanion ? <p role="status">Necesitas preparar un compañero para este encargo.</p> : null}
            <button type="button" disabled={!canEnter} onClick={onOpenMapPreview}>
              {selectedStatus === 'active' ? 'Continuar encargo' : selectedStatus === 'completed' ? 'Volver al mapa' : 'Comenzar encargo'}
            </button>
          </footer>
        </article>
      ) : null}
    </div>
  );
}

function PokeDiscoverHome({
  catalog,
  missionIds,
  save,
  onOpenMapPreview,
}: {
  catalog: readonly PokemonCatalogRecord[];
  missionIds: readonly string[];
  save: ReturnType<typeof getBrowserPokeVoiceSave>;
  onOpenMapPreview: () => void;
}) {
  const { pokeDiscover } = save;
  const candidates = getCompanionCandidates(catalog, save);
  const eligibleCandidates = candidates.filter(candidate => candidate.eligibility.status === 'eligible');
  const selected = candidates.find(candidate => candidate.selected);
  const completedMissionIds = new Set(Object.values(pokeDiscover.mapProgress)
    .flatMap(progress => progress.completedMissionIds));
  const profile = pokeDiscover.trainerProfile;

  return (
    <div className="pokediscover-home">
      <section className="pokediscover-profile" aria-label="Ficha de investigador">
        <div className="pokediscover-profile__portrait">
          {profile ? (
            <img
              src={`${import.meta.env.BASE_URL}${TRAINER_AVATARS[profile.avatarId]}`}
              alt={`Avatar de ${profile.displayName}`}
            />
          ) : (
            <img className="camphor-leaf-mark" src={`${import.meta.env.BASE_URL}assets/icons/profesor-alcanfor/hoja-alcanforero.png`} alt="" />
          )}
        </div>
        <div className="pokediscover-profile__copy">
          <span>Investigador de campo</span>
          <h4>{profile?.displayName ?? 'Entrenador'}</h4>
          <p>Miembro del programa PokeDiscover del profesor Alcanfor.</p>
        </div>
        <div className="pokediscover-profile__level" aria-label={`Nivel de entrenador ${pokeDiscover.trainerLevel}`}>
          <small>Nivel</small>
          <strong>{pokeDiscover.trainerLevel}</strong>
        </div>
      </section>

      <section className="pokediscover-summary" aria-label="Resumen de PokeDiscover">
        <article><span>Encargos activos</span><strong>{pokeDiscover.activeMissionIds.length}</strong></article>
        <article><span>Completados</span><strong>{completedMissionIds.size}</strong></article>
        <article><span>Experiencia</span><strong>{pokeDiscover.trainerExperience}</strong></article>
        <article><span>PD</span><strong>{pokeDiscover.discoveryPoints}</strong></article>
      </section>

      <section className="pokediscover-home__columns">
        <article className="pokediscover-home-card pokediscover-home-card--companion">
          <span className="pokediscover-home-card__eyebrow">Equipo de campo</span>
          <h4>{eligibleCandidates.length} Pokémon {eligibleCandidates.length === 1 ? 'quiere' : 'quieren'} acompañarte</h4>
          {selected ? (
            <div className="pokediscover-current-companion">
              <img
                src={getCompanionArtworkUrl(selected.assetId, selected.record.species.speciesId)}
                alt=""
              />
              <div><small>Compañero actual</small><strong>{selected.displayName}</strong></div>
            </div>
          ) : (
            <p>Aún no has elegido compañero para tu próxima expedición.</p>
          )}
        </article>

        <article className="pokediscover-home-card pokediscover-home-card--missions">
          <span className="pokediscover-home-card__eyebrow">Actividad reciente</span>
          {missionIds.length ? (
            <><h4>{missionIds.length} {missionIds.length === 1 ? 'encargo conocido' : 'encargos conocidos'}</h4><p>Consulta Encargos para revisar el trabajo disponible y completado.</p></>
          ) : (
            <><h4>Preparando el primer encargo</h4><p>Alcanfor está organizando el material para tu primera expedición.</p></>
          )}
          <button className="pokediscover-map-preview-button" type="button" onClick={onOpenMapPreview}>
            <span aria-hidden="true">🗺</span>
            Probar escenario
          </button>
        </article>
      </section>
    </div>
  );
}

export function ProfessorMissionModal({
  open,
  missionIds,
  catalog,
  initialSection = 'home',
  selectedMissionId,
  companionSelectionLocked = false,
  onConfirmCompanion = () => {},
  onOpenMission = () => {},
  onOpenMapPreview = () => {},
  onClose,
}: {
  open: boolean;
  missionIds: readonly string[];
  catalog: readonly PokemonCatalogRecord[];
  initialSection?: 'home' | 'missions' | 'companion' | 'shop';
  selectedMissionId?: string;
  companionSelectionLocked?: boolean;
  onConfirmCompanion?: () => void;
  onOpenMission?: (missionId: string) => void;
  onOpenMapPreview?: () => void;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const [section, setSection] = useState<'home' | 'missions' | 'companion' | 'shop'>(initialSection);
  const [save, setSave] = useState(getBrowserPokeVoiceSave);
  const [focusedMissionId, setFocusedMissionId] = useState(selectedMissionId ?? missionIds[0]);
  useEffect(() => {
    if (!open) return undefined;
    setSection(initialSection);
    setSave(getBrowserPokeVoiceSave());
    setFocusedMissionId(selectedMissionId ?? missionIds[0]);
    (companionSelectionLocked ? panelRef.current : closeRef.current)?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !companionSelectionLocked) onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [companionSelectionLocked, initialSection, onClose, open, selectedMissionId]);
  const missions = missionIds
    .map(getPokeDiscoverMission)
    .filter((mission): mission is MissionDefinitionV1 => Boolean(mission));
  const selectedCompanion = getCompanionCandidates(catalog, save).find(candidate => candidate.selected);
  if (!open) return null;
  return (
    <div className="pv-modal professor-missions" data-testid="professor-missions">
      <div className="pv-modal__backdrop" onClick={companionSelectionLocked ? undefined : onClose} />
      <section ref={panelRef} tabIndex={companionSelectionLocked ? -1 : undefined} className="pv-modal__panel professor-missions__panel" role="dialog" aria-modal="true" aria-labelledby="professor-missions-title">
        <header className="pv-modal__head">
          <h3 id="professor-missions-title">PokeDiscover</h3>
          {!companionSelectionLocked ? <button ref={closeRef} className="icon-btn professor-missions__close" type="button" aria-label="Cerrar PokeDiscover" onClick={onClose}>×</button> : <span className="professor-missions__urgent-badge">Llamada urgente</span>}
        </header>
        <nav className="professor-missions__tabs" aria-label="Secciones de Poke-Discover">
          <button type="button" disabled={companionSelectionLocked} className={section === 'home' ? 'is-active' : ''} aria-pressed={section === 'home'} onClick={() => setSection('home')}>Inicio</button>
          <button type="button" disabled={companionSelectionLocked} className={section === 'missions' ? 'is-active' : ''} aria-pressed={section === 'missions'} onClick={() => setSection('missions')}>Encargos</button>
          <button type="button" className={section === 'companion' ? 'is-active' : ''} aria-pressed={section === 'companion'} onClick={() => setSection('companion')}>Compañero</button>
          <button type="button" disabled={companionSelectionLocked} className={section === 'shop' ? 'is-active' : ''} aria-pressed={section === 'shop'} onClick={() => setSection('shop')}>Tienda</button>
        </nav>
        <div className="pv-modal__body professor-missions__body">
          {section === 'home' ? (
            <PokeDiscoverHome catalog={catalog} missionIds={missionIds} save={save} onOpenMapPreview={onOpenMapPreview} />
          ) : section === 'companion' ? (
            <div className={companionSelectionLocked ? 'professor-urgent-companion' : ''}>
              {companionSelectionLocked ? <div className="professor-urgent-companion__message" role="status"><strong>Alcanfor necesita ayuda en Tegueste</strong><p>Elige un compañero y confirma la salida. No podrás cambiar de sección hasta dejar preparado el equipo.</p></div> : null}
              <CompanionSelector catalog={catalog} onSaveChange={setSave} />
              {companionSelectionLocked ? <footer className="professor-urgent-companion__actions"><p>{selectedCompanion ? `${selectedCompanion.displayName} está listo para partir.` : 'Selecciona un Pokémon disponible para continuar.'}</p><button type="button" disabled={!selectedCompanion} onClick={onConfirmCompanion}>Confirmar compañero y revisar encargo</button></footer> : null}
            </div>
          ) : section === 'shop' ? (
            <PokeDiscoverShop save={save} onSaveChange={setSave} />
          ) : missions.length ? (
            <MissionBoard
              catalog={catalog}
              missions={missions}
              save={save}
              selectedMissionId={focusedMissionId}
              onSelectMission={missionId => {
                setFocusedMissionId(missionId);
                onOpenMission(missionId);
              }}
              onChooseCompanion={() => setSection('companion')}
              onOpenMapPreview={onOpenMapPreview}
            />
          ) : (
            <div className="professor-missions__empty">
              <img className="camphor-leaf-mark" src={`${import.meta.env.BASE_URL}assets/icons/profesor-alcanfor/hoja-alcanforero.png`} alt="" aria-hidden="true" />
              <h4>Preparando el primer encargo</h4>
              <p>Alcanfor está organizando el material de campo. Volverá a avisarte cuando la primera expedición esté lista.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
