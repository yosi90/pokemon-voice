import { useEffect, useRef, useState } from 'react';
import { ART_URL, CASTFORM_IMAGE_URLS, PIKACHU_IMAGE_URLS, ROTOM_FORM_IDS, ROTOM_IMAGE_URLS, SPRITE_ANIMATED_URL, SPRITE_URL } from '../../scripts/utils.js';
import { formatDex } from '../lib/pokemon.js';
import { getPokemonSpecial } from '../lib/pokemonSpecials.js';
import { usePokeballMotion } from '../hooks/usePokeballMotion.js';
import { DiscoveryConsole } from './DiscoveryConsole.jsx';
import { PikachuElectricBurst } from './PikachuElectricBurst.tsx';

const getPokemonImageSrc = ({ pokemonId, imageStyle, spriteFallbackStep }) => {
  const spritePokemonId = pokemonId === 479 ? ROTOM_FORM_IDS[0] : pokemonId;

  if (imageStyle === 'sprite') {
    if (spriteFallbackStep === 0) return SPRITE_ANIMATED_URL(spritePokemonId);
    if (spriteFallbackStep === 1) return SPRITE_URL(spritePokemonId);
  }

  if (imageStyle === '3d' && pokemonId === 25) {
    return PIKACHU_IMAGE_URLS[0];
  }

  if (imageStyle === '3d' && pokemonId === 351) {
    return CASTFORM_IMAGE_URLS[0];
  }

  if (pokemonId === 479) {
    return ROTOM_IMAGE_URLS[0];
  }

  return ART_URL(pokemonId);
};

function PokemonBallCard({ pokemon, discovered, revealing, focused, registerRef, onOpenDetails, sleepMode, imageStyle }) {
  const [spriteFallbackStep, setSpriteFallbackStep] = useState(0);
  const name = pokemon.name.replace(/-/g, ' ');
  const angryJigglypuffSrc = `${import.meta.env.BASE_URL}assets/images/jigglypuff.png`;
  const imageClassName = [
    'pokemon-art',
    sleepMode && pokemon.id === 39 ? 'pokemon-art--sleep-mode' : '',
    imageStyle === 'sprite' && !(sleepMode && pokemon.id === 39) ? 'pokemon-art--sprite' : '',
  ].filter(Boolean).join(' ');
  const artSrc = sleepMode && pokemon.id === 39
    ? angryJigglypuffSrc
    : getPokemonImageSrc({
      pokemonId: pokemon.id,
      imageStyle,
      spriteFallbackStep,
    });
  const special = getPokemonSpecial(pokemon.id);
  const className = [
    'pokemon-card',
    discovered ? 'discovered' : '',
    revealing ? 'revealing' : '',
    focused ? 'focused' : '',
    special.className,
  ].filter(Boolean).join(' ');

  useEffect(() => {
    setSpriteFallbackStep(0);
  }, [imageStyle, pokemon.id]);

  const handleImageError = () => {
    if (imageStyle === 'sprite') {
      setSpriteFallbackStep(currentStep => Math.min(currentStep + 1, 2));
    }
  };
  const handleKeyDown = event => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    onOpenDetails(pokemon);
  };

  return (
    <article
      ref={node => registerRef(pokemon.id, node)}
      className={className}
      data-id={pokemon.id}
      data-ball={special.ballVariant}
    >
      <div className="pokemon-stage">
        <div
          className="pokemon-ball-card"
          aria-label={discovered ? `Abrir ficha de ${name}` : `Abrir ficha de ${formatDex(pokemon.id)}`}
          role="button"
          tabIndex={0}
          title={discovered ? `Abrir ficha de ${name}` : 'Abrir entrada clasificada'}
          onClick={() => onOpenDetails(pokemon)}
          onKeyDown={handleKeyDown}
        >
          {pokemon.id === 25 && !discovered && <PikachuElectricBurst />}
          <div className="ball-motion" aria-hidden="true">
            <div className="ball-assembly">
              <div className="ball-shell ball-shell--top" />
              <div className="ball-shell ball-shell--bottom" />
              <div className="ball-band" />
              <div className="ball-button" />
              <div className="master-mark">M</div>
            </div>
            {pokemon.id === 25 && !discovered && <div className="pikachu-inner-flash" />}
          </div>
          <div className="electric-burst" />
          {special.localEffects.map(effect => (
            <div key={effect} className={`local-effect local-effect--${effect}`} />
          ))}
          <div className="reveal-glow" />
          {discovered && (
            <img
              className={imageClassName}
              src={artSrc}
              alt={name}
              loading="lazy"
              decoding="async"
              onError={handleImageError}
            />
          )}
        </div>
      </div>
      <div className="pokemon-caption">
        {discovered ? <span className="pokemon-name">{name}</span> : <span className="pokemon-number">{formatDex(pokemon.id)}</span>}
      </div>
    </article>
  );
}

export function PokemonGrid({ list, guessed, lastRevealedId, focusedCardId, cardRefs, onOpenDetails, sleepMode, imageStyle, discoveryConsole, cinematic = false }) {
  const gridRef = useRef(null);
  usePokeballMotion(gridRef);

  const registerRef = (id, node) => {
    if (node) cardRefs.current.set(id, node);
    else cardRefs.current.delete(id);
  };

  return (
    <main className={cinematic ? 'pokedex-cinematic-background' : ''} inert={cinematic ? true : undefined}>
      {!cinematic && <DiscoveryConsole {...discoveryConsole} />}
      <div ref={gridRef} id="grid" className="grid" aria-live="polite">
        {list.map(pokemon => (
          <PokemonBallCard
            key={pokemon.id}
            pokemon={pokemon}
            discovered={guessed.has(pokemon.id)}
            revealing={lastRevealedId === pokemon.id}
            focused={focusedCardId === pokemon.id}
            registerRef={registerRef}
            onOpenDetails={onOpenDetails}
            sleepMode={sleepMode}
            imageStyle={imageStyle}
          />
        ))}
      </div>
    </main>
  );
}
