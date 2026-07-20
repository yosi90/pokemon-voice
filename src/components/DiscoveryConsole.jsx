import { useEffect, useRef, useState } from 'react';
import {
  POKEMON_GENERATION_REGIONS,
  getPokemonGenerationRegion,
} from '../domain/catalog/pokemonGeneration.ts';
import { ImageStyleControl } from './ImageStyleControl.jsx';

export function DiscoveryConsole({
  generation,
  listening,
  speechSupported = true,
  voiceStatus,
  guessText,
  onGuessText,
  onGuess,
  onMic,
  audioBlocked,
  onEnableAudio,
  onGenerationChange,
  imageStyle,
  onImageStyle,
}) {
  const region = getPokemonGenerationRegion(generation);
  const [regionsOpen, setRegionsOpen] = useState(false);
  const regionPickerRef = useRef(null);

  useEffect(() => {
    if (!regionsOpen) return undefined;
    const closeOnOutsideClick = event => {
      if (!regionPickerRef.current?.contains(event.target)) setRegionsOpen(false);
    };
    const closeOnEscape = event => {
      if (event.key === 'Escape') setRegionsOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [regionsOpen]);

  return (
    <section className="discovery-console" aria-label="Descubrimiento por voz o texto">
      <div className="discovery-console__controls">
        {region && (
          <div className="discovery-console__region-picker" ref={regionPickerRef}>
            <button
              className="discovery-console__region"
              type="button"
              aria-haspopup="menu"
              aria-expanded={regionsOpen}
              onClick={() => setRegionsOpen(current => !current)}
            >
              <span>{region}</span>
              <span aria-hidden="true">▾</span>
            </button>
            {regionsOpen && (
              <div className="discovery-console__region-menu" role="menu" aria-label="Cambiar región">
                {Object.entries(POKEMON_GENERATION_REGIONS).map(([generationId, regionName]) => (
                  <button
                    key={generationId}
                    type="button"
                    role="menuitemradio"
                    aria-checked={Number(generationId) === generation}
                    aria-label={`${regionName}, generación ${generationId}`}
                    onClick={() => {
                      onGenerationChange?.(Number(generationId));
                      setRegionsOpen(false);
                    }}
                  >
                    <span>{regionName}</span>
                    <small>Gen. {generationId}</small>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        <button
          id="btnMic"
          className={`btn discovery-console__mic ${listening ? 'accent' : ''}`}
          type="button"
          onClick={onMic}
          disabled={!speechSupported}
          aria-label={listening ? 'Parar escucha' : 'Escuchar por micrófono'}
          title={speechSupported ? (listening ? 'Parar escucha' : 'Escuchar por micrófono') : 'Reconocimiento de voz disponible en Chrome'}
        >
          <span className={`control-icon mic-icon ${listening ? '' : 'mic-icon--off'}`} aria-hidden="true">🎙</span>
          <span>{listening ? 'Escuchando' : 'Hablar'}</span>
        </button>
        <form className="input-wrap discovery-console__input" onSubmit={onGuess}>
          <input
            id="txtGuess"
            type="text"
            placeholder="Escribe un nombre y pulsa Enter."
            autoComplete="off"
            value={guessText}
            onChange={event => onGuessText(event.target.value)}
          />
          <button id="btnGuess" className="btn" type="submit" aria-label="Adivinar" title="Adivinar">
            <span className="control-icon" aria-hidden="true">🔍</span>
          </button>
        </form>
        <ImageStyleControl
          className="discovery-console__image-style"
          imageStyle={imageStyle}
          name="consoleImageStyle"
          onImageStyle={onImageStyle}
        />
        <div className="discovery-console__feedback" aria-live="polite">
          {voiceStatus?.message && (
            <span className={`chip voice-status voice-status--${voiceStatus.kind || 'info'}`}>
              {voiceStatus.message}
            </span>
          )}
          {audioBlocked && (
            <button className="chip chip-click audio-chip" type="button" onClick={onEnableAudio} title="Activar sonido">
              Activar sonido
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
