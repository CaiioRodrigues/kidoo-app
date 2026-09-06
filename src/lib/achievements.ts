import type { Achievement, ActivityCategoryId } from '@/types/domain';

/**
 * Conquistas da jornada.
 *
 * Vivem aqui, e não dentro do mock, porque **todo backend precisa das mesmas
 * regras**: são derivadas do histórico de aulas, não guardadas em coluna. O
 * adapter do Supabase monta a jornada a partir das reservas confirmadas e passa
 * pela mesma função — se a regra fosse duplicada, mock e produção divergiriam.
 */

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
