import type { Achievement, ActivityCategoryId } from '@/types/domain';

/** XP creditado a cada check-in confirmado. */
export const XP_PER_CHECK_IN = 100;

/** Quanto XP fecha um nível. */
export const XP_PER_LEVEL = 250;

const LEVEL_NAMES = ['Iniciante', 'Curioso', 'Aventureiro', 'Explorador', 'Campeão'] as const;

export function levelFromXp(xp: number): { level: number; levelName: string; xpIntoLevel: number } {
  const level = Math.floor(xp / XP_PER_LEVEL) + 1;
  const nameIndex = Math.min(level - 1, LEVEL_NAMES.length - 1);
  return {
    level,
    levelName: LEVEL_NAMES[nameIndex] ?? 'Campeão',
    xpIntoLevel: xp % XP_PER_LEVEL,
  };
}

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
