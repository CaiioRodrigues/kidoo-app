import { colors } from './colors';
import { radius, spacing } from './layout';
import { shadows } from './shadows';
import { textVariants } from './typography';

export { colors, palette, type ColorToken } from './colors';
export { fontFamily, textVariants, type TextVariant, type FontFamilyToken } from './typography';
export {
  spacing,
  radius,
  hitSlop,
  minTouchTarget,
  type SpacingToken,
  type RadiusToken,
} from './layout';
export { shadows, type ShadowToken } from './shadows';
export { appFonts } from './fonts';

export const theme = { colors, spacing, radius, shadows, textVariants } as const;
export type Theme = typeof theme;
