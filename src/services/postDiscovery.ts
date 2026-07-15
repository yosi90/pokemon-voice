import type { LegacyEasterEggState, PostDiscoveryPlan } from '../domain/discovery/planPostDiscovery.js';
import { planPostDiscovery } from '../domain/discovery/planPostDiscovery.js';
import type { SpecialEffectPayload } from '../domain/discovery/planSpecialReveal.js';

export interface AchievementGuessMetadata {
  id: number;
  name: string;
  remainingSec: number | null;
  source: string;
}

interface PostDiscoveryInput extends AchievementGuessMetadata {
  discoveredIds: ReadonlySet<number>;
  easterEggState: LegacyEasterEggState;
}

interface PostDiscoveryDependencies {
  registerAchievementGuess: (metadata: AchievementGuessMetadata) => Promise<unknown>;
  persistEasterEggState: (state: LegacyEasterEggState) => void;
  enqueueEffect: (effect: SpecialEffectPayload) => unknown;
  onAchievementError?: (error: unknown) => void;
}

export async function processPostDiscovery(
  input: PostDiscoveryInput,
  dependencies: PostDiscoveryDependencies,
): Promise<PostDiscoveryPlan> {
  try {
    await dependencies.registerAchievementGuess({
      id: input.id,
      name: input.name,
      remainingSec: input.remainingSec,
      source: input.source,
    });
  } catch (error) {
    dependencies.onAchievementError?.(error);
  }

  const plan = planPostDiscovery({
    pokemonId: input.id,
    discoveredIds: input.discoveredIds,
    easterEggState: input.easterEggState,
  });
  if (plan.stateChanged) dependencies.persistEasterEggState(plan.nextEasterEggState);
  for (const effect of plan.effects) dependencies.enqueueEffect(effect);
  return plan;
}
