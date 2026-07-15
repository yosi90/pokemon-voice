import { useCallback, useEffect, useState } from 'react';
import { GEN_RANGES, LS_CARD_SCALE, LS_GENS } from '../../scripts/utils.js';
import { readCardSize, readJson } from '../lib/storage.js';

const allGenerationIds = Object.keys(GEN_RANGES).map(Number);

export function useLegacyPreferences() {
  const [selectedGens, setSelectedGens] = useState<number[]>(() => {
    const saved = readJson(LS_GENS, null);
    return Array.isArray(saved) && saved.length ? saved.map(Number) : allGenerationIds;
  });
  const [cardSize, setCardSize] = useState(readCardSize);

  useEffect(() => {
    document.documentElement.style.setProperty('--card-size', `${cardSize}px`);
    localStorage.setItem(LS_CARD_SCALE, String(cardSize));
  }, [cardSize]);

  useEffect(() => {
    localStorage.setItem(LS_GENS, JSON.stringify(selectedGens));
  }, [selectedGens]);

  const toggleGen = useCallback((generation: number) => {
    setSelectedGens(current => {
      if (current.includes(generation)) {
        const next = current.filter(item => item !== generation);
        return next.length ? next : current;
      }
      return [...current, generation].sort((left, right) => left - right);
    });
  }, []);

  return { cardSize, selectedGens, setCardSize, toggleGen };
}
