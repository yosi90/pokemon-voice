import { useCallback, useRef, useState } from 'react';
import {
  getNextNavigationTarget,
  type PokemonNavigationKind,
} from '../domain/navigation/pokemonCardNavigation.js';

const SCROLL_SETTLE_TIMEOUT_MS = 900;
const ALREADY_CENTERED_PAUSE_MS = 120;
const FOCUS_DELAY_MS = 180;
const FOCUS_DURATION_MS = 1050;

interface PokemonCardNavigationOptions {
  visiblePokemonIds: readonly number[];
  guessedIds: ReadonlySet<number>;
  showToast: (message: string, kind?: string) => void;
}

function isNodeNearViewportCenter(node: HTMLElement): boolean {
  const rect = node.getBoundingClientRect();
  const nodeCenterY = rect.top + rect.height / 2;
  const nodeCenterX = rect.left + rect.width / 2;
  const thresholdY = Math.min(170, window.innerHeight * 0.18);
  const thresholdX = Math.min(220, window.innerWidth * 0.22);

  return Math.abs(nodeCenterY - window.innerHeight / 2) <= thresholdY
    && Math.abs(nodeCenterX - window.innerWidth / 2) <= thresholdX;
}

function waitForScrollSettle(node: HTMLElement, stableFramesRequired = 1): Promise<void> {
  return new Promise(resolve => {
    const startedAt = performance.now();
    let lastX = window.scrollX;
    let lastY = window.scrollY;
    let stableFrames = 0;
    let hasMoved = false;

    const tick = () => {
      const now = performance.now();
      const moved = Math.abs(window.scrollX - lastX) > 1 || Math.abs(window.scrollY - lastY) > 1;
      const arrived = isNodeNearViewportCenter(node);

      if (moved) {
        hasMoved = true;
        stableFrames = 0;
        lastX = window.scrollX;
        lastY = window.scrollY;
      } else {
        stableFrames += 1;
      }

      if (arrived || (hasMoved && stableFrames >= stableFramesRequired) || now - startedAt >= SCROLL_SETTLE_TIMEOUT_MS) {
        resolve();
        return;
      }
      window.requestAnimationFrame(tick);
    };

    window.requestAnimationFrame(tick);
  });
}

export function usePokemonCardNavigation({
  visiblePokemonIds,
  guessedIds,
  showToast,
}: PokemonCardNavigationOptions) {
  const cardRefs = useRef<Map<number, HTMLElement>>(new Map());
  const [focusedCardId, setFocusedCardId] = useState<number | null>(null);
  const navigationIndexesRef = useRef<Record<PokemonNavigationKind, number>>({ guessed: -1, remaining: -1 });
  const focusedCardTimerRef = useRef<number | undefined>(undefined);

  const scrollToPokemon = useCallback(async (id: number) => {
    const node = cardRefs.current.get(id);
    if (!node) return;
    if (isNodeNearViewportCenter(node)) {
      await new Promise(resolve => window.setTimeout(resolve, ALREADY_CENTERED_PAUSE_MS));
      return;
    }

    node.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
    await waitForScrollSettle(node);
  }, []);

  const focusPokemonCard = useCallback((id: number) => {
    window.clearTimeout(focusedCardTimerRef.current);
    setFocusedCardId(id);
    focusedCardTimerRef.current = window.setTimeout(() => {
      setFocusedCardId(current => current === id ? null : current);
    }, FOCUS_DURATION_MS);
  }, []);

  const navigateCards = useCallback((kind: PokemonNavigationKind) => {
    const target = getNextNavigationTarget(
      visiblePokemonIds,
      guessedIds,
      kind,
      navigationIndexesRef.current[kind],
    );
    if (!target) {
      showToast(
        kind === 'guessed' ? 'Aún no hay descubiertos en este filtro.' : 'No queda nada en este filtro.',
        'info',
      );
      return;
    }

    navigationIndexesRef.current[kind] = target.index;
    void scrollToPokemon(target.id);
    window.setTimeout(() => focusPokemonCard(target.id), FOCUS_DELAY_MS);
  }, [focusPokemonCard, guessedIds, scrollToPokemon, showToast, visiblePokemonIds]);

  return { cardRefs, focusedCardId, navigateCards, scrollToPokemon };
}
