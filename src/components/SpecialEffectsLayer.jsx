import { useEffect, useState } from 'react';
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
        <span /><span /><span /><span /><span /><span /><span />
        <span /><span /><span /><span /><span /><span /><span />
      </div>
    </TimedEffect>
  );
}

function EmberBurst({ effect, onDone }) {
  return (
    <TimedEffect effect={effect} onDone={onDone}>
      <div className="effect effect--ember-burst">
        <div className="inferno-floor" />
        <span /><span /><span /><span /><span /><span />
        <span /><span /><span /><span /><span /><span />
      </div>
    </TimedEffect>
  );
}

function PetalBurst({ effect, onDone }) {
  return (
    <TimedEffect effect={effect} onDone={onDone}>
      <div className="effect effect--petal-burst">
        <span /><span /><span /><span /><span /><span /><span /><span />
      </div>
    </TimedEffect>
  );
}

function StarterFireBurst({ effect, onDone }) {
  return (
    <TimedEffect effect={effect} onDone={onDone}>
      <div className="effect effect--starter-fire-burst">
        <div className="inferno-floor" />
        <span /><span /><span /><span /><span /><span />
        <span /><span /><span /><span />
      </div>
    </TimedEffect>
  );
}

function WaterSplash({ effect, onDone }) {
  return (
    <TimedEffect effect={effect} onDone={onDone}>
      <div className="effect effect--water-splash">
        <div className="waterfall-sheet" />
        <span /><span /><span /><span /><span />
      </div>
    </TimedEffect>
  );
}

function StarterWaterBurst({ effect, onDone }) {
  return (
    <TimedEffect effect={effect} onDone={onDone}>
      <div className="effect effect--starter-water-burst">
        <div className="waterfall-sheet" />
        <span /><span /><span /><span /><span /><span />
      </div>
    </TimedEffect>
  );
}

function StarterBubbles({ effect, onDone }) {
  return (
    <TimedEffect effect={effect} onDone={onDone}>
      <div className="effect effect--starter-bubbles">
        <span /><span /><span /><span /><span /><span />
      </div>
    </TimedEffect>
  );
}

function StarterFeather({ effect, onDone }) {
  return (
    <TimedEffect effect={effect} onDone={onDone}>
      <div className="effect effect--starter-feather">
        <span /><span /><span /><span />
      </div>
    </TimedEffect>
  );
}

