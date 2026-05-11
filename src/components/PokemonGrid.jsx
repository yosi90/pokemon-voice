import { useEffect, useState } from 'react';
import { ART_URL, CASTFORM_IMAGE_URLS, PIKACHU_IMAGE_URLS, ROTOM_FORM_IDS, ROTOM_IMAGE_URLS, SPRITE_ANIMATED_URL, SPRITE_URL } from '../../scripts/utils.js';
import { formatDex } from '../lib/pokemon.js';
import { getPokemonSpecial } from '../lib/pokemonSpecials.js';

const randomImageIndex = (currentIndex, imageUrls) => {
  if (imageUrls.length < 2) return currentIndex;

  let nextIndex = currentIndex;
  while (nextIndex === currentIndex) {
    nextIndex = Math.floor(Math.random() * imageUrls.length);
  }
  return nextIndex;
};

const randomCastformFormIndex = (currentIndex) => {
  const weatherFormIndexes = [1, 2, 3];
  const candidates = weatherFormIndexes.filter(index => index !== currentIndex);
  return candidates[Math.floor(Math.random() * candidates.length)];
};

const getPokemonImageSrc = ({ pokemonId, imageStyle, spriteFallbackStep, specialImageIndex }) => {
  const spritePokemonId = pokemonId === 479 ? ROTOM_FORM_IDS[specialImageIndex] : pokemonId;

  if (imageStyle === 'sprite') {
    if (spriteFallbackStep === 0) return SPRITE_ANIMATED_URL(spritePokemonId);
    if (spriteFallbackStep === 1) return SPRITE_URL(spritePokemonId);
  }

  if (imageStyle === '3d' && pokemonId === 25) {
    return PIKACHU_IMAGE_URLS[specialImageIndex];
  }

  if (imageStyle === '3d' && pokemonId === 351) {
    return CASTFORM_IMAGE_URLS[specialImageIndex];
  }

  if (pokemonId === 479) {
    return ROTOM_IMAGE_URLS[specialImageIndex];
  }

  return ART_URL(pokemonId);
};

function PokemonBallCard({ pokemon, discovered, revealing, focused, registerRef, onReplayCry, sleepMode, imageStyle }) {
  const [specialImageIndex, setSpecialImageIndex] = useState(0);
  const [spriteFallbackStep, setSpriteFallbackStep] = useState(0);
  const name = pokemon.name.replace(/-/g, ' ');
  const angryJigglypuffSrc = `${import.meta.env.BASE_URL}assets/images/jigglypuff.png`;
  const isPikachu = pokemon.id === 25;
  const isCastform = pokemon.id === 351;
  const isRotom = pokemon.id === 479;
  const specialImageUrls = isPikachu ? PIKACHU_IMAGE_URLS : isCastform ? CASTFORM_IMAGE_URLS : isRotom ? ROTOM_IMAGE_URLS : null;
  const canRotateSpecialImage = (imageStyle === '3d' || isRotom) && !!specialImageUrls;
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
      specialImageIndex,
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
    setSpecialImageIndex(0);
  }, [imageStyle, pokemon.id]);

  const handleDiscoveredAction = () => {
    if (!discovered) return;

    let effectOptions = {};
    if (canRotateSpecialImage) {
      const nextIndex = isCastform
        ? randomCastformFormIndex(specialImageIndex)
        : randomImageIndex(specialImageIndex, specialImageUrls);
      setSpecialImageIndex(nextIndex);
      setSpriteFallbackStep(0);
      if (isCastform) effectOptions = { weather: nextIndex };
    }
    onReplayCry(pokemon.id, effectOptions);
  };
  const handleImageError = () => {
    if (imageStyle === 'sprite') {
      setSpriteFallbackStep(currentStep => Math.min(currentStep + 1, 2));
    }
  };
  const handleKeyDown = event => {
    if (!discovered || (event.key !== 'Enter' && event.key !== ' ')) return;
    event.preventDefault();
    handleDiscoveredAction();
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
          aria-label={discovered ? `${name}, reproducir sonido` : formatDex(pokemon.id)}
          role={discovered ? 'button' : undefined}
          tabIndex={discovered ? 0 : undefined}
          title={discovered ? canRotateSpecialImage ? `Cambiar imagen y reproducir cry de ${name}` : `Reproducir cry de ${name}` : undefined}
          onClick={handleDiscoveredAction}
          onKeyDown={handleKeyDown}
        >
          <div className="ball-shell ball-shell--top" />
          <div className="ball-shell ball-shell--bottom" />
          <div className="ball-band" />
          <div className="ball-button" />
          <div className="master-mark">M</div>
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

export function PokemonGrid({ list, guessed, lastRevealedId, focusedCardId, cardRefs, onReplayCry, sleepMode, imageStyle }) {
  const registerRef = (id, node) => {
    if (node) cardRefs.current.set(id, node);
    else cardRefs.current.delete(id);
  };

  return (
    <main>
      <div id="grid" className="grid" aria-live="polite">
        {list.map(pokemon => (
          <PokemonBallCard
            key={pokemon.id}
            pokemon={pokemon}
            discovered={guessed.has(pokemon.id)}
            revealing={lastRevealedId === pokemon.id}
            focused={focusedCardId === pokemon.id}
            registerRef={registerRef}
            onReplayCry={onReplayCry}
            sleepMode={sleepMode}
            imageStyle={imageStyle}
          />
        ))}
      </div>
    </main>
  );
}
