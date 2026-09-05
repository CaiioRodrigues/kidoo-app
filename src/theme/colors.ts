/**
 * Paleta oficial Kidoo — extraída do guia de marca.
 * Nenhum hex solto deve ser escrito em telas ou componentes: use sempre estes tokens.
 */
export const palette = {
  // Marca
  purple: '#6A3FC6',
  purpleDark: '#54309E',
  purpleDeep: '#2A1B4A',
  purpleSoft: '#EFE9FB',
  purpleTint: '#F7F4FE',

  teal: '#22C1C3',
  tealSoft: '#E3F8F8',

  yellow: '#FFC839',
  yellowSoft: '#FFF6DE',

  pink: '#FF6BA3',
  pinkSoft: '#FFEBF2',

  // Neutros
  ink: '#1E1E2F',
  inkMuted: '#5C5C72',
  inkFaint: '#8E8EA6',
  line: '#E6E6F0',
  surface: '#FFFFFF',
  surfaceMuted: '#F5F6FA',
  cream: '#FDF9F2',

  // Sinalização
  success: '#22A06B',
  successSoft: '#E4F6EE',
  danger: '#E0384A',
  dangerSoft: '#FDEAEC',
  warning: '#D98600',

  // Overlays
  overlay: 'rgba(30, 30, 47, 0.55)',
  transparent: 'transparent',
} as const;

export const colors = {
  primary: palette.purple,
  primaryDark: palette.purpleDark,
  primarySoft: palette.purpleSoft,
  primaryTint: palette.purpleTint,

  accentTeal: palette.teal,
  accentYellow: palette.yellow,
  accentPink: palette.pink,

  background: palette.surface,
  backgroundMuted: palette.surfaceMuted,
  backgroundBrand: palette.purpleDeep,
  card: palette.surface,

  text: palette.ink,
  textMuted: palette.inkMuted,
  textFaint: palette.inkFaint,
  textOnPrimary: palette.surface,

  border: palette.line,
  borderStrong: palette.purple,

  success: palette.success,
  successSoft: palette.successSoft,
  danger: palette.danger,
  dangerSoft: palette.dangerSoft,
  warning: palette.warning,

  overlay: palette.overlay,
  transparent: palette.transparent,
} as const;

export type ColorToken = keyof typeof colors;
