import { useEffect, useRef, useState } from 'react';
import type { PokemonCatalogRecord } from '../domain/catalog/pokemonCatalogModel.js';
import { getCompanionCandidates } from '../domain/companions/companionCandidates.js';
import { getCompanionArtworkUrl } from '../domain/companions/companionGameplayCatalog.js';
import { getBrowserPokeVoiceSave } from '../store/browserPokeVoiceSaveStore.js';
import { getPokeDiscoverMission } from '../data/adventure/missionCatalog.js';
import { getMissionStatus } from '../domain/expeditions/missionLifecycle.js';
import { CompanionSelector } from './CompanionSelector.js';
import { PokeDiscoverShop } from './PokeDiscoverShop.js';

const TRAINER_AVATARS = Object.freeze({
  achaman: 'assets/images/achaman/achaman-saludando.png',
  guayota: 'assets/images/guayota/guayota-y-horquilla-saludando.png',
});

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
  onOpenMission = () => {},
  onOpenMapPreview = () => {},
  onClose,
}: {
  open: boolean;
  missionIds: readonly string[];
  catalog: readonly PokemonCatalogRecord[];
  initialSection?: 'home' | 'missions' | 'companion' | 'shop';
  selectedMissionId?: string;
  onOpenMission?: (missionId: string) => void;
  onOpenMapPreview?: () => void;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const [section, setSection] = useState<'home' | 'missions' | 'companion' | 'shop'>(initialSection);
  const [save, setSave] = useState(getBrowserPokeVoiceSave);
  useEffect(() => {
    if (!open) return undefined;
    setSection(initialSection);
    setSave(getBrowserPokeVoiceSave());
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [initialSection, onClose, open]);
  if (!open) return null;
  return (
    <div className="pv-modal professor-missions" data-testid="professor-missions">
      <div className="pv-modal__backdrop" onClick={onClose} />
      <section className="pv-modal__panel professor-missions__panel" role="dialog" aria-modal="true" aria-labelledby="professor-missions-title">
        <header className="pv-modal__head">
          <h3 id="professor-missions-title">PokeDiscover</h3>
          <button ref={closeRef} className="icon-btn professor-missions__close" type="button" aria-label="Cerrar PokeDiscover" onClick={onClose}>×</button>
        </header>
        <nav className="professor-missions__tabs" aria-label="Secciones de Poke-Discover">
          <button type="button" className={section === 'home' ? 'is-active' : ''} aria-pressed={section === 'home'} onClick={() => setSection('home')}>Inicio</button>
          <button type="button" className={section === 'missions' ? 'is-active' : ''} aria-pressed={section === 'missions'} onClick={() => setSection('missions')}>Encargos</button>
          <button type="button" className={section === 'companion' ? 'is-active' : ''} aria-pressed={section === 'companion'} onClick={() => setSection('companion')}>Compañero</button>
          <button type="button" className={section === 'shop' ? 'is-active' : ''} aria-pressed={section === 'shop'} onClick={() => setSection('shop')}>Tienda</button>
        </nav>
        <div className="pv-modal__body professor-missions__body">
          {section === 'home' ? (
            <PokeDiscoverHome catalog={catalog} missionIds={missionIds} save={save} onOpenMapPreview={onOpenMapPreview} />
          ) : section === 'companion' ? (
            <CompanionSelector catalog={catalog} onSaveChange={setSave} />
          ) : section === 'shop' ? (
            <PokeDiscoverShop save={save} onSaveChange={setSave} />
          ) : missionIds.length ? missionIds.map(missionId => {
            const mission = getPokeDiscoverMission(missionId);
            const status = mission ? getMissionStatus(save, mission) : 'available';
            const statusLabels = {
              locked: 'Bloqueado',
              available: 'Disponible',
              active: 'En curso',
              completed: 'Completado',
            } as const;
            return (
              <article
                className={`professor-mission-card professor-mission-card--${status} ${selectedMissionId === missionId ? 'is-selected' : ''}`}
                key={missionId}
                aria-current={selectedMissionId === missionId ? 'page' : undefined}
              >
                <span className="professor-mission-card__status">{statusLabels[status]}</span>
                <strong>{mission?.title ?? missionId}</strong>
                {mission && <p>{mission.briefing}</p>}
                <button type="button" onClick={() => onOpenMission(missionId)}>
                  {status === 'active' ? 'Continuar encargo' : status === 'completed' ? 'Volver al mapa' : 'Ver encargo'}
                </button>
              </article>
            );
          }) : (
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
