import { StyleSheet, View, type ViewStyle } from 'react-native';

import { Text } from './Text';
import { radius, spacing, useTheme, type ThemeColors, type ThemePalette } from '@/theme';

type Tone = 'brand' | 'teal' | 'yellow' | 'pink' | 'success' | 'neutral';

const tonesFor = (
  colors: ThemeColors,
  palette: ThemePalette,
): Record<Tone, { bg: string; fg: string }> => ({
  brand: { bg: palette.purpleSoft, fg: palette.purple },
  teal: { bg: palette.tealSoft, fg: palette.tealInk },
  yellow: { bg: palette.yellowSoft, fg: colors.warning },
  pink: { bg: palette.pinkSoft, fg: palette.pinkInk },
  success: { bg: colors.successSoft, fg: colors.success },
  neutral: { bg: colors.backgroundMuted, fg: colors.textMuted },
});

export function Badge({
  label,
  tone = 'brand',
  left,
  style,
}: {
  label: string;
  tone?: Tone;
  left?: React.ReactNode;
  style?: ViewStyle;
}) {
  const { colors, palette } = useTheme();
  const t = tonesFor(colors, palette)[tone];
  return (
    <View style={[styles.badge, { backgroundColor: t.bg }, style]}>
      {left}
      <Text variant="caption" color={t.fg} style={styles.text}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
  },
  text: { fontWeight: '600' },
});
