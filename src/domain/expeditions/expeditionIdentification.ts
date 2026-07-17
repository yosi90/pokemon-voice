import type { PokeVoiceSaveV1 } from '../../../packages/contracts/src/index.js';
import { recordMeaningfulExpeditionInteraction } from './expeditionSession.js';

export type ExpeditionIdentificationMethod = 'voice' | 'text';

export interface IdentifyVisibleSpeciesRequest {
  resolvedSpeciesId: number;
  visibleSpeciesIds: readonly number[];
  method: ExpeditionIdentificationMethod;
  interactionId: string;
}

export function isExpeditionSpeciesRevealed(save: PokeVoiceSaveV1, speciesId: number) {
  return save.pokedexRun.registeredSpeciesIds.includes(speciesId);
}

/** Recibe la identidad ya resuelta por el reconocedor común; no duplica alias ni tolerancia de voz. */
export function identifyVisibleExpeditionSpecies(
  save: PokeVoiceSaveV1,
  request: IdentifyVisibleSpeciesRequest,
) {
  if (!save.activeExpeditionSession) throw new Error('La identificación contextual exige una expedición activa.');
  if (!Number.isSafeInteger(request.resolvedSpeciesId) || request.resolvedSpeciesId <= 0) {
    throw new Error('resolvedSpeciesId debe ser un entero positivo.');
  }
  if (!request.interactionId?.trim()) throw new Error('interactionId debe ser un identificador estable no vacío.');
  if (!request.visibleSpeciesIds.includes(request.resolvedSpeciesId)) {
    return { status: 'notVisible' as const, save };
  }
  if (isExpeditionSpeciesRevealed(save, request.resolvedSpeciesId)) {
    return { status: 'alreadyRegistered' as const, save };
  }

  const speciesId = request.resolvedSpeciesId;
  let next: PokeVoiceSaveV1 = {
    ...save,
    pokedexRun: {
      ...save.pokedexRun,
      registeredSpeciesIds: [...save.pokedexRun.registeredSpeciesIds, speciesId],
      discoveryOrder: [...save.pokedexRun.discoveryOrder, speciesId],
    },
    pokeDiscover: {
      ...save.pokeDiscover,
      sightings: save.pokeDiscover.sightings.includes(speciesId)
        ? save.pokeDiscover.sightings
        : [...save.pokeDiscover.sightings, speciesId],
    },
  };
  next = recordMeaningfulExpeditionInteraction(next, {
    interactionId: request.interactionId,
    kind: 'speciesIdentification',
  });
  return { status: 'identified' as const, save: next, method: request.method, speciesId };
}
