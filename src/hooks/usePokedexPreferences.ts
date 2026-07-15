import { useCallback, useEffect, useState } from 'react';
import { LS_CARD_SCALE, LS_GENS } from '../../scripts/utils.js';
import {
  isPokemonGenerationId,
  type PokemonGenerationId,
} from '../domain/catalog/pokemonGeneration.js';
import { getBrowserPokeVoiceSave, updateBrowserPreferences } from '../store/browserPokeVoiceSaveStore.js';

function readInitialGeneration(): PokemonGenerationId {
  const preferences = getBrowserPokeVoiceSave().preferences;
  const active = Number(preferences.activeGenerationId);
  if (isPokemonGenerationId(active)) return active;
  const legacySelection = Number(preferences.selectedGenerationIds[0]);
  return isPokemonGenerationId(legacySelection) ? legacySelection : 1;
}

export function usePokedexPreferences() {
  const [activeGeneration, setActiveGenerationState] = useState<PokemonGenerationId>(readInitialGeneration);
  const [cardSize, setCardSize] = useState(() => getBrowserPokeVoiceSave().preferences.cardSize);

  useEffect(() => {
    document.documentElement.style.setProperty('--card-size', `${cardSize}px`);
    localStorage.setItem(LS_CARD_SCALE, String(cardSize));
    updateBrowserPreferences(current => ({ ...current, cardSize }));
  }, [cardSize]);

  useEffect(() => {
    const selectedGenerationIds = [activeGeneration];
    localStorage.setItem(LS_GENS, JSON.stringify(selectedGenerationIds));
    updateBrowserPreferences(current => ({
      ...current,
      activeGenerationId: activeGeneration,
      selectedGenerationIds,
    }));
  }, [activeGeneration]);

  const setActiveGeneration = useCallback((generation: number) => {
    if (!isPokemonGenerationId(generation)) return false;
    setActiveGenerationState(generation);
    return true;
  }, []);

  return { activeGeneration, cardSize, setActiveGeneration, setCardSize };
}
