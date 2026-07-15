import { useCallback, useEffect, useState } from 'react';
import { GEN_RANGES, LS_CARD_SCALE, LS_GENS } from '../../scripts/utils.js';
import { getBrowserPokeVoiceSave, updateBrowserPreferences } from '../store/browserPokeVoiceSaveStore.js';

const allGenerationIds = Object.keys(GEN_RANGES).map(Number);

export function useLegacyPreferences() {
  const [selectedGens, setSelectedGens] = useState<number[]>(() => {
    const saved = getBrowserPokeVoiceSave().preferences.selectedGenerationIds;
    return Array.isArray(saved) && saved.length ? saved.map(Number) : allGenerationIds;
  });
  const [cardSize, setCardSize] = useState(() => getBrowserPokeVoiceSave().preferences.cardSize);

  useEffect(() => {
    document.documentElement.style.setProperty('--card-size', `${cardSize}px`);
    localStorage.setItem(LS_CARD_SCALE, String(cardSize));
    updateBrowserPreferences(current => ({ ...current, cardSize }));
  }, [cardSize]);

  useEffect(() => {
    localStorage.setItem(LS_GENS, JSON.stringify(selectedGens));
    updateBrowserPreferences(current => ({ ...current, selectedGenerationIds: selectedGens }));
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
