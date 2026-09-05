import { StyleSheet, View } from 'react-native';

import { StarRating } from './StarRating';
import { Text } from '@/components/ui';
import { radius, spacing, useStyles, useTheme, type ThemeColors } from '@/theme';
import type { RatingSummary } from '@/types/domain';

const STARS = [5, 4, 3, 2, 1] as const;

/** Nota média à esquerda, distribuição por estrela à direita. */
export function RatingSummaryCard({ summary }: { summary: RatingSummary }) {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);

  const counted = STARS.reduce((sum, star) => sum + summary.distribution[star], 0);

  return (
    <View style={styles.card}>
      <View style={styles.average}>
        <Text variant="display" color={colors.text}>
          {summary.average.toFixed(1).replace('.', ',')}
        </Text>
        <StarRating rating={summary.average} size={14} />
        <Text variant="caption" color={colors.textMuted}>
          {summary.total === 1 ? '1 avaliação' : `${summary.total} avaliações`}
        </Text>
      </View>

      <View style={styles.bars}>
        {STARS.map((star) => {
          const count = summary.distribution[star];
          // Proporção sobre os comentários exibidos, não sobre o total do
          // catálogo — senão as barras nunca somariam a linha cheia.
          const ratio = counted === 0 ? 0 : count / counted;
          return (
            <View key={star} style={styles.barRow}>
              <Text variant="caption" color={colors.textFaint} style={styles.barLabel}>
                {star}
              </Text>
              <View style={styles.track}>
                <View style={[styles.fill, { width: `${ratio * 100}%` }]} />
              </View>
              <Text variant="caption" color={colors.textFaint} style={styles.barCount}>
                {count}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: { flexDirection: 'row', gap: spacing.xl, alignItems: 'center' },
    average: { alignItems: 'center', gap: spacing.xxs },
    bars: { flex: 1, gap: spacing.xs },
    barRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    barLabel: { width: 10, textAlign: 'right' },
    barCount: { width: 20 },
    track: {
      flex: 1,
      height: 6,
      borderRadius: radius.pill,
      backgroundColor: colors.backgroundMuted,
      overflow: 'hidden',
    },
    fill: { height: '100%', borderRadius: radius.pill, backgroundColor: colors.accentYellow },
  });
