import { radius, spacing } from './layout';
import { shadows } from './shadows';
import { textVariants } from './typography';

export { fontFamily, textVariants, type TextVariant, type FontFamilyToken } from './typography';
export {
  spacing,
  radius,
  blobRadius,
  hitSlop,
  minTouchTarget,
  type SpacingToken,
  type RadiusToken,
} from './layout';
export { shadows, type ShadowToken } from './shadows';
export { appFonts } from './fonts';
export { categoryTone, type CategoryTone } from './categories';
export {
  brand,
  lightColors,
  darkColors,
  lightPalette,
  darkPalette,
  type ThemeColors,
  type ThemePalette,
} from './palettes';
export {
  ThemeProvider,
  useTheme,
  useStyles,
  useSystemUiSync,
  type ThemeMode,
} from './ThemeProvider';

/**
 * Tokens que não dependem do tema. Cor sai exclusivamente de `useTheme()` —
 * não há export estático de cor de propósito: sem isso, um componente poderia
 * silenciosamente ficar preso no tema claro.
 */
export const theme = { spacing, radius, shadows, textVariants } as const;
export type Theme = typeof theme;
