import type { ThemedChallengeDefinitionV1 } from '../../../packages/contracts/src/index.js';

const DAILY_ROTATION_OFFSET = 11;

export function formatLocalDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getPreviousLocalDateKey(dateKey: string): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() - 1);
  return formatLocalDateKey(date);
}

function getLocalDayNumber(dateKey: string): number {
  const [year, month, day] = dateKey.split('-').map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
}

/** Recorre los 30 exámenes sin repetir antes de completar una vuelta. */
export function selectDailyTriviaChallenge(
  definitions: readonly ThemedChallengeDefinitionV1[],
  dateKey: string,
): ThemedChallengeDefinitionV1 | undefined {
  if (!definitions.length) return undefined;
  const sorted = [...definitions].sort((left, right) => left.challengeId.localeCompare(right.challengeId));
  const index = ((getLocalDayNumber(dateKey) + DAILY_ROTATION_OFFSET) % sorted.length + sorted.length) % sorted.length;
  return sorted[index];
}
