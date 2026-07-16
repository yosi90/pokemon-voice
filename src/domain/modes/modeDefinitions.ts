import type { ModeDefinitionV1, ModeRunPolicy } from '../../../packages/contracts/src/index.js';

type ModeDefinitionInput = Omit<ModeDefinitionV1, 'schemaVersion' | 'runPolicy'> & {
  runPolicy?: ModeRunPolicy;
};

export const TIMED_COLLECTOR_MODE_ID = 'timed-collector';
export const WHOS_THAT_POKEMON_MODE_ID = 'whos-that-pokemon';
export const THEMED_CHALLENGES_MODE_ID = 'themed-challenges';
export const DAILY_TRIVIA_MODE_ID = 'daily-trivia';

export function defineModeDefinition(input: ModeDefinitionInput): ModeDefinitionV1 {
  return Object.freeze({
    schemaVersion: 1,
    runPolicy: 'preserve',
    ...input,
  });
}

export const TIMED_COLLECTOR_MODE = defineModeDefinition({
  modeId: TIMED_COLLECTOR_MODE_ID,
  title: 'Coleccionista de logros',
  description: 'Tienes 2:00 minutos para obtener el máximo número de logros descubriendo Pokémon.',
  runPolicy: 'isolatedPokedex',
});

export const WHOS_THAT_POKEMON_MODE = defineModeDefinition({
  modeId: WHOS_THAT_POKEMON_MODE_ID,
  title: '¿Quién es ese Pokémon?',
  description: 'Identifica siluetas sin fallar y supera tu mejor racha. Administra tus comodines y responde por voz o texto.',
});

export const THEMED_CHALLENGES_MODE = defineModeDefinition({
  modeId: THEMED_CHALLENGES_MODE_ID,
  title: 'Trivia Pokémon',
  description: '¿Cuántos exámenes de colegio Pokémon serás capaz de aprobar?',
});

export const DAILY_TRIVIA_MODE = defineModeDefinition({
  modeId: DAILY_TRIVIA_MODE_ID,
  title: 'Examen diario',
  description: 'Un examen de Trivia Pokémon distinto cada día. Aprueba días consecutivos para alargar tu racha.',
});

export const MODE_DEFINITIONS: readonly ModeDefinitionV1[] = Object.freeze([
  TIMED_COLLECTOR_MODE,
  WHOS_THAT_POKEMON_MODE,
  THEMED_CHALLENGES_MODE,
  DAILY_TRIVIA_MODE,
]);

const definitionsById = new Map(MODE_DEFINITIONS.map(definition => [definition.modeId, definition]));

export function getModeDefinition(modeId: string): ModeDefinitionV1 | undefined {
  return definitionsById.get(modeId);
}

export function getModeStartConfirmation(definition: ModeDefinitionV1): string | null {
  if (definition.runPolicy !== 'resetPokedex') return null;
  return `Vas a iniciar ${definition.title}. Este modo creará una nueva run de Pokédex y vaciará los Pokémon registrados, el orden y las rachas actuales. Conservarás tus logros permanentes y todo PokeDiscover. ¿Continuar?`;
}

export function confirmModeStart(
  definition: ModeDefinitionV1,
  confirm: (message: string) => boolean,
): boolean {
  const message = getModeStartConfirmation(definition);
  return message ? confirm(message) : true;
}
