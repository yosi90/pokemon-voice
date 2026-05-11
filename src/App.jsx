import { useState } from 'react';
import { Dock } from './components/Dock.jsx';
import { DelibirdMode } from './components/DelibirdMode.jsx';
import { AchievementsDrawer, ModesDrawer } from './components/Drawers.jsx';
import { PokemonGrid } from './components/PokemonGrid.jsx';
import { PsyduckMode } from './components/PsyduckMode.jsx';
import { SleepMode } from './components/SleepMode.jsx';
import { SpecialEffectsLayer } from './components/SpecialEffectsLayer.jsx';
import { TimedModal } from './components/TimedModal.jsx';
import { Toast } from './components/Toast.jsx';
import { SecondaryControlsMenu } from './components/Topbar.jsx';
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
  const [imageStyle, setImageStyle] = useState('3d');
  const [voiceSupportModalOpen, setVoiceSupportModalOpen] = useState(true);
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

  const openAchievements = () => {
    closeModes();
    ACV.openDrawer?.();
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
        speechSupported={speech.speechSupported}
        voiceStatus={speech.voiceStatus}
        guessText={game.guessText}
        onGuessText={game.setGuessText}
        onGuess={game.handleGuessSubmit}
        onMic={toggleMic}
        onReset={resetWithConfirm}
        onModes={toggleModes}
        onAchievements={openAchievements}
        onNavigate={game.navigateCards}
        audioBlocked={game.audioBlocked}
        onEnableAudio={game.enableAudio}
        timerText={game.timer ? formatTimer(game.timerLeft) : ''}
        timerDanger={game.timerLeft <= 10}
      />
      {!speech.speechSupported && voiceSupportModalOpen && (
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
          onReplayCry={game.replayPokemonCry}
          sleepMode={game.sleepMode}
          imageStyle={imageStyle}
        />
      )}
      <SecondaryControlsMenu
        selectedGens={game.selectedGens}
        cardSize={game.cardSize}
        imageStyle={imageStyle}
        onCardSize={game.setCardSize}
        onImageStyle={setImageStyle}
        onToggleGen={game.toggleGen}
      />
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
      <div id="acv-toast-container" aria-live="polite" aria-atomic="true" />
      <Toast toast={game.toast} />
      <footer className="footer">Imágenes: PokeAPI official artwork y sprites. Progreso guardado en tu navegador.</footer>
    </>
  );
}
