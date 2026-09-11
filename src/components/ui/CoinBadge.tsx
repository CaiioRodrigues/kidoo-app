import { StyleSheet, View } from 'react-native';

import { CoinIcon } from './CoinIcon';
import { Text } from './Text';
import { radius, spacing, useStyles, useTheme, type ThemeColors, type ThemePalette } from '@/theme';

/** Kidoo Coins — moeda interna usada para reservar atividades. */
export function CoinBadge({ amount, size = 'md' }: { amount: number; size?: 'sm' | 'md' }) {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const small = size === 'sm';
  return (
    <View
      style={[styles.badge, small && styles.badgeSm]}
      accessibilityLabel={`${amount} Kidoo Coins`}
    >
      <CoinIcon size={small ? 13 : 16} />
      <Text variant={small ? 'caption' : 'label'} color={colors.warning}>
        {amount} {small ? 'coins' : 'Kidoo Coins'}
      </Text>
    </View>
  );
}

const makeStyles = (_colors: ThemeColors, palette: ThemePalette) =>
  StyleSheet.create({
    badge: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: spacing.xs,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: radius.pill,
      backgroundColor: palette.yellowSoft,
    },
    badgeSm: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xxs },
  });
