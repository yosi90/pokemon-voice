import { useEffect, useState } from 'react';
import type { PmdAnimationV1 } from '../../../packages/contracts/src/index.js';

export function PmdAnimationPreview({ animation, label }: { animation: PmdAnimationV1; label: string }) {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    setFrame(0);
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
      || animation.frameCount < 2) return undefined;
    let timer = 0;
    let current = 0;
    const schedule = () => {
      const ticks = animation.durationTicks[current] ?? animation.durationTicks[0] ?? 6;
      timer = window.setTimeout(() => {
        current = (current + 1) % animation.frameCount;
        setFrame(current);
        schedule();
      }, Math.max(16, ticks / 60 * 1000));
    };
    schedule();
    return () => window.clearTimeout(timer);
  }, [animation]);

  return <div className="editor-animation-preview" aria-label={`Preview animada: ${label}`}>
    <span
      aria-hidden="true"
      style={{
        width: animation.frameWidth,
        height: animation.frameHeight,
        backgroundImage: `url("${new URL(
          animation.animationSheetPath,
          new URL('../../', window.location.href),
        ).href}")`,
        backgroundPosition: `${-frame * animation.frameWidth}px 0`,
      }}
    />
  </div>;
}
