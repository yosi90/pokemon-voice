export interface EvaluatableAchievement<Meta = unknown, Context = unknown> {
  id: string;
  event?: string;
  scope?: string;
  check: (meta: Meta, context: Context) => boolean | Promise<boolean>;
}

export async function isAchievementSatisfied<Meta, Context>(
  achievement: EvaluatableAchievement<Meta, Context>,
  meta: Meta,
  context: Context,
) {
  try {
    return Boolean(await achievement.check(meta, context));
  } catch {
    return false;
  }
}

export async function findSatisfiedAchievements<
  Meta,
  Context,
  Achievement extends EvaluatableAchievement<Meta, Context>,
>(
  achievements: readonly Achievement[],
  eventType: string,
  meta: Meta,
  context: Context,
) {
  const candidates = achievements.filter(achievement => (
    (achievement.event || 'guess') === eventType
    && (achievement.scope || 'run') === 'run'
  ));
  const satisfied: Achievement[] = [];

  for (const achievement of candidates) {
    if (await isAchievementSatisfied(achievement, meta, context)) satisfied.push(achievement);
  }

  return satisfied;
}
