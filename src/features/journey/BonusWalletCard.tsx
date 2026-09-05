import { StyleSheet, View } from 'react-native';

import { Card, Text } from '@/components/ui';
import { daysUntilExpiry } from '@/lib/bonus';
import { formatDaysUntil } from '@/lib/format';
import { colors, palette, radius, spacing } from '@/theme';
import type { BonusWallet } from '@/types/domain';

/**
 * Carteira de Kidoo Bônus. Mostra o saldo e, principalmente, o que está
 * perto de vencer — é a informação que evita o usuário perder moeda.
 */
export function BonusWalletCard({ wallet }: { wallet: BonusWallet }) {
  const empty = wallet.balance === 0;
  const expiring = wallet.nextExpiring;
  const daysLeft = expiring ? daysUntilExpiry(expiring.expiresAt) : null;
  const urgent = daysLeft !== null && daysLeft <= 7;

  return (
    <Card bordered elevation="none" style={styles.card}>
      <View style={styles.header}>
        <View style={styles.icon}>
          <Text style={styles.emoji}>🎁</Text>
        </View>
        <View style={styles.flex}>
          <Text variant="bodyStrong">
            {empty
              ? 'Nenhuma moeda bônus'
              : wallet.balance === 1
                ? '1 moeda bônus'
                : `${wallet.balance} moedas bônus`}
          </Text>
          <Text variant="caption" color={colors.textMuted}>
            {empty
              ? 'Suba de nível para ganhar moedas bônus.'
              : 'Usadas antes dos coins da assinatura.'}
          </Text>
        </View>
      </View>

      {expiring && daysLeft !== null ? (
        <View style={[styles.expiry, urgent && styles.expiryUrgent]}>
          <Text variant="caption" color={urgent ? colors.danger : colors.textMuted}>
            {expiring.amount === 1 ? '1 moeda vence' : `${expiring.amount} moedas vencem`}{' '}
            {formatDaysUntil(daysLeft)}
          </Text>
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  icon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.pinkSoft,
  },
  emoji: { fontSize: 22 },
  expiry: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.backgroundMuted,
  },
  expiryUrgent: { backgroundColor: colors.dangerSoft },
  flex: { flex: 1 },
});
