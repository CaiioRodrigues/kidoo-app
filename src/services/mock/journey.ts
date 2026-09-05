import type { Achievement, ActivityCategoryId } from '@/types/domain';

// As regras de nível e recompensa vivem em @/lib/levels: a UI também precisa
// delas para a tela de níveis, então não podem ficar dentro do mock.
export { XP_PER_CHECK_IN, MAX_LEVEL, levelFromXp, bonusForLevel } from '@/lib/levels';

type AchievementRule = {
  id: string;
  label: string;
  emoji: string;
  /** Decide se a conquista está desbloqueada a partir do histórico de aulas. */
  isUnlocked: (stats: { total: number; byCategory: Map<ActivityCategoryId, number> }) => boolean;
};

export const ACHIEVEMENT_RULES: AchievementRule[] = [
  {
    id: 'primeira-aula',
    label: 'Primeira aula',
    emoji: '⭐',
    isUnlocked: ({ total }) => total >= 1,
  },
  {
    id: 'pequeno-craque',
    label: 'Pequeno craque',
    emoji: '🏅',
    isUnlocked: ({ byCategory }) => (byCategory.get('futebol') ?? 0) >= 3,
  },
  {
    id: 'peixinho',
    label: 'Peixinho',
    emoji: '🐠',
    isUnlocked: ({ byCategory }) => (byCategory.get('natacao') ?? 0) >= 2,
  },
  {
    id: 'explorador',
    label: 'Explorador',
    emoji: '🏆',
    isUnlocked: ({ byCategory }) => byCategory.size >= 3,
  },
];

export function buildAchievements(
  total: number,
  byCategory: Map<ActivityCategoryId, number>,
  unlockedAt: string,
): Achievement[] {
  return ACHIEVEMENT_RULES.map((rule) => ({
    id: rule.id,
    label: rule.label,
    emoji: rule.emoji,
    unlockedAt: rule.isUnlocked({ total, byCategory }) ? unlockedAt : null,
  }));
}
