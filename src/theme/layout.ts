/** Escala de 4pt — todo espaçamento vem daqui. */
export const spacing = {
  none: 0,
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 40,
  huge: 56,
} as const;

export const radius = {
  none: 0,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  pill: 999,
} as const;

export const hitSlop = { top: 8, bottom: 8, left: 8, right: 8 } as const;

/** Alvo mínimo de toque recomendado por iOS HIG e Material (acessibilidade). */
export const minTouchTarget = 44;

export type SpacingToken = keyof typeof spacing;
export type RadiusToken = keyof typeof radius;
