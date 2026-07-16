import { useEffect, useRef } from 'react';

const CENTER = 165;
const BALL_RADIUS = 94;
const MAX_BOLTS = 7;

function polar(radius: number, angle: number) {
  return {
    x: CENTER + Math.cos(angle) * radius,
    y: CENTER + Math.sin(angle) * radius,
  };
}

function jaggedPath(
  angle: number,
  length: number,
  segments = 7,
  startRadius = BALL_RADIUS - 4,
  spread = 12,
) {
  const points = [];
  const endRadius = startRadius + length;
  for (let index = 0; index <= segments; index += 1) {
    const progress = index / segments;
    const radius = startRadius + (endRadius - startRadius) * progress;
    const angleJitter = index === 0 ? 0 : (Math.random() - 0.5) * 0.12;
    const lateral = index === 0 ? 0 : (Math.random() - 0.5) * spread;
    const point = polar(radius, angle + angleJitter);
    point.x += Math.cos(angle + Math.PI / 2) * lateral;
    point.y += Math.sin(angle + Math.PI / 2) * lateral;
    points.push(point);
  }
  return `M ${points.map(point => `${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' L ')}`;
}

export function PikachuElectricBurst() {
  const fieldRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const field = fieldRef.current;
    const host = field?.closest('.pokemon-ball-card');
    if (!field || !host) return undefined;

    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const pairs = [...field.querySelectorAll<SVGGElement>('[data-pikachu-bolt]')];
    let initialTimer = 0;
    let autoTimer = 0;
    let finishTimer = 0;
    let frameTimer = 0;

    const pathsFor = (pair: SVGGElement) => [...pair.querySelectorAll<SVGPathElement>('path')];
    const clearLiveClasses = () => {
      for (const pair of pairs) {
        for (const path of pathsFor(pair)) path.classList.remove('is-live');
      }
    };

    const clearTimers = () => {
      window.clearTimeout(initialTimer);
      window.clearTimeout(autoTimer);
      window.clearTimeout(finishTimer);
      window.clearInterval(frameTimer);
      initialTimer = 0;
      autoTimer = 0;
      finishTimer = 0;
      frameTimer = 0;
    };

    const buildFrame = () => {
      const activeCount = 3 + Math.floor(Math.random() * 4);
      const usedAngles: number[] = [];
      clearLiveClasses();

      pairs.forEach((pair, index) => {
        const [glow, core, branchGlow, branchCore] = pathsFor(pair);
        if (!glow || !core || !branchGlow || !branchCore || index >= activeCount) return;

        let angle = 0;
        let tries = 0;
        do {
          angle = Math.random() * Math.PI * 2;
          tries += 1;
        } while (
          tries < 8
          && usedAngles.some(value => Math.abs(Math.atan2(Math.sin(angle - value), Math.cos(angle - value))) < 0.48)
        );
        usedAngles.push(angle);

        const length = 48 + Math.random() * 43;
        const mainPath = jaggedPath(angle, length, 6 + Math.floor(Math.random() * 3), BALL_RADIUS - 3, 16);
        glow.setAttribute('d', mainPath);
        core.setAttribute('d', mainPath);

        const hasBranch = Math.random() > 0.28;
        if (hasBranch) {
          const branchStart = BALL_RADIUS + length * (0.34 + Math.random() * 0.2);
          const branchAngle = angle + (Math.random() > 0.5 ? 1 : -1) * (0.34 + Math.random() * 0.34);
          const branchPath = jaggedPath(branchAngle, 24 + Math.random() * 28, 4 + Math.floor(Math.random() * 2), branchStart, 10);
          branchGlow.setAttribute('d', branchPath);
          branchCore.setAttribute('d', branchPath);
        } else {
          branchGlow.setAttribute('d', '');
          branchCore.setAttribute('d', '');
        }

        const delay = `${Math.floor(Math.random() * 80)}ms`;
        for (const path of [glow, core]) {
          path.style.animationDelay = delay;
          path.classList.add('is-live');
        }
        if (hasBranch) {
          const branchDelay = `${90 + Math.floor(Math.random() * 90)}ms`;
          for (const path of [branchGlow, branchCore]) {
            path.style.animationDelay = branchDelay;
            path.classList.add('is-live');
          }
        }
      });
    };

    const burst = () => {
      if (document.hidden || reducedMotion?.matches) return;
      host.classList.remove('pikachu-burst');
      window.clearInterval(frameTimer);
      window.clearTimeout(finishTimer);
      clearLiveClasses();
      void field.offsetWidth;
      host.classList.add('pikachu-burst');
      buildFrame();

      let frames = 0;
      frameTimer = window.setInterval(() => {
        frames += 1;
        buildFrame();
        if (frames < 5) return;
        window.clearInterval(frameTimer);
        frameTimer = 0;
        finishTimer = window.setTimeout(() => {
          host.classList.remove('pikachu-burst');
          clearLiveClasses();
        }, 220);
      }, 85);
    };

    const scheduleNextBurst = () => {
      window.clearTimeout(autoTimer);
      if (document.hidden || reducedMotion?.matches) return;
      autoTimer = window.setTimeout(() => {
        burst();
        scheduleNextBurst();
      }, 1800 + Math.random() * 1900);
    };

    const restart = () => {
      clearTimers();
      host.classList.remove('pikachu-burst');
      clearLiveClasses();
      if (document.hidden || reducedMotion?.matches) return;
      initialTimer = window.setTimeout(burst, 500);
      scheduleNextBurst();
    };

    restart();
    document.addEventListener('visibilitychange', restart);
    reducedMotion?.addEventListener?.('change', restart);
    return () => {
      clearTimers();
      host.classList.remove('pikachu-burst');
      clearLiveClasses();
      document.removeEventListener('visibilitychange', restart);
      reducedMotion?.removeEventListener?.('change', restart);
    };
  }, []);

  return (
    <div ref={fieldRef} className="pikachu-electric-field" aria-hidden="true">
      <svg className="pikachu-electricity" viewBox="0 0 330 330">
        <defs>
          <filter id="pikachu-electric-glow" x="-5%" y="-5%" width="110%" height="110%">
            <feGaussianBlur stdDeviation="4.5" result="blur" />
            <feColorMatrix
              in="blur"
              type="matrix"
              values="1 0 0 0 1  0 1 0 0 .78  0 0 1 0 .02  0 0 0 1 0"
              result="yellowBlur"
            />
            <feMerge>
              <feMergeNode in="yellowBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {Array.from({ length: MAX_BOLTS }, (_, index) => (
          <g key={index} data-pikachu-bolt="">
            <path className="pikachu-bolt-glow" pathLength="1" />
            <path className="pikachu-bolt-core" pathLength="1" />
            <path className="pikachu-branch-glow" pathLength="1" />
            <path className="pikachu-branch-core" pathLength="1" />
          </g>
        ))}
      </svg>
      <div className="pikachu-energy-haze" />
    </div>
  );
}
