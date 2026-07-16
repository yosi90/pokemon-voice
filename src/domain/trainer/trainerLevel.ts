export const MAX_TRAINER_LEVEL = 100;

/**
 * Experiencia total necesaria para alcanzar cada nivel (índice 0 = nivel 1).
 *
 * La curva es un valor de balance, no un contrato de guardado: la partida conserva
 * experiencia acumulada y deriva el nivel con la tabla vigente. Puede sustituirse
 * en pruebas o durante el balance sin cambiar el motor de recompensas.
 */
export const DEFAULT_TRAINER_LEVEL_THRESHOLDS = Object.freeze(
  Array.from({ length: MAX_TRAINER_LEVEL }, (_, index) => 25 * index * index),
);

function assertValidThresholds(thresholds: readonly number[]) {
  if (!thresholds.length || thresholds[0] !== 0) {
    throw new Error('La tabla de nivel debe comenzar en 0 de experiencia.');
  }
  for (let index = 0; index < thresholds.length; index += 1) {
    const threshold = thresholds[index];
    if (!Number.isSafeInteger(threshold) || threshold < 0) {
      throw new Error('Los umbrales de nivel deben ser enteros positivos seguros.');
    }
    if (index > 0 && threshold <= thresholds[index - 1]) {
      throw new Error('Los umbrales de nivel deben ser estrictamente crecientes.');
    }
  }
}

export function normalizeTrainerExperience(value: unknown) {
  return Number.isSafeInteger(value) && Number(value) >= 0 ? Number(value) : 0;
}

export function getTrainerLevelForExperience(
  experience: unknown,
  thresholds: readonly number[] = DEFAULT_TRAINER_LEVEL_THRESHOLDS,
) {
  assertValidThresholds(thresholds);
  const normalizedExperience = normalizeTrainerExperience(experience);

  let lowerBound = 0;
  let upperBound = thresholds.length;
  while (lowerBound < upperBound) {
    const middle = Math.floor((lowerBound + upperBound) / 2);
    if (thresholds[middle] <= normalizedExperience) lowerBound = middle + 1;
    else upperBound = middle;
  }
  return Math.max(1, lowerBound);
}

export function normalizeTrainerProgress(experience: unknown) {
  const trainerExperience = normalizeTrainerExperience(experience);
  return {
    trainerExperience,
    trainerLevel: getTrainerLevelForExperience(trainerExperience),
  };
}
