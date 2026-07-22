import { useCallback, useEffect, useState } from 'react';
import { Dock } from './components/Dock.jsx';
import { DelibirdMode } from './components/DelibirdMode.jsx';
import { AchievementsDrawer, AchievementToasts } from './components/AchievementUi.js';
import { ModesDrawer } from './components/Drawers.jsx';
import { PokemonGrid } from './components/PokemonGrid.jsx';
import { PokemonDetailModal } from './components/PokemonDetailModal.jsx';
import { PsyduckMode } from './components/PsyduckMode.jsx';
import { SleepMode } from './components/SleepMode.jsx';
import { SpecialEffectsLayer } from './components/SpecialEffectsLayer.jsx';
import { TimedModal } from './components/TimedModal.jsx';
import { WhosThatPokemonMode } from './components/WhosThatPokemonMode.tsx';
import { ThemedChallengesMode } from './components/ThemedChallengesMode.tsx';
import { Toast } from './components/Toast.jsx';
import { NarrativeScene } from './components/NarrativeScene.tsx';
import { ProfessorMissionModal } from './components/ProfessorMissionModal.tsx';
import { ProfessorIncomingCall } from './components/ProfessorIncomingCall.tsx';
import { ExpeditionReportModal } from './components/ExpeditionReportModal.tsx';
import {
  MapConceptPreview,
  TEGUESTE_FOREST_PREVIEW_MAP_ID,
  TEGUESTE_FOREST_PREVIEW_ROOM_ID,
} from './components/MapConceptPreview.tsx';
import { PokedexControlsDrawer } from './components/PokedexControlsDrawer.jsx';
import { usePokemonGame } from './hooks/usePokemonGame.js';
import { useSpeechRecognition } from './hooks/useSpeechRecognition.js';
import { useWhosThatPokemonMode } from './hooks/useWhosThatPokemonMode.ts';
import { useThemedChallengesMode } from './hooks/useThemedChallengesMode.ts';
import { useDailyTriviaMode } from './hooks/useDailyTriviaMode.ts';
import { useProfessorIntroduction } from './hooks/useProfessorIntroduction.ts';
import { ACV } from '../scripts/achievements-logic.js';
import { getPokemonEntryState } from './domain/research/pokemonEntryState.ts';
import {
  TIMED_COLLECTOR_MODE_ID,
  DAILY_TRIVIA_MODE_ID,
  THEMED_CHALLENGES_MODE_ID,
  WHOS_THAT_POKEMON_MODE_ID,
  confirmModeStart,
  getModeDefinition,
} from './domain/modes/modeDefinitions.ts';
import {
  beginBrowserExpedition,
  deleteAllBrowserPokeVoiceData,
  endBrowserExpeditionWithReport,
  getBrowserPokeVoiceSave,
  resolveBrowserExpressionTrigger,
} from './store/browserPokeVoiceSaveStore.js';
import { browserDiscoveryStore } from './store/browserDiscoveryStore.ts';
import { LOCAL_POKEMON_CATALOG } from './services/pokemonCatalog.ts';
import { createPokemonNameIndex, resolveGuessTranscript } from './domain/discovery/resolvePokemonGuess.ts';
import { toLegacyPokemonList } from './domain/catalog/pokemonCatalogModel.ts';
import { CAMPHOR_PROLOGUE_MISSION } from './data/adventure/camphorPrologue.ts';
import { getPokeDiscoverRewardPackage } from './data/adventure/rewardBalance.ts';
import { getKnownPokeDiscoverMissionIds } from './data/adventure/missionCatalog.ts';
import {
  buildExpeditionHash,
  buildMissionHash,
  buildPokeDiscoverHash,
  parseAdventureHashRoute,
  replaceWithPokedexRoute,
} from './domain/expeditions/adventureHashRoutes.ts';

const localPokemonNameIndex = createPokemonNameIndex(toLegacyPokemonList(LOCAL_POKEMON_CATALOG));

function formatTimer(left) {
  const safe = Math.max(0, Math.round(left || 0));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `⏱ ${minutes}:${String(seconds).padStart(2, '0')}`;
}

