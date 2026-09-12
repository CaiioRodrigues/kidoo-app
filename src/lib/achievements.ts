import type {
  Achievement,
  AchievementIcon,
  AchievementTone,
  ActivityCategoryId,
} from '@/types/domain';

/**
 * Conquistas da jornada.
 *
 * Vivem aqui, e não dentro do mock, porque **todo backend precisa das mesmas
 * regras**: são derivadas do histórico de aulas, não guardadas em coluna. O
 * adapter do Supabase monta a jornada a partir das reservas confirmadas e passa
 * pela mesma função — se a regra fosse duplicada, mock e produção divergiriam.
 *
 * É também por isso que a comemoração de conquista nova é decidida no
 * aparelho, e não no servidor: para o servidor anunciar "destravou agora" ele
 * teria de reimplementar estas regras em SQL, e a primeira regra nova que
 * alguém acrescentasse aqui apareceria na grade sem nunca comemorar. Ver
 * `src/lib/conquistas-vistas.ts`.
 */

type Stats = { total: number; byCategory: Map<ActivityCategoryId, number> };

type AchievementRule = {
  id: string;
  label: string;
  /** O que falta fazer. É o que a medalha bloqueada mostra em vez de nada. */
  hint: string;
  icon: AchievementIcon;
  tone: AchievementTone;
  /** Decide se a conquista está desbloqueada a partir do histórico de aulas. */
  isUnlocked: (stats: Stats) => boolean;
};

const quantas = (byCategory: Map<ActivityCategoryId, number>, id: ActivityCategoryId) =>
  byCategory.get(id) ?? 0;

/**
 * A ordem é a da grade, e ela conta uma história: primeiro o que se ganha
 * indo às aulas, depois o que se ganha variando, e por fim o que se ganha
 * dentro de cada modalidade. Trocar a ordem aqui troca a leitura da tela.
 */
export const ACHIEVEMENT_RULES: AchievementRule[] = [
  {
    id: 'primeira-aula',
    label: 'Primeira aula',
    hint: 'Faça a sua primeira aula',
    icon: 'estrela',
    tone: 'ouro',
    isUnlocked: ({ total }) => total >= 1,
  },
  {
    id: 'cinco-aulas',
    label: 'Cheio de energia',
    hint: 'Complete 5 aulas',
    icon: 'raio',
    tone: 'laranja',
    isUnlocked: ({ total }) => total >= 5,
  },
  {
    id: 'dez-aulas',
    label: 'Dedicado',
    hint: 'Complete 10 aulas',
    icon: 'medalha',
    tone: 'agua',
    isUnlocked: ({ total }) => total >= 10,
  },
  {
    id: 'vinte-e-cinco-aulas',
    label: 'Campeão',
    hint: 'Complete 25 aulas',
    icon: 'trofeu',
    tone: 'ouro',
    isUnlocked: ({ total }) => total >= 25,
  },
  {
    id: 'curioso',
    label: 'Curioso',
    hint: 'Experimente 2 modalidades',
    icon: 'mapa',
    tone: 'verde',
    isUnlocked: ({ byCategory }) => byCategory.size >= 2,
  },
  {
    id: 'explorador',
    label: 'Explorador',
    hint: 'Experimente 3 modalidades',
    icon: 'bussola',
    tone: 'verde',
    isUnlocked: ({ byCategory }) => byCategory.size >= 3,
  },
  {
    id: 'multitalento',
    label: 'Multitalento',
    hint: 'Experimente 5 modalidades',
    icon: 'coroa',
    tone: 'roxo',
    isUnlocked: ({ byCategory }) => byCategory.size >= 5,
  },
  {
    id: 'pequeno-craque',
    label: 'Pequeno craque',
    hint: 'Faça 3 aulas de futebol',
    icon: 'bola',
    tone: 'roxo',
    isUnlocked: ({ byCategory }) => quantas(byCategory, 'futebol') >= 3,
  },
  {
    id: 'peixinho',
    label: 'Peixinho',
    hint: 'Faça 2 aulas de natação',
    icon: 'onda',
    tone: 'agua',
    isUnlocked: ({ byCategory }) => quantas(byCategory, 'natacao') >= 2,
  },
  {
    id: 'pe-de-valsa',
    label: 'Pé de valsa',
    hint: 'Faça 3 aulas de dança',
    icon: 'nota',
    tone: 'rosa',
    isUnlocked: ({ byCategory }) => quantas(byCategory, 'danca') >= 3,
  },
  {
    id: 'faixa-nova',
    label: 'Faixa nova',
    hint: 'Faça 3 aulas de judô',
    icon: 'faixa',
    tone: 'roxo',
    isUnlocked: ({ byCategory }) => quantas(byCategory, 'judo') >= 3,
  },
  {
    id: 'artista',
    label: 'Artista',
    hint: 'Faça 3 aulas de artes',
    icon: 'paleta',
    tone: 'laranja',
    isUnlocked: ({ byCategory }) => quantas(byCategory, 'artes') >= 3,
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
    hint: rule.hint,
    icon: rule.icon,
    tone: rule.tone,
    unlockedAt: rule.isUnlocked({ total, byCategory }) ? unlockedAt : null,
  }));
}
