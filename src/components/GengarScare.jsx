import { useEffect } from 'react';
import { ART_URL } from '../../scripts/utils.js';

export function GengarScare({ active, onDone }) {
  useEffect(() => {
    if (!active) return undefined;
    const timer = window.setTimeout(onDone, 1150);
    return () => window.clearTimeout(timer);
  }, [active, onDone]);

  if (!active) return null;

  return (
    <div className="gengar-scare" aria-hidden="true">
      <div className="gengar-scare__flash" />
      <img className="gengar-scare__art" src={ART_URL(94)} alt="" />
      <div className="gengar-scare__eyes" />
    </div>
  );
}