export default function App() {
  const [modesOpen, setModesOpen] = useState(false);
  const [controlsOpen, setControlsOpen] = useState(false);
  const [selectedPokemon, setSelectedPokemon] = useState(null);
  const [imageStyle, setImageStyle] = useState('3d');
  const [voiceSupportModalOpen, setVoiceSupportModalOpen] = useState(true);
  const [professorMissionsOpen, setProfessorMissionsOpen] = useState(false);
  const [mapConceptPreviewOpen, setMapConceptPreviewOpen] = useState(false);
  const [mapVisibleSpeciesIds, setMapVisibleSpeciesIds] = useState([]);
  const [mapExpression, setMapExpression] = useState(null);
  const [mapExpressionFeedback, setMapExpressionFeedback] = useState(null);
  const [expeditionReport, setExpeditionReport] = useState();
  const [adventureRoute, setAdventureRoute] = useState(() => parseAdventureHashRoute(window.location.hash));
  const game = usePokemonGame();

  useEffect(() => {
    const syncHashRoute = () => setAdventureRoute(parseAdventureHashRoute(window.location.hash));
    window.addEventListener('hashchange', syncHashRoute);
    return () => window.removeEventListener('hashchange', syncHashRoute);
  }, []);

  const resolveMapPokemon = useCallback((raw, { fromSpeech = false } = {}) => (
    resolveGuessTranscript(raw, localPokemonNameIndex, new Set(mapVisibleSpeciesIds), { fromSpeech })
  ), [mapVisibleSpeciesIds]);
  const identifyMapPokemon = useCallback(async (raw, { fromSpeech = false } = {}) => {
    const result = resolveMapPokemon(raw, { fromSpeech });
    if (!result.matched) return false;
    const visible = new Set(mapVisibleSpeciesIds);
    const candidates = result.sequence.filter(speciesId => visible.has(speciesId));
    if (!candidates.length) return true;
    for (const speciesId of candidates) {
      const discovered = browserDiscoveryStore.discover(speciesId);
      if (discovered) {
        const name = game.allPokemon.find(pokemon => pokemon.id === speciesId)?.name ?? raw;
        game.showToast(`¡${name} identificado en la expedición!`, 'ok');
      }
    }
    return true;
  }, [game.allPokemon, game.showToast, resolveMapPokemon]);
  const resolveMapInput = useCallback((raw, options = {}) => {
    if (mapExpression && String(raw ?? '').trim()) return { matched: true, sequence: [] };
    return resolveMapPokemon(raw, options);
  }, [mapExpression, resolveMapPokemon]);
  const submitMapInput = useCallback(async (raw, { fromSpeech = false } = {}) => {
    if (!mapExpression) return identifyMapPokemon(raw, { fromSpeech });
    const result = resolveBrowserExpressionTrigger({
      mapId: TEGUESTE_FOREST_PREVIEW_MAP_ID,
      trigger: mapExpression,
      attempt: { method: fromSpeech ? 'voice' : 'text', transcript: raw },
      resolvedAt: new Date().toISOString(),
      rewards: getPokeDiscoverRewardPackage(mapExpression.rewardPackageId),
    });
    const successful = result.status === 'resolved' || result.status === 'alreadyResolved';
    setMapExpressionFeedback({
      status: result.status,
      understoodText: result.understoodText,
      message: successful
        ? (mapExpression.successText ?? 'El Pokémon ha reaccionado a tus palabras.')
        : result.status === 'notMatched'
          ? (mapExpression.retryText ?? 'No parece ser lo que esperaba oír.')
          : 'Ahora mismo no puedes resolver esta interacción de esa forma.',
      nonce: Date.now(),
    });
    return true;
  }, [identifyMapPokemon, mapExpression]);
  const useMapExpressionFallback = useCallback(() => {
    if (!mapExpression?.fallbackActionId) return;
    const result = resolveBrowserExpressionTrigger({
      mapId: TEGUESTE_FOREST_PREVIEW_MAP_ID,
      trigger: mapExpression,
      attempt: { method: 'contextAction', contextActionId: mapExpression.fallbackActionId },
      resolvedAt: new Date().toISOString(),
      rewards: getPokeDiscoverRewardPackage(mapExpression.rewardPackageId),
    });
    const successful = result.status === 'resolved' || result.status === 'alreadyResolved';
    setMapExpressionFeedback({
      status: result.status,
      message: successful
        ? (mapExpression.successText ?? 'El Pokémon ha reaccionado a tu gesto.')
        : 'Ahora mismo no puedes resolver esta interacción de esa forma.',
      nonce: Date.now(),
    });
  }, [mapExpression]);
  const submitMapAcousticExpression = useCallback(features => {
    if (!mapExpression) return;
    const result = resolveBrowserExpressionTrigger({
      mapId: TEGUESTE_FOREST_PREVIEW_MAP_ID,
      trigger: mapExpression,
      attempt: { method: 'voice', acoustic: features },
      resolvedAt: new Date().toISOString(),
      rewards: getPokeDiscoverRewardPackage(mapExpression.rewardPackageId),
    });
    const successful = result.status === 'resolved' || result.status === 'alreadyResolved';
    setMapExpressionFeedback({
      status: result.status,
      message: successful
        ? (mapExpression.successText ?? 'El Pokémon ha reaccionado al sonido.')
        : result.status === 'notMatched'
          ? (mapExpression.retryText ?? 'El sonido no ha producido la reacción esperada.')
          : 'Ahora mismo no puedes resolver esta interacción de esa forma.',
      acoustic: features,
      nonce: Date.now(),
    });
  }, [mapExpression]);
  const whosThatPokemon = useWhosThatPokemonMode({
    resolveGuess: game.tryGuessTranscript,
    discoverPokemon: game.discoverPokemon,
    registerFailedGuess: game.registerFailedGuess,
    showToast: game.showToast,
  });
  const themedChallenges = useThemedChallengesMode({
    resolveGuess: game.tryGuessTranscript,
    discoverPokemon: game.discoverPokemon,
    showToast: game.showToast,
  });
  const dailyTrivia = useDailyTriviaMode({
    resolveGuess: game.tryGuessTranscript,
    discoverPokemon: game.discoverPokemon,
    showToast: game.showToast,
  });
  const speech = useSpeechRecognition({
    allPokemon: game.allPokemon,
    guess: mapConceptPreviewOpen
      ? submitMapInput
      : dailyTrivia.active
      ? dailyTrivia.submitAnswer
      : themedChallenges.active
        ? themedChallenges.submitAnswer
        : whosThatPokemon.active
          ? whosThatPokemon.submitAnswer
          : game.guess,
    tryGuessTranscript: mapConceptPreviewOpen ? resolveMapInput : game.tryGuessTranscript,
    showToast: game.showToast,
  });
  const startMapExpression = useCallback(trigger => {
    speech.stopListening();
    setMapExpression(trigger);
    setMapExpressionFeedback(null);
  }, [speech.stopListening]);
  const endMapExpression = useCallback(() => {
    speech.stopListening();
    setMapExpression(null);
    setMapExpressionFeedback(null);
  }, [speech.stopListening]);
  const narrativeCanPresent = !game.timer
    && !game.timedCountdown
    && !whosThatPokemon.active
    && !themedChallenges.active
    && !dailyTrivia.active
    && !game.specialEffects.length
    && !game.timedResults
    && !game.delibirdMode
    && !game.psyduckMode
    && !game.sleepMode
    && !selectedPokemon
    && !modesOpen
    && !controlsOpen
    && !professorMissionsOpen
    && !mapConceptPreviewOpen
    && !game.lastRevealedId
    && game.specialEffects.length === 0
    && (!voiceSupportModalOpen || speech.speechSupported);
  const professor = useProfessorIntroduction({
    discoveryCount: game.globalScore,
    canPresent: narrativeCanPresent,
    ignoreNewDiscoveries: Boolean(game.timer || game.timedCountdown),
  });
  useEffect(() => {
    if (professor.active) return;
    if (adventureRoute.kind === 'pokeDiscover' || adventureRoute.kind === 'mission') {
      setMapConceptPreviewOpen(false);
      setProfessorMissionsOpen(true);
      return;
    }
    if (
      adventureRoute.kind === 'expedition'
      && adventureRoute.mapId === TEGUESTE_FOREST_PREVIEW_MAP_ID
      && adventureRoute.roomId === TEGUESTE_FOREST_PREVIEW_ROOM_ID
    ) {
      setProfessorMissionsOpen(false);
      setMapConceptPreviewOpen(true);
      return;
    }
    setProfessorMissionsOpen(false);
    setMapConceptPreviewOpen(false);
  }, [adventureRoute, professor.active]);
  useEffect(() => {
    if (professor.incomingCall || professor.active) speech.stopListening();
  }, [professor.active, professor.incomingCall, speech.stopListening]);
  const selectedEntryState = selectedPokemon
    ? getPokemonEntryState(getBrowserPokeVoiceSave(), selectedPokemon.id)
    : null;
  const professorProgress = getBrowserPokeVoiceSave().pokeDiscover;
  const knownProfessorMissionIds = getKnownPokeDiscoverMissionIds(getBrowserPokeVoiceSave());

  const closeNavigationLayers = () => {
    setModesOpen(false);
    setControlsOpen(false);
    setProfessorMissionsOpen(false);
    ACV.closeDrawer?.();
  };

  const navigateAdventure = useCallback(hash => {
    if (window.location.hash === hash) {
      setAdventureRoute(parseAdventureHashRoute(hash));
      return;
    }
    window.location.hash = hash;
  }, []);

  const closeAdventureRoute = useCallback(() => {
    setAdventureRoute(replaceWithPokedexRoute());
  }, []);

  const openTeguesteForest = useCallback(() => {
    const save = getBrowserPokeVoiceSave();
    const progress = save.pokeDiscover.mapProgress[TEGUESTE_FOREST_PREVIEW_MAP_ID];
    if (progress?.freeExpeditionUnlocked && !save.activeExpeditionSession) {
      try {
        beginBrowserExpedition({
          mapId: TEGUESTE_FOREST_PREVIEW_MAP_ID,
          enteredAt: new Date().toISOString(),
        });
      } catch (error) {
        game.showToast(error instanceof Error ? error.message : 'No se pudo preparar la expedición.', 'bad');
        navigateAdventure(buildPokeDiscoverHash());
        return;
      }
    }
    navigateAdventure(buildExpeditionHash(
      TEGUESTE_FOREST_PREVIEW_MAP_ID,
      TEGUESTE_FOREST_PREVIEW_ROOM_ID,
    ));
  }, [game.showToast, navigateAdventure]);

  const leaveTeguesteForest = useCallback(() => {
    speech.stopListening();
    setMapVisibleSpeciesIds([]);
    setMapExpression(null);
    setMapExpressionFeedback(null);
    const save = getBrowserPokeVoiceSave();
    if (save.activeExpeditionSession?.mapId === TEGUESTE_FOREST_PREVIEW_MAP_ID) {
      const result = endBrowserExpeditionWithReport({ exitedAt: new Date().toISOString() });
      setExpeditionReport(result.report);
    }
    closeAdventureRoute();
  }, [closeAdventureRoute, speech.stopListening]);

  const openPokemonDetails = pokemon => {
    if (game.guessed.has(pokemon.id)) professor.requestFromDetail(game.globalScore);
    setSelectedPokemon(pokemon);
  };

  const resetWithConfirm = () => {
    if (window.confirm('Esto iniciará una nueva run de Pokédex: se vaciarán los Pokémon registrados, el orden, las rachas y el acompañante equipado. Conservarás PokeDiscover completo: logros, investigación, mapas, nivel, PD, herramientas y objetos. ¿Continuar?')) {
      game.resetProgress();
    }
  };

  const deleteAllWithConfirm = () => {
    const confirmation = window.prompt('BORRADO TOTAL: se eliminarán la Pokédex actual y PokeDiscover completo, incluidos logros, investigación, mapas, secretos, nivel, PD, herramientas, objetos, permisos, cosméticos y preferencias. Esta acción no se puede deshacer. Escribe BORRAR para continuar.');
    if (confirmation !== 'BORRAR') return;
    deleteAllBrowserPokeVoiceData();
    window.location.reload();
  };

  const startMode = modeId => {
    const definition = getModeDefinition(modeId);
    if (!definition || !confirmModeStart(definition, message => window.confirm(message))) return;
    if (modeId === TIMED_COLLECTOR_MODE_ID && game.startTimed()) setModesOpen(false);
    if (modeId === WHOS_THAT_POKEMON_MODE_ID && whosThatPokemon.start(game.allPokemon)) setModesOpen(false);
    if (modeId === THEMED_CHALLENGES_MODE_ID && themedChallenges.start(game.allPokemon)) setModesOpen(false);
    if (modeId === DAILY_TRIVIA_MODE_ID && dailyTrivia.start(game.allPokemon)) setModesOpen(false);
  };

  const toggleModes = () => {
    setModesOpen(current => {
      const next = !current;
      if (next) {
        setControlsOpen(false);
        ACV.closeDrawer?.();
      }
      return next;
    });
  };

  const openProfessorMissions = () => {
    closeNavigationLayers();
    if (professor.answerCall()) return;
    if (professor.requestProfileSetup()) return;
    navigateAdventure(buildPokeDiscoverHash());
  };

  const answerProfessorCall = () => {
    speech.stopListening();
    setSelectedPokemon(null);
    closeNavigationLayers();
    professor.answerCall();
  };

  const closeModes = () => {
    setModesOpen(false);
  };

  const openAchievements = () => {
    closeModes();
    setControlsOpen(false);
    ACV.toggleDrawer?.();
  };

  const toggleControls = () => {
    setControlsOpen(current => {
      const next = !current;
      if (next) {
        closeModes();
        ACV.closeDrawer?.();
      }
      return next;
    });
  };

  const selectGeneration = generation => {
    game.setActiveGeneration(generation);
    setControlsOpen(false);
  };

  const toggleMic = () => {
    game.enableAudio();
    speech.toggleListening();
  };

  const closeWhosThatPokemon = () => {
    if (speech.listening) void speech.toggleListening();
    whosThatPokemon.close();
  };

  const closeThemedChallenges = () => {
    if (speech.listening) void speech.toggleListening();
    themedChallenges.close();
  };

  const closeDailyTrivia = () => {
    if (speech.listening) void speech.toggleListening();
    dailyTrivia.close();
  };

  return (
    <>
      {!game.timer && !game.timedCountdown && !professor.active && <Dock
        score={game.score}
        remaining={game.remaining}
        onModes={toggleModes}
        professorAvailable={professor.accepted}
        professorNotification={professor.hasNotification}
        onProfessor={openProfessorMissions}
        onAchievements={openAchievements}
        controlsOpen={controlsOpen}
        onControls={toggleControls}
        onNavigate={game.navigateCards}
        timerText={game.timer ? formatTimer(game.timerLeft) : ''}
        timerDanger={game.timerLeft <= 10}
      />}
      {game.timedCountdown && (
        <div className="timed-countdown" role="status" aria-live="assertive" aria-label="Cuenta atrás del Coleccionista">
          <strong key={game.timedCountdown}>{game.timedCountdown}</strong>
        </div>
      )}
      {game.timer && (
        <div className="timed-mode-hud" aria-label="Controles del Coleccionista">
          <span className={`chip timer-chip ${game.timerLeft <= 10 ? 'danger' : ''}`}>{formatTimer(game.timerLeft)}</span>
          <button type="button" className="timed-mode-exit" aria-label="Finalizar Coleccionista" onClick={game.finishTimedEarly}>×</button>
        </div>
      )}
      {!professor.active && professor.incomingCall && (
        <ProfessorIncomingCall onAnswer={answerProfessorCall} />
      )}
      {!professor.active && !speech.speechSupported && voiceSupportModalOpen && (
        <div className="pv-modal" id="voice-support-modal">
          <div className="pv-modal__backdrop" onClick={() => setVoiceSupportModalOpen(false)} />
          <div className="pv-modal__panel pv-modal__panel--compact" role="dialog" aria-modal="true" aria-labelledby="voice-support-title">
            <header className="pv-modal__head">
              <h3 id="voice-support-title">Voz no disponible</h3>
              <button className="pv-modal__close" type="button" aria-label="Cerrar" onClick={() => setVoiceSupportModalOpen(false)}>×</button>
            </header>
            <div className="pv-modal__body browser-voice-modal">
              <p>El reconocimiento por micrófono solo funciona en Chrome.</p>
              <p className="muted">Puedes seguir descubriendo Pokemon escribiendo nombres en el campo de texto.</p>
            </div>
            <footer className="pv-modal__foot">
              <button className="pv-modal__primary" type="button" onClick={() => setVoiceSupportModalOpen(false)}>Entendido</button>
            </footer>
          </div>
        </div>
      )}
      {game.loadingError ? (
        <main><div className="load-error">{game.loadingError}</div></main>
      ) : (
        <PokemonGrid
          list={game.filteredList}
          guessed={game.guessed}
          lastRevealedId={game.lastRevealedId}
          focusedCardId={game.focusedCardId}
          cardRefs={game.cardRefs}
          onOpenDetails={openPokemonDetails}
          sleepMode={game.sleepMode}
          imageStyle={imageStyle}
          cinematic={professor.active}
          discoveryConsole={{
            generation: game.activeGeneration,
            listening: speech.listening,
            speechSupported: speech.speechSupported,
            voiceStatus: speech.voiceStatus,
            guessText: game.guessText,
            onGuessText: game.setGuessText,
            onGuess: game.handleGuessSubmit,
            onMic: toggleMic,
            onGenerationChange: selectGeneration,
            audioBlocked: game.audioBlocked,
            onEnableAudio: game.enableAudio,
            imageStyle,
            onImageStyle: setImageStyle,
          }}
        />
      )}
      {!professor.active && <PokemonDetailModal
        pokemon={selectedPokemon}
        discovered={selectedPokemon ? game.guessed.has(selectedPokemon.id) : false}
        entryState={selectedEntryState}
        onClose={() => setSelectedPokemon(null)}
        onCry={game.replayPokemonCry}
      />}
      {!professor.active && <PokedexControlsDrawer
        open={controlsOpen}
        onClose={() => setControlsOpen(false)}
        generation={game.activeGeneration}
        discovered={game.score}
        total={game.filteredList.length}
        globalDiscovered={game.globalScore}
        globalTotal={game.globalTotal}
        onGenerationChange={selectGeneration}
        cardSize={game.cardSize}
        imageStyle={imageStyle}
        onCardSize={game.setCardSize}
        onDeleteAll={deleteAllWithConfirm}
        onImageStyle={setImageStyle}
        onReset={resetWithConfirm}
      />}
      {!professor.active && <AchievementsDrawer />}
      {!professor.active && <ModesDrawer open={modesOpen} onClose={closeModes} onStartMode={startMode} />}
      <ProfessorMissionModal
        open={professorMissionsOpen && !professor.active}
        missionIds={knownProfessorMissionIds}
        catalog={game.pokemonCatalog}
        initialSection={adventureRoute.kind === 'mission' ? 'missions' : 'home'}
        selectedMissionId={adventureRoute.kind === 'mission' ? adventureRoute.missionId : undefined}
        onOpenMission={missionId => navigateAdventure(buildMissionHash(missionId))}
        onOpenMapPreview={openTeguesteForest}
        onClose={closeAdventureRoute}
      />
      <MapConceptPreview
        open={mapConceptPreviewOpen && !professor.active}
        listening={speech.listening}
        speechSupported={speech.speechSupported}
        onMic={toggleMic}
        onSubmitText={submitMapInput}
        onVisibleSpeciesIdsChange={setMapVisibleSpeciesIds}
        onInteractionStart={speech.stopListening}
        onExpressionStart={startMapExpression}
        onExpressionEnd={endMapExpression}
        onExpressionFallback={useMapExpressionFallback}
        onExpressionAcoustic={submitMapAcousticExpression}
        expressionFeedback={mapExpressionFeedback}
        loadingText={CAMPHOR_PROLOGUE_MISSION.loadingText}
        catalog={game.pokemonCatalog}
        onClose={leaveTeguesteForest}
      />
      <ExpeditionReportModal report={expeditionReport} onClose={() => setExpeditionReport(undefined)} />
      <NarrativeScene
        open={professor.active}
        sequence={professor.activeSequence}
        page={professor.activePage}
        onAdvance={professor.advance}
        onChoice={professor.choose}
        onTextSubmit={professor.submitTextInput}
        onDismiss={professor.dismiss}
        trainerProfile={professor.trainerProfile}
      />
      <TimedModal
        open={!!game.timedResults}
        results={game.timedResults}
        onClose={game.closeTimedResults}
      />
      <WhosThatPokemonMode
        open={whosThatPokemon.active}
        busy={whosThatPokemon.busy}
        currentRound={whosThatPokemon.currentRound}
        session={whosThatPokemon.session}
        visibleHints={whosThatPokemon.visibleHints}
        listening={speech.listening}
        speechSupported={speech.speechSupported}
        voiceStatus={speech.voiceStatus}
        onAnswer={whosThatPokemon.submitAnswer}
        onClose={closeWhosThatPokemon}
        onCry={whosThatPokemon.requestCry}
        onHint={whosThatPokemon.requestHint}
        onMic={speech.toggleListening}
        onNext={whosThatPokemon.nextRound}
        onSkip={whosThatPokemon.skipRound}
        onTypeHint={whosThatPokemon.requestTypeHint}
      />
      <ThemedChallengesMode
        open={themedChallenges.active}
        busy={themedChallenges.busy}
        session={themedChallenges.session}
        foundPokemon={themedChallenges.foundPokemon}
        listening={speech.listening}
        speechSupported={speech.speechSupported}
        voiceStatus={speech.voiceStatus}
        onAnswer={themedChallenges.submitAnswer}
        onClose={closeThemedChallenges}
        onMic={speech.toggleListening}
        onReturnToSelection={themedChallenges.returnToSelection}
        onSelectChallenge={themedChallenges.selectChallenge}
      />
      <ThemedChallengesMode
        variant="daily"
        open={dailyTrivia.active}
        busy={dailyTrivia.busy}
        session={dailyTrivia.session}
        foundPokemon={dailyTrivia.foundPokemon}
        listening={speech.listening}
        speechSupported={speech.speechSupported}
        voiceStatus={speech.voiceStatus}
        onAnswer={dailyTrivia.submitAnswer}
        onClose={closeDailyTrivia}
        onMic={speech.toggleListening}
        onReturnToSelection={closeDailyTrivia}
        onSelectChallenge={() => {}}
      />
      <SpecialEffectsLayer
        effects={game.specialEffects}
        easterEggState={game.easterEggState}
        onCoinCollect={() => game.updateEasterEggState(current => ({
          ...current,
          meowthCoins: (current.meowthCoins || 0) + 1,
        }))}
        onGimmighoulCoinCollect={game.collectGimmighoulCoin}
        onEffectDone={game.dismissSpecialEffect}
      />
      <PsyduckMode active={game.psyduckMode} onDisable={() => game.setPsyduckMode(false)} />
      <SleepMode active={game.sleepMode} onWake={() => game.setSleepMode(false)} />
      <DelibirdMode
        active={game.delibirdMode}
        onWin={async () => {
          const unlocked = await ACV.unlock?.('delibird-gift-claim');
          if (!unlocked) game.showToast('Ya habías reclamado el regalo bueno de Delibird.', 'ok');
        }}
        onClose={() => game.setDelibirdMode(false)}
      />
      {!professor.active && <AchievementToasts />}
      {!professor.active && <Toast toast={game.toast} />}
      {!professor.active && <footer className="footer">Imágenes: PokeAPI official artwork y sprites. Progreso guardado en tu navegador.</footer>}
    </>
  );
}
