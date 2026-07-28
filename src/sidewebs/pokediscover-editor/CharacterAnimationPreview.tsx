import { useEffect, useState } from 'react';
import type { CharacterSpriteAssetV1 } from '../../../packages/contracts/src/index.js';

export function CharacterAnimationPreview({
  asset,
  label,
}: {
  asset: CharacterSpriteAssetV1;
  label: string;
}) {
  const frames = asset.walkFrames.length ? asset.walkFrames : [asset.idleFrame];
  const [frameIndex, setFrameIndex] = useState(0);

  useEffect(() => {
    setFrameIndex(0);
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || frames.length < 2) {
      return undefined;
    }
    const timer = window.setInterval(() => {
      setFrameIndex(current => (current + 1) % frames.length);
    }, Math.max(80, asset.frameDurationMs));
    return () => window.clearInterval(timer);
  }, [asset.frameDurationMs, frames.length]);

  const frame = frames[frameIndex] ?? asset.idleFrame;
  const row = asset.directionRows.down;
  return <div className="editor-animation-preview" aria-label={`Preview animada: ${label}`}>
    <span
      aria-hidden="true"
      style={{
        width: asset.frameWidth,
        height: asset.frameHeight,
        backgroundImage: `url(${new URL(asset.path, new URL('../../', window.location.href)).href})`,
        backgroundPosition: `${-frame * asset.frameWidth}px ${-row * asset.frameHeight}px`,
      }}
    />
  </div>;
}
