/**
 * Progressão de níveis do Kidoo.
 *
 * Antes cada nível custava 250 XP fixos: com 100 XP por aula, o nível 25 saía
 * em 60 aulas — cerca de 15 semanas. Curto demais para ser um objetivo.
 *
 * Agora o custo cresce a cada nível:
 *
 *     XP para sair do nível n  =  150 + (n - 1) * 80
 *
 * O primeiro nível sai em 2 aulas, para engatar rápido; o último exige 20.
 * Somando tudo, chegar ao nível 25 pede 25.680 XP ≈ 257 aulas, algo como 15
 * meses a 4 aulas por semana. É um objetivo de longo prazo, não de um mês.
 */

export const XP_PER_CHECK_IN = 100;

/** Teto inicial. Subir o teto depois é só mudar esta constante. */
export const MAX_LEVEL = 25;

const BASE_XP = 150;
const XP_STEP = 80;

/** XP necessário para sair do nível informado. Zero no nível máximo. */
export function xpToLeaveLevel(level: number): number {
  if (level >= MAX_LEVEL) return 0;
  return BASE_XP + (level - 1) * XP_STEP;
}

/** XP acumulado necessário para alcançar um nível. */
export function totalXpForLevel(level: number): number {
  let total = 0;
  for (let n = 1; n < level; n += 1) total += xpToLeaveLevel(n);
  return total;
}

const TIERS: { upTo: number; name: string }[] = [
  { upTo: 4, name: 'Iniciante' },
  { upTo: 9, name: 'Curioso' },
  { upTo: 14, name: 'Aventureiro' },
  { upTo: 19, name: 'Explorador' },
  { upTo: 24, name: 'Campeão' },
  { upTo: MAX_LEVEL, name: 'Lenda Kidoo' },
];

export function levelName(level: number): string {
  return TIERS.find((tier) => level <= tier.upTo)?.name ?? 'Lenda Kidoo';
}

/**
 * Kidoo Bônus concedidos ao alcançar um nível.
 *
 *   2 e 3    → 1      10 a 14 → 4
 *   4 a 6    → 2      15 a 19 → 5
 *   7 a 9    → 3      20 a 24 → 6      25 → 10 (marco final)
 *
 * Do nível 2 ao 25 são 102 moedas ao longo de ~257 aulas: com o custo médio de
 * 2,83 coins, equivale a cerca de 36 aulas de presente, ou 14% do total. É um
 * agrado por constância, não uma segunda assinatura.
 */
export function bonusForLevel(level: number): number {
  if (level <= 1) return 0;
  if (level >= MAX_LEVEL) return 10;
  if (level <= 3) return 1;
  if (level <= 6) return 2;
  if (level <= 9) return 3;
  if (level <= 14) return 4;
  if (level <= 19) return 5;
  return 6;
}

export type LevelProgress = {
  level: number;
  levelName: string;
  /** XP acumulado dentro do nível atual. */
  xpIntoLevel: number;
  /** XP que este nível exige por inteiro. Zero no nível máximo. */
  xpForLevel: number;
  isMaxLevel: boolean;
};

export function levelFromXp(xp: number): LevelProgress {
  let level = 1;
  let remaining = Math.max(0, xp);

  while (level < MAX_LEVEL && remaining >= xpToLeaveLevel(level)) {
    remaining -= xpToLeaveLevel(level);
    level += 1;
  }

  const isMaxLevel = level >= MAX_LEVEL;
  return {
    level,
    levelName: levelName(level),
    xpIntoLevel: isMaxLevel ? 0 : remaining,
    xpForLevel: xpToLeaveLevel(level),
    isMaxLevel,
  };
}

export type LevelRow = {
  level: number;
  name: string;
  /** XP acumulado para chegar neste nível. */
  totalXp: number;
  /** Aulas acumuladas equivalentes, a 100 XP por aula. */
  totalActivities: number;
  bonus: number;
};

/** Tabela completa, para a tela de níveis e recompensas. */
export const LEVEL_TABLE: LevelRow[] = Array.from({ length: MAX_LEVEL }, (_, index) => {
  const level = index + 1;
  const totalXp = totalXpForLevel(level);
  return {
    level,
    name: levelName(level),
    totalXp,
    totalActivities: Math.ceil(totalXp / XP_PER_CHECK_IN),
    bonus: bonusForLevel(level),
  };
});
