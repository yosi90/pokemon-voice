import type { ResearchFieldKey } from '../../../packages/contracts/src/index.js';

const CLASSIFIED_MESSAGES = [
  'Nombra a este Pokémon para desbloquear su registro.',
  'ARCHIVO INTERCEPTADO // El Team Rocket alteró este registro. Nombra al Pokémon para recuperarlo.',
  'SERVIDOR SIN RESPUESTA // La identidad no pudo sincronizarse. Pronuncia o escribe su nombre.',
  'RUMOR SIN VERIFICAR // Podría tratarse de una leyenda. Registra su nombre para abrir el expediente.',
  'DATOS CIFRADOS // El profesor necesita un nombre válido para restaurar esta entrada.',
  'SEÑAL INCOMPLETA // La Pokédex detecta una especie, pero todavía no puede identificarla.',
] as const;

const UNRESEARCHED_MESSAGES = [
  'DATOS CORRUPTOS // pendiente de expedición',
  'ARCHIVO INTERCEPTADO // posible actividad del Team Rocket',
  'SERVIDOR SIN RESPUESTA // observación de campo necesaria',
  'RUMOR SIN VERIFICAR // posible leyenda sin pruebas suficientes',
  'NOTA DEL PROFESOR // investiga esta especie en su hábitat',
  'SEÑAL INCOMPLETA // faltan datos de una expedición',
] as const;

const FIELD_OFFSETS: Record<ResearchFieldKey, number> = {
  biometrics: 0,
  behavior: 1,
  habitat: 2,
  exceptional: 3,
};

const stableIndex = (speciesId: number, offset: number, length: number) => {
  const normalizedId = Number.isInteger(speciesId) ? Math.max(1, speciesId) : 1;
  return (normalizedId - 1 + offset) % length;
};

export function getClassifiedNarrative(speciesId: number): string {
  return CLASSIFIED_MESSAGES[stableIndex(speciesId, 0, CLASSIFIED_MESSAGES.length)];
}

export function getUnresearchedFieldNarrative(speciesId: number, field: ResearchFieldKey): string {
  return UNRESEARCHED_MESSAGES[stableIndex(speciesId, FIELD_OFFSETS[field], UNRESEARCHED_MESSAGES.length)];
}
