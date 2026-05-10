import { useEffect } from 'react';
import { GengarScare } from './GengarScare.jsx';

function TimedEffect({ effect, onDone, children }) {
  useEffect(() => {
    const timer = window.setTimeout(() => onDone(effect.key), effect.durationMs || 2200);
    return () => window.clearTimeout(timer);
  }, [effect.durationMs, effect.key, onDone]);

  return children;
}

function LeafBurst({ effect, onDone }) {
  return (
    <TimedEffect effect={effect} onDone={onDone}>
      <div className="effect effect--leaf-burst">
        <span /><span /><span /><span /><span /><span />
      </div>
    </TimedEffect>
  );
}

function EmberBurst({ effect, onDone }) {
  return (
    <TimedEffect effect={effect} onDone={onDone}>
      <div className="effect effect--ember-burst">
        <span /><span /><span /><span /><span />
      </div>
    </TimedEffect>
  );
}

function WaterSplash({ effect, onDone }) {
  return (
    <TimedEffect effect={effect} onDone={onDone}>
      <div className="effect effect--water-splash">
        <span /><span /><span /><span /><span />
      </div>
    </TimedEffect>
  );
}

function SleepWave({ effect, onDone }) {
  return (
    <TimedEffect effect={effect} onDone={onDone}>
      <div className="effect effect--sleep-wave">
        <span>Zzz</span><span>Zzz</span><span>Zzz</span>
      </div>
    </TimedEffect>
  );
}

function MeowthCoin({ effect, onDone, onCoinCollect }) {
  return (
    <TimedEffect effect={effect} onDone={onDone}>
      <button
        className="effect effect--meowth-coin"
        type="button"
        aria-label="Recoger moneda"
        onClick={() => {
          onCoinCollect();
          onDone(effect.key);
        }}
      >
        ₽
      </button>
    </TimedEffect>
  );
}

function PsyduckThink({ effect, onDone }) {
  return (
    <TimedEffect effect={effect} onDone={onDone}>
      <div className="effect effect--psyduck-think">
        <span>?</span>
      </div>
    </TimedEffect>
  );
}

function SnorlaxNap({ effect, onDone }) {
  return (
    <TimedEffect effect={effect} onDone={onDone}>
      <div className="effect effect--snorlax-nap">
        <div>Snorlax está durmiendo...</div>
        <span>Z</span><span>Z</span><span>Z</span>
      </div>
    </TimedEffect>
  );
}

function SpecialEffect({ effect, onDone, onCoinCollect }) {
  if (effect.type === 'gengar-scare') {
    return <GengarScare active onDone={() => onDone(effect.key)} />;
  }
  if (effect.type === 'bulbasaur-leaf-burst') return <LeafBurst effect={effect} onDone={onDone} />;
  if (effect.type === 'charmander-ember-burst') return <EmberBurst effect={effect} onDone={onDone} />;
  if (effect.type === 'squirtle-water-splash') return <WaterSplash effect={effect} onDone={onDone} />;
  if (effect.type === 'jigglypuff-sleep-wave') return <SleepWave effect={effect} onDone={onDone} />;
  if (effect.type === 'meowth-coin') return <MeowthCoin effect={effect} onDone={onDone} onCoinCollect={onCoinCollect} />;
  if (effect.type === 'psyduck-think') return <PsyduckThink effect={effect} onDone={onDone} />;
  if (effect.type === 'snorlax-nap') return <SnorlaxNap effect={effect} onDone={onDone} />;
  return null;
}

export function SpecialEffectsLayer({ effects, easterEggState, onCoinCollect, onEffectDone }) {
  const hasCoinCounter = (easterEggState?.meowthCoins || 0) > 0;
  if (!effects.length && !hasCoinCounter) return null;

  return (
    <div className="special-effects-layer">
      {effects.map(effect => (
        <SpecialEffect key={effect.key} effect={effect} onDone={onEffectDone} onCoinCollect={onCoinCollect} />
      ))}
      {hasCoinCounter && <div className="meowth-coin-counter">₽ {easterEggState.meowthCoins}</div>}
    </div>
  );
}
