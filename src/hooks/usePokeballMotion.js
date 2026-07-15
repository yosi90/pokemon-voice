import { useEffect } from 'react';

const MAX_ROTATION_X = 10;
const MAX_ROTATION_Y = 14;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const resetAssembly = assembly => {
  if (!assembly) return;
  assembly.classList.remove('is-ball-tilting');
  assembly.style.removeProperty('--ball-rotate-x');
  assembly.style.removeProperty('--ball-rotate-y');
};

export function usePokeballMotion(gridRef) {
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return undefined;

    const finePointer = window.matchMedia?.('(hover: hover) and (pointer: fine)');
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    let activeAssembly = null;
    let animationFrameId = 0;
    let pendingPointer = null;

    const setDocumentVisibility = () => {
      if (document.hidden) resetAssembly(activeAssembly);
      if (document.hidden) activeAssembly = null;
    };

    setDocumentVisibility();
    document.addEventListener('visibilitychange', setDocumentVisibility);

    const clearActiveAssembly = () => {
      resetAssembly(activeAssembly);
      activeAssembly = null;
      pendingPointer = null;
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      animationFrameId = 0;
    };

    const applyPointerTilt = () => {
      animationFrameId = 0;
      if (!pendingPointer) return;

      const { assembly, clientX, clientY } = pendingPointer;
      pendingPointer = null;
      if (!assembly.isConnected) return;

      const rect = assembly.getBoundingClientRect();
      if (!rect.width || !rect.height) return;

      const normalizedX = clamp((clientX - rect.left) / rect.width * 2 - 1, -1, 1);
      const normalizedY = clamp((clientY - rect.top) / rect.height * 2 - 1, -1, 1);
      assembly.style.setProperty('--ball-rotate-x', `${(-normalizedY * MAX_ROTATION_X).toFixed(2)}deg`);
      assembly.style.setProperty('--ball-rotate-y', `${(normalizedX * MAX_ROTATION_Y).toFixed(2)}deg`);
    };

    const handlePointerMove = event => {
      if (!finePointer?.matches || reducedMotion?.matches || document.hidden) {
        clearActiveAssembly();
        return;
      }

      const card = event.target.closest('.pokemon-card');
      if (!card || card.classList.contains('revealing')) {
        clearActiveAssembly();
        return;
      }

      const assembly = card.querySelector('.ball-assembly');
      if (!assembly) return;
      if (activeAssembly !== assembly) {
        resetAssembly(activeAssembly);
        activeAssembly = assembly;
        activeAssembly.classList.add('is-ball-tilting');
      }

      pendingPointer = { assembly, clientX: event.clientX, clientY: event.clientY };
      if (!animationFrameId) animationFrameId = requestAnimationFrame(applyPointerTilt);
    };

    const handlePointerOut = event => {
      const originCard = event.target.closest('.pokemon-card');
      const destinationCard = event.relatedTarget?.closest?.('.pokemon-card');
      if (originCard && originCard !== destinationCard) clearActiveAssembly();
    };

    const handleMotionPreferenceChange = () => {
      if (!finePointer?.matches || reducedMotion?.matches) clearActiveAssembly();
    };

    grid.addEventListener('pointermove', handlePointerMove, { passive: true });
    grid.addEventListener('pointerout', handlePointerOut, { passive: true });
    finePointer?.addEventListener?.('change', handleMotionPreferenceChange);
    reducedMotion?.addEventListener?.('change', handleMotionPreferenceChange);

    return () => {
      clearActiveAssembly();
      document.removeEventListener('visibilitychange', setDocumentVisibility);
      grid.removeEventListener('pointermove', handlePointerMove);
      grid.removeEventListener('pointerout', handlePointerOut);
      finePointer?.removeEventListener?.('change', handleMotionPreferenceChange);
      reducedMotion?.removeEventListener?.('change', handleMotionPreferenceChange);
    };
  }, [gridRef]);
}
