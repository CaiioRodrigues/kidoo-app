import { StyleSheet, View, type ViewStyle } from 'react-native';

import { Text } from './Text';
import { colors, palette, radius, spacing } from '@/theme';

type Tone = 'brand' | 'teal' | 'yellow' | 'pink' | 'success' | 'neutral';

const TONES: Record<Tone, { bg: string; fg: string }> = {
  brand: { bg: palette.purpleSoft, fg: palette.purple },
  teal: { bg: palette.tealSoft, fg: '#128385' },
  yellow: { bg: palette.yellowSoft, fg: colors.warning },
  pink: { bg: palette.pinkSoft, fg: '#D93E76' },
  success: { bg: colors.successSoft, fg: colors.success },
  neutral: { bg: colors.backgroundMuted, fg: colors.textMuted },
};

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
  const t = TONES[tone];
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
