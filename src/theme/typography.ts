import type { TextStyle } from 'react-native';

/**
 * Poppins é a tipografia da marca. Os pesos abaixo são os nomes dos arquivos
 * carregados em src/theme/fonts.ts — usar qualquer outro nome quebra em Android,
 * onde a família não resolve pesos automaticamente.
 */
export const fontFamily = {
  regular: 'Poppins_400Regular',
  medium: 'Poppins_500Medium',
  semibold: 'Poppins_600SemiBold',
  bold: 'Poppins_700Bold',
  extrabold: 'Poppins_800ExtraBold',
} as const;

export type FontFamilyToken = keyof typeof fontFamily;

type Variant = Pick<TextStyle, 'fontSize' | 'lineHeight' | 'letterSpacing'> & {
  fontFamily: (typeof fontFamily)[FontFamilyToken];
};

export const textVariants = {
  display: { fontFamily: fontFamily.extrabold, fontSize: 32, lineHeight: 40, letterSpacing: -0.5 },
  title: { fontFamily: fontFamily.bold, fontSize: 26, lineHeight: 34, letterSpacing: -0.3 },
  heading: { fontFamily: fontFamily.bold, fontSize: 20, lineHeight: 28, letterSpacing: -0.2 },
  subheading: { fontFamily: fontFamily.semibold, fontSize: 17, lineHeight: 24 },
  body: { fontFamily: fontFamily.regular, fontSize: 15, lineHeight: 22 },
  bodyStrong: { fontFamily: fontFamily.semibold, fontSize: 15, lineHeight: 22 },
  label: { fontFamily: fontFamily.medium, fontSize: 13, lineHeight: 18 },
  caption: { fontFamily: fontFamily.regular, fontSize: 12, lineHeight: 16 },
  overline: { fontFamily: fontFamily.bold, fontSize: 11, lineHeight: 14, letterSpacing: 1.2 },
  button: { fontFamily: fontFamily.bold, fontSize: 16, lineHeight: 22 },
} as const satisfies Record<string, Variant>;

export type TextVariant = keyof typeof textVariants;
