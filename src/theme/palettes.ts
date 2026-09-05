/**
 * Paletas clara e escura. As duas expõem exatamente as mesmas chaves — é isso
 * que permite trocar de tema em runtime sem nenhum componente saber qual está
 * ativo.
 *
 * O escuro não é o claro invertido: o roxo da marca (#6A3FC6) tem contraste
 * insuficiente sobre fundo escuro, então nele o primário é clareado. Os fundos
 * puxam para o roxo-carvão da identidade em vez de cinza neutro.
 */

export const brand = {
  purple: '#6A3FC6',
  teal: '#22C1C3',
  yellow: '#FFC839',
  pink: '#FF6BA3',
  ink: '#1E1E2F',
} as const;

export type ThemeColors = {
  primary: string;
  primaryDark: string;
  primarySoft: string;
  primaryTint: string;

  accentTeal: string;
  accentYellow: string;
  accentPink: string;

  background: string;
  backgroundMuted: string;
  backgroundBrand: string;
  card: string;

  text: string;
  textMuted: string;
  textFaint: string;
  textOnPrimary: string;

  border: string;
  borderStrong: string;

  success: string;
  successSoft: string;
  danger: string;
  dangerSoft: string;
  warning: string;

  overlay: string;
  transparent: string;
};

/** Tons suaves usados em cards temáticos, também com versão por tema. */
export type ThemePalette = {
  purple: string;
  purpleDark: string;
  purpleDeep: string;
  purpleSoft: string;
  purpleTint: string;
  teal: string;
  tealSoft: string;
  tealInk: string;
  yellow: string;
  yellowSoft: string;
  pink: string;
  pinkSoft: string;
  pinkInk: string;
  cream: string;
};

export const lightColors: ThemeColors = {
  primary: brand.purple,
  primaryDark: '#54309E',
  primarySoft: '#EFE9FB',
  primaryTint: '#F7F4FE',

  accentTeal: brand.teal,
  accentYellow: brand.yellow,
  accentPink: brand.pink,

  background: '#FFFFFF',
  backgroundMuted: '#F5F6FA',
  backgroundBrand: '#2A1B4A',
  card: '#FFFFFF',

  text: brand.ink,
  textMuted: '#5C5C72',
  textFaint: '#8E8EA6',
  textOnPrimary: '#FFFFFF',

  border: '#E6E6F0',
  borderStrong: brand.purple,

  success: '#22A06B',
  successSoft: '#E4F6EE',
  danger: '#E0384A',
  dangerSoft: '#FDEAEC',
  warning: '#D98600',

  overlay: 'rgba(30, 30, 47, 0.55)',
  transparent: 'transparent',
};

export const darkColors: ThemeColors = {
  // Roxo clareado: o roxo da marca não atinge contraste legível sobre escuro.
  primary: '#A382F0',
  primaryDark: '#8B63E4',
  primarySoft: '#2E2547',
  primaryTint: '#241E38',

  accentTeal: '#3FD8DA',
  accentYellow: '#FFD466',
  accentPink: '#FF8AB8',

  background: '#141220',
  backgroundMuted: '#1C1928',
  backgroundBrand: '#0F0D18',
  card: '#211D30',

  text: '#F4F2FA',
  textMuted: '#B4AECA',
  textFaint: '#837C9C',
  textOnPrimary: '#1A1526',

  border: '#332C48',
  borderStrong: '#A382F0',

  success: '#4ED39A',
  successSoft: '#17332A',
  danger: '#FF6B7A',
  dangerSoft: '#3A1F26',
  warning: '#FFB443',

  overlay: 'rgba(0, 0, 0, 0.65)',
  transparent: 'transparent',
};

export const lightPalette: ThemePalette = {
  purple: brand.purple,
  purpleDark: '#54309E',
  purpleDeep: '#2A1B4A',
  purpleSoft: '#EFE9FB',
  purpleTint: '#F7F4FE',
  teal: brand.teal,
  tealSoft: '#E3F8F8',
  tealInk: '#128385',
  yellow: brand.yellow,
  yellowSoft: '#FFF6DE',
  pink: brand.pink,
  pinkSoft: '#FFEBF2',
  pinkInk: '#D93E76',
  cream: '#FDF9F2',
};

export const darkPalette: ThemePalette = {
  purple: '#A382F0',
  purpleDark: '#8B63E4',
  purpleDeep: '#0F0D18',
  purpleSoft: '#2E2547',
  purpleTint: '#241E38',
  teal: '#3FD8DA',
  tealSoft: '#14332F',
  tealInk: '#5FE3E5',
  yellow: '#FFD466',
  yellowSoft: '#33290F',
  pink: '#FF8AB8',
  pinkSoft: '#331B26',
  pinkInk: '#FF9EC4',
  cream: '#1C1928',
};
