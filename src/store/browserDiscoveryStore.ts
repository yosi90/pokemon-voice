import { saveGuessed } from '../lib/storage.js';
import { getBrowserPokeVoiceSave, updateBrowserPokedexRun } from './browserPokeVoiceSaveStore.js';
import { createDiscoveryStore } from './discoveryStore.js';

const savedIds = getBrowserPokeVoiceSave().pokedexRun.registeredSpeciesIds;

export const browserDiscoveryStore = createDiscoveryStore({
  initialIds: Array.isArray(savedIds) ? savedIds : [],
  persist: ids => {
    saveGuessed(ids);
    const registeredSpeciesIds = [...ids];
    updateBrowserPokedexRun(current => ({
      ...current,
      registeredSpeciesIds,
      discoveryOrder: registeredSpeciesIds,
    }));
  },
});