function StarterSprint({ effect, onDone }) {
  return (
    <TimedEffect effect={effect} onDone={onDone}>
      <div className="effect effect--starter-sprint">
        <span /><span /><span /><span />
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

function SudowoodoDodge({ effect, onDone }) {
  return (
    <TimedEffect effect={effect} onDone={onDone}>
      <div className="effect effect--sudowoodo-dodge">
        <div className="sudowoodo-rain" />
        <img
          src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/185.png"
          alt=""
        />
        <span>!</span>
        <div className="sudowoodo-wave" />
      </div>
    </TimedEffect>
  );
}

function UnownMessage({ effect, onDone }) {
  const text = effect.message || 'VOICE';
  const letters = text.toLowerCase().split('');
  return (
    <TimedEffect effect={effect} onDone={onDone}>
      <div className="effect effect--unown-message">
        {letters.map((letter, index) => (
          letter === ' '
            ? <span key={`space-${index}`} className="unown-space" />
            : (
              <img
                key={`${letter}-${index}`}
                src={`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/201-${letter}.png`}
                alt={letter}
              />
            )
        ))}
      </div>
    </TimedEffect>
  );
}

function WobbuffetReply({ effect, onDone }) {
  return (
    <TimedEffect effect={effect} onDone={onDone}>
      <div className="effect effect--wobbuffet-reply">WOBBUFFET!</div>
    </TimedEffect>
  );
}

function ShuckleJuice({ effect, onDone }) {
  return (
    <TimedEffect effect={effect} onDone={onDone}>
      <div className="effect effect--shuckle-juice">
        <span />
        <span />
        <span />
      </div>
    </TimedEffect>
  );
}

function DelibirdGift({ effect, onDone }) {
  const items = ['★', '❄', '🍓', '?'];
  return (
    <TimedEffect effect={effect} onDone={onDone}>
      <button className="effect effect--delibird-gift" type="button" onClick={() => onDone(effect.key)}>
        <span>REGALO</span>
        {items.map((item, index) => <i key={index}>{item}</i>)}
      </button>
    </TimedEffect>
  );
}

function CelebiRewind({ effect, onDone }) {
  return (
    <TimedEffect effect={effect} onDone={onDone}>
      <div className="effect effect--celebi-rewind">
        <i /><i /><i /><i /><i />
        <span>TIME</span>
        <span>REWIND</span>
      </div>
    </TimedEffect>
  );
}

function CastformWeather({ effect, onDone }) {
  const weatherIcons = {
    1: '☀',
    2: '☔',
    3: '❄',
  };
  const icons = effect.weather
    ? Array.from({ length: 12 }, () => weatherIcons[effect.weather] || '☁')
    : ['☀', '☔', '❄', '☁', '☀', '☔', '❄', '☁', '☀', '☔', '❄', '☁'];
  return (
    <TimedEffect effect={effect} onDone={onDone}>
      <div className="effect effect--castform-weather">
        {icons.map((icon, index) => (
          <span key={`${icon}-${index}`} className={icon === '☀' ? 'weather-icon--sun' : ''}>{icon}</span>
        ))}
      </div>
    </TimedEffect>
  );
}

function RotomPossess({ effect, onDone }) {
  useEffect(() => {
    document.body.classList.add('rotom-possessed');
    return () => document.body.classList.remove('rotom-possessed');
  }, []);

  return (
    <TimedEffect effect={effect} onDone={onDone}>
      <div className="effect effect--rotom-possess">
        <span>ROTOM</span>
      </div>
    </TimedEffect>
  );
}

function LucarioAura({ effect, onDone }) {
  return (
    <TimedEffect effect={effect} onDone={onDone}>
      <div className="effect effect--lucario-aura">
        <span />
        <span />
        <span />
        <i aria-hidden="true" />
      </div>
    </TimedEffect>
  );
}

function AudinoHeal({ effect, onDone }) {
  return (
    <TimedEffect effect={effect} onDone={onDone}>
      <div className="effect effect--audino-heal">
        <span>+</span><span>+</span><span>+</span><span>+</span>
      </div>
    </TimedEffect>
  );
}

function ZoroarkIllusion({ effect, onDone }) {
  return (
    <TimedEffect effect={effect} onDone={onDone}>
      <div className="effect effect--zoroark-illusion">
        <span>???</span>
      </div>
    </TimedEffect>
  );
}

function KlefkiKeys({ effect, onDone }) {
  return (
    <TimedEffect effect={effect} onDone={onDone}>
      <div className="effect effect--klefki-keys">
        <span>⚿</span><span>⚿</span><span>⚿</span><span>⚿</span>
      </div>
    </TimedEffect>
  );
}

function GimmighoulCoin({ effect, onDone, onGimmighoulCoinCollect }) {
  const [position] = useState(() => ({
    left: `${8 + Math.round(Math.random() * 84)}vw`,
    top: `${18 + Math.round(Math.random() * 62)}vh`,
  }));

  return (
    <TimedEffect effect={effect} onDone={onDone}>
      <button
        className="effect effect--gimmighoul-coin"
        type="button"
        style={{
          '--coin-left': position.left,
          '--coin-top': position.top,
        }}
        aria-label="Recoger moneda de Gimmighoul"
        onClick={async () => {
          await onGimmighoulCoinCollect();
          onDone(effect.key);
        }}
      >
        G
      </button>
    </TimedEffect>
  );
}

function PalafinHero({ effect, onDone }) {
  return (
    <TimedEffect effect={effect} onDone={onDone}>
      <div className="effect effect--palafin-hero">
        <span>HERO</span>
      </div>
    </TimedEffect>
  );
}

function SpiritombSouls({ effect, onDone }) {
  return (
    <TimedEffect effect={effect} onDone={onDone}>
      <div className="effect effect--spiritomb-souls">
        <strong>108</strong>
        {Array.from({ length: 18 }, (_, index) => <span key={index} />)}
      </div>
    </TimedEffect>
  );
}

function DarkraiNightmare({ effect, onDone }) {
  return (
    <TimedEffect effect={effect} onDone={onDone}>
      <div className="effect effect--darkrai-nightmare">
        <span />
        <span />
        <strong>DARKRAI</strong>
      </div>
    </TimedEffect>
  );
}

function MimikyuBlackout({ effect, onDone }) {
  return (
    <TimedEffect effect={effect} onDone={onDone}>
      <div className="effect effect--mimikyu-blackout">
        <span>PIKA?</span>
      </div>
    </TimedEffect>
  );
}

function ChandelureShadows({ effect, onDone }) {
  return (
    <TimedEffect effect={effect} onDone={onDone}>
      <div className="effect effect--chandelure-shadows">
        <span /><span /><span /><span />
      </div>
    </TimedEffect>
  );
}

function MiloticTide({ effect, onDone }) {
  return (
    <TimedEffect effect={effect} onDone={onDone}>
      <div className="effect effect--milotic-tide">
        <span /><span /><span /><span /><span /><span />
      </div>
    </TimedEffect>
  );
}

function GarchompDash({ effect, onDone }) {
  return (
    <TimedEffect effect={effect} onDone={onDone}>
      <div className="effect effect--garchomp-dash">
        <span />
        <i />
      </div>
    </TimedEffect>
  );
}

function ArceusDivine({ effect, onDone }) {
  return (
    <TimedEffect effect={effect} onDone={onDone}>
      <div className="effect effect--arceus-divine">
        {Array.from({ length: 10 }, (_, index) => <i key={index} />)}
        <span>ARCEUS</span>
      </div>
    </TimedEffect>
  );
}

function XerneasBloom({ effect, onDone }) {
  useEffect(() => {
    document.body.classList.add('xerneas-bloom-active');
    return () => document.body.classList.remove('xerneas-bloom-active');
  }, []);

  return (
    <TimedEffect effect={effect} onDone={onDone}>
      <div className="effect effect--xerneas-bloom">
        <span /><span /><span /><span /><span /><span /><span /><span />
      </div>
    </TimedEffect>
  );
}

function YveltalDrain({ effect, onDone }) {
  useEffect(() => {
    document.body.classList.add('yveltal-drain-active');
    return () => document.body.classList.remove('yveltal-drain-active');
  }, []);

  return (
    <TimedEffect effect={effect} onDone={onDone}>
      <div className="effect effect--yveltal-drain">
        <span /><span /><span />
      </div>
    </TimedEffect>
  );
}

function AuraBalance({ effect, onDone }) {
  return (
    <TimedEffect effect={effect} onDone={onDone}>
      <div className="effect effect--aura-balance">
        <span>LIFE</span>
        <i />
        <span>DEATH</span>
      </div>
    </TimedEffect>
  );
}

function NecrozmaPrism({ effect, onDone }) {
  return (
    <TimedEffect effect={effect} onDone={onDone}>
      <div className="effect effect--necrozma-prism">
        <span /><span /><span /><span /><span />
      </div>
    </TimedEffect>
  );
}

function EternatusDynamax({ effect, onDone }) {
  return (
    <TimedEffect effect={effect} onDone={onDone}>
      <div className="effect effect--eternatus-dynamax">
        <span />
        <i />
        <i />
      </div>
    </TimedEffect>
  );
}

function GenesectScan({ effect, onDone }) {
  return (
    <TimedEffect effect={effect} onDone={onDone}>
      <div className="effect effect--genesect-scan">
        <span />
        <i />
        <i />
      </div>
    </TimedEffect>
  );
}

function WoolooRoll({ effect, onDone }) {
  return (
    <TimedEffect effect={effect} onDone={onDone}>
      <div className="effect effect--wooloo-roll"><span /></div>
    </TimedEffect>
  );
}

function CramorantSpit({ effect, onDone }) {
  const items = ['?', '★', '!', '魚'];
  return (
    <TimedEffect effect={effect} onDone={onDone}>
      <div className="effect effect--cramorant-spit">
        {items.map((item, index) => <span key={index}>{item}</span>)}
      </div>
    </TimedEffect>
  );
}

function TeaTime({ effect, onDone }) {
  return (
    <TimedEffect effect={effect} onDone={onDone}>
      <div className="effect effect--tea-time">
        <span />
        <i />
        <i />
        <i />
      </div>
    </TimedEffect>
  );
}

function AlcremieFrosting({ effect, onDone }) {
  return (
    <TimedEffect effect={effect} onDone={onDone}>
      <div className="effect effect--alcremie-frosting">
        {Array.from({ length: 10 }, (_, index) => <span key={index} />)}
      </div>
    </TimedEffect>
  );
}

function DragapultDreepy({ effect, onDone }) {
  return (
    <TimedEffect effect={effect} onDone={onDone}>
      <div className="effect effect--dragapult-dreepy">
        <span /><span /><span />
      </div>
    </TimedEffect>
  );
}

function TandemausMultiply({ effect, onDone }) {
  return (
    <TimedEffect effect={effect} onDone={onDone}>
      <div className="effect effect--tandemaus-multiply">
        {Array.from({ length: 8 }, (_, index) => <span key={index} />)}
      </div>
    </TimedEffect>
  );
}

function FidoughBake({ effect, onDone }) {
  return (
    <TimedEffect effect={effect} onDone={onDone}>
      <div className="effect effect--fidough-bake">
        <span />
        <i />
        <i />
      </div>
    </TimedEffect>
  );
}

function TinkatonHammer({ effect, onDone }) {
  return (
    <TimedEffect effect={effect} onDone={onDone}>
      <div className="effect effect--tinkaton-hammer">
        <span />
        <i />
      </div>
    </TimedEffect>
  );
}

function KingambitBoss({ effect, onDone }) {
  return (
    <TimedEffect effect={effect} onDone={onDone}>
      <div className="effect effect--kingambit-boss">
        <span>KINGAMBIT</span>
        <i />
        <i />
      </div>
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

function MissingNoGlitch({ effect, onDone }) {
  useEffect(() => {
    document.body.classList.add('missingno-active');
    return () => document.body.classList.remove('missingno-active');
  }, []);

  return (
    <TimedEffect effect={effect} onDone={onDone}>
      <div className="effect effect--missingno-glitch">
        <div className="missingno-block" />
        <span>MISSINGNO</span>
        <span>#$%? 000</span>
        <span>▓▒░▓▒░</span>
      </div>
    </TimedEffect>
  );
}

function SpecialEffect({ effect, onDone, onCoinCollect, onGimmighoulCoinCollect }) {
  if (effect.type === 'gengar-scare') {
    return <GengarScare active onDone={() => onDone(effect.key)} />;
  }
  if (effect.type === 'arceus-divine') return <ArceusDivine effect={effect} onDone={onDone} />;
  if (effect.type === 'aura-balance') return <AuraBalance effect={effect} onDone={onDone} />;
  if (effect.type === 'alcremie-frosting') return <AlcremieFrosting effect={effect} onDone={onDone} />;
  if (effect.type === 'audino-heal') return <AudinoHeal effect={effect} onDone={onDone} />;
  if (effect.type === 'bulbasaur-leaf-burst') return <LeafBurst effect={effect} onDone={onDone} />;
  if (effect.type === 'castform-weather') return <CastformWeather effect={effect} onDone={onDone} />;
  if (effect.type === 'chandelure-shadows') return <ChandelureShadows effect={effect} onDone={onDone} />;
  if (effect.type === 'celebi-rewind') return <CelebiRewind effect={effect} onDone={onDone} />;
  if (effect.type === 'charmander-ember-burst') return <EmberBurst effect={effect} onDone={onDone} />;
  if (effect.type === 'cramorant-spit') return <CramorantSpit effect={effect} onDone={onDone} />;
  if (effect.type === 'darkrai-nightmare') return <DarkraiNightmare effect={effect} onDone={onDone} />;
  if (effect.type === 'delibird-gift') return <DelibirdGift effect={effect} onDone={onDone} />;
  if (effect.type === 'dragapult-dreepy') return <DragapultDreepy effect={effect} onDone={onDone} />;
  if (effect.type === 'eternatus-dynamax') return <EternatusDynamax effect={effect} onDone={onDone} />;
  if (effect.type === 'fidough-bake') return <FidoughBake effect={effect} onDone={onDone} />;
  if (effect.type === 'garchomp-dash') return <GarchompDash effect={effect} onDone={onDone} />;
  if (effect.type === 'genesect-scan') return <GenesectScan effect={effect} onDone={onDone} />;
  if (effect.type === 'gimmighoul-coin') return <GimmighoulCoin effect={effect} onDone={onDone} onGimmighoulCoinCollect={onGimmighoulCoinCollect} />;
  if (effect.type === 'kingambit-boss') return <KingambitBoss effect={effect} onDone={onDone} />;
  if (effect.type === 'klefki-keys') return <KlefkiKeys effect={effect} onDone={onDone} />;
  if (effect.type === 'lucario-aura') return <LucarioAura effect={effect} onDone={onDone} />;
  if (effect.type === 'milotic-tide') return <MiloticTide effect={effect} onDone={onDone} />;
  if (effect.type === 'mimikyu-blackout') return <MimikyuBlackout effect={effect} onDone={onDone} />;
  if (effect.type === 'petal-burst') return <PetalBurst effect={effect} onDone={onDone} />;
  if (effect.type === 'necrozma-prism') return <NecrozmaPrism effect={effect} onDone={onDone} />;
  if (effect.type === 'palafin-hero') return <PalafinHero effect={effect} onDone={onDone} />;
  if (effect.type === 'rotom-possess') return <RotomPossess effect={effect} onDone={onDone} />;
  if (effect.type === 'shuckle-juice') return <ShuckleJuice effect={effect} onDone={onDone} />;
  if (effect.type === 'spiritomb-souls') return <SpiritombSouls effect={effect} onDone={onDone} />;
  if (effect.type === 'squirtle-water-splash') return <WaterSplash effect={effect} onDone={onDone} />;
  if (effect.type === 'starter-bubbles') return <StarterBubbles effect={effect} onDone={onDone} />;
  if (effect.type === 'starter-feather') return <StarterFeather effect={effect} onDone={onDone} />;
  if (effect.type === 'starter-fire-burst') return <StarterFireBurst effect={effect} onDone={onDone} />;
  if (effect.type === 'starter-sprint') return <StarterSprint effect={effect} onDone={onDone} />;
  if (effect.type === 'starter-water-burst') return <StarterWaterBurst effect={effect} onDone={onDone} />;
  if (effect.type === 'jigglypuff-sleep-wave') return <SleepWave effect={effect} onDone={onDone} />;
  if (effect.type === 'meowth-coin') return <MeowthCoin effect={effect} onDone={onDone} onCoinCollect={onCoinCollect} />;
  if (effect.type === 'missingno-glitch') return <MissingNoGlitch effect={effect} onDone={onDone} />;
  if (effect.type === 'psyduck-think') return <PsyduckThink effect={effect} onDone={onDone} />;
  if (effect.type === 'snorlax-nap') return <SnorlaxNap effect={effect} onDone={onDone} />;
  if (effect.type === 'sudowoodo-dodge') return <SudowoodoDodge effect={effect} onDone={onDone} />;
  if (effect.type === 'tandemaus-multiply') return <TandemausMultiply effect={effect} onDone={onDone} />;
  if (effect.type === 'tea-time') return <TeaTime effect={effect} onDone={onDone} />;
  if (effect.type === 'tinkaton-hammer') return <TinkatonHammer effect={effect} onDone={onDone} />;
  if (effect.type === 'unown-message') return <UnownMessage effect={effect} onDone={onDone} />;
  if (effect.type === 'wobbuffet-reply') return <WobbuffetReply effect={effect} onDone={onDone} />;
  if (effect.type === 'wooloo-roll') return <WoolooRoll effect={effect} onDone={onDone} />;
  if (effect.type === 'xerneas-bloom') return <XerneasBloom effect={effect} onDone={onDone} />;
  if (effect.type === 'yveltal-drain') return <YveltalDrain effect={effect} onDone={onDone} />;
  if (effect.type === 'zoroark-illusion') return <ZoroarkIllusion effect={effect} onDone={onDone} />;
  return null;
}

export function SpecialEffectsLayer({ effects, easterEggState, onCoinCollect, onGimmighoulCoinCollect, onEffectDone }) {
  const hasCoinCounter = (easterEggState?.meowthCoins || 0) > 0;
  const hasGimmighoulCounter = (easterEggState?.gimmighoulCoins || 0) > 0;
  if (!effects.length && !hasCoinCounter && !hasGimmighoulCounter) return null;

  return (
    <div className="special-effects-layer">
      {effects.map(effect => (
        <SpecialEffect
          key={effect.key}
          effect={effect}
          onDone={onEffectDone}
          onCoinCollect={onCoinCollect}
          onGimmighoulCoinCollect={onGimmighoulCoinCollect}
        />
      ))}
      {hasCoinCounter && <div className="meowth-coin-counter">₽ {easterEggState.meowthCoins}</div>}
      {hasGimmighoulCounter && <div className="gimmighoul-coin-counter">G {easterEggState.gimmighoulCoins}</div>}
    </div>
  );
}
