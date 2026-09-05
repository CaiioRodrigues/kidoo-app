import { Platform, type ViewStyle } from 'react-native';

/**
 * Sombras equivalentes em iOS (shadow*) e Android (elevation).
 * Sombra é caro em Android: use apenas nos cards que realmente flutuam.
 */
const make = (elevation: number, opacity: number, radius: number, offsetY: number): ViewStyle =>
  Platform.select<ViewStyle>({
    ios: {
      shadowColor: '#1E1E2F',
      shadowOpacity: opacity,
      shadowRadius: radius,
      shadowOffset: { width: 0, height: offsetY },
    },
    android: { elevation },
    default: {
      shadowColor: '#1E1E2F',
      shadowOpacity: opacity,
      shadowRadius: radius,
      shadowOffset: { width: 0, height: offsetY },
    },
  }) as ViewStyle;

export const shadows = {
  none: {} as ViewStyle,
  card: make(2, 0.06, 12, 4),
  raised: make(6, 0.1, 20, 8),
  floating: make(12, 0.16, 28, 12),
} as const;

export type ShadowToken = keyof typeof shadows;
