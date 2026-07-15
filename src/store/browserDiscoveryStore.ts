import { LS_KEY } from '../../scripts/utils.js';
import { readJson, saveGuessed } from '../lib/storage.js';
import { createDiscoveryStore } from './discoveryStore.js';

const savedIds = readJson(LS_KEY, []);

export const browserDiscoveryStore = createDiscoveryStore({
  initialIds: Array.isArray(savedIds) ? savedIds : [],
  persist: ids => saveGuessed(ids),
});
