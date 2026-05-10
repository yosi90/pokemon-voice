import { ART_URL } from '../../scripts/utils.js';
import { formatDex } from '../lib/pokemon.js';
import { getPokemonSpecial } from '../lib/pokemonSpecials.js';

function PokemonBallCard({ pokemon, discovered, revealing, registerRef }) {
  const name = pokemon.name.replace(/-/g, ' ');
  const special = getPokemonSpecial(pokemon.id);
  const className = [
    'pokemon-card',
    discovered ? 'discovered' : '',
    revealing ? 'revealing' : '',
    special.className,
  ].filter(Boolean).join(' ');

  return (
    <article
      ref={node => registerRef(pokemon.id, node)}
      className={className}
      data-id={pokemon.id}
      data-ball={special.ballVariant}
    >
      <div className="pokemon-stage">
        <div className="pokemon-ball-card" aria-label={discovered ? name : formatDex(pokemon.id)}>
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
              className="pokemon-art"
              src={ART_URL(pokemon.id)}
              alt={name}
              loading="lazy"
              decoding="async"
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

export function PokemonGrid({ list, guessed, lastRevealedId, cardRefs }) {
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
            registerRef={registerRef}
          />
        ))}
      </div>
    </main>
  );
}
