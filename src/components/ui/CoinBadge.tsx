import { StyleSheet, View } from 'react-native';

import { Text } from './Text';
import { colors, palette, radius, spacing } from '@/theme';

/** Kidoo Coins — moeda interna usada para reservar atividades. */
export function CoinBadge({ amount, size = 'md' }: { amount: number; size?: 'sm' | 'md' }) {
  const small = size === 'sm';
  return (
    <View
      style={[styles.badge, small && styles.badgeSm]}
      accessibilityLabel={`${amount} Kidoo Coins`}
    >
      <Text style={[styles.coin, small && styles.coinSm]}>🪙</Text>
      <Text variant={small ? 'caption' : 'label'} color={colors.warning}>
        {amount} {small ? 'coins' : 'Kidoo Coins'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
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
  coin: { fontSize: 14 },
  coinSm: { fontSize: 11 },
});
