import { useState } from 'react';
import { Dock } from './components/Dock.jsx';
import { AchievementsDrawer, ModesDrawer } from './components/Drawers.jsx';
import { PokemonGrid } from './components/PokemonGrid.jsx';
import { SpecialEffectsLayer } from './components/SpecialEffectsLayer.jsx';
import { TimedModal } from './components/TimedModal.jsx';
import { Toast } from './components/Toast.jsx';
import { Topbar } from './components/Topbar.jsx';
import { usePokemonGame } from './hooks/usePokemonGame.js';
import { useSpeechRecognition } from './hooks/useSpeechRecognition.js';
import { ACV } from '../scripts/achievements-logic.js';

function formatTimer(left) {
  const safe = Math.max(0, Math.round(left || 0));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `⏱ ${minutes}:${String(seconds).padStart(2, '0')}`;
}

export default function App() {
  const [modesOpen, setModesOpen] = useState(false);
  const game = usePokemonGame();
  const speech = useSpeechRecognition({
    allPokemon: game.allPokemon,
    guess: game.guess,
    tryGuessTranscript: game.tryGuessTranscript,
    showToast: game.showToast,
  });

  const resetWithConfirm = () => {
    if (window.confirm('Esto borrará tu progreso y logros. ¿Seguro?')) {
      game.resetProgress();
    }
  };

  const startTimed = () => {
    if (game.startTimed()) setModesOpen(false);
  };

  const toggleModes = () => {
    setModesOpen(current => {
      const next = !current;
      if (next) ACV.closeDrawer?.();
      return next;
    });
  };

  const closeModes = () => {
    setModesOpen(false);
  };

  const toggleMic = () => {
    game.enableAudio();
    speech.toggleListening();
  };

  return (
    <>
      <Dock
        score={game.score}
        remaining={game.remaining}
        listening={speech.listening}
        voiceStatus={speech.voiceStatus}
        guessText={game.guessText}
        onGuessText={game.setGuessText}
        onGuess={game.handleGuessSubmit}
        onMic={toggleMic}
        onReset={resetWithConfirm}
        onModes={toggleModes}
        onAchievements={closeModes}
        onNavigate={game.navigateCards}
        audioBlocked={game.audioBlocked}
        onEnableAudio={game.enableAudio}
        timerText={game.timer ? formatTimer(game.timerLeft) : ''}
        timerDanger={game.timerLeft <= 10}
      />
      <Topbar
        selectedGens={game.selectedGens}
        cardSize={game.cardSize}
        onCardSize={game.setCardSize}
        onToggleGen={game.toggleGen}
      />
      {game.loadingError ? (
        <main><div className="load-error">{game.loadingError}</div></main>
      ) : (
        <PokemonGrid
          list={game.filteredList}
          guessed={game.guessed}
          lastRevealedId={game.lastRevealedId}
          cardRefs={game.cardRefs}
        />
      )}
      <AchievementsDrawer />
      <ModesDrawer open={modesOpen} onClose={closeModes} onStartTimed={startTimed} />
      <TimedModal
        open={!!game.timedResults}
        discovered={game.timedResults?.discovered || 0}
        achievements={game.timedResults?.achievements || []}
        onClose={game.closeTimedResults}
      />
      <SpecialEffectsLayer
        effects={game.specialEffects}
        easterEggState={game.easterEggState}
        onCoinCollect={() => game.updateEasterEggState(current => ({
          ...current,
          meowthCoins: (current.meowthCoins || 0) + 1,
        }))}
        onEffectDone={game.dismissSpecialEffect}
      />
      <div id="acv-toast-container" aria-live="polite" aria-atomic="true" />
      <Toast toast={game.toast} />
      <footer className="footer">Imágenes: PokeAPI official artwork. Progreso guardado en tu navegador.</footer>
    </>
  );
}
