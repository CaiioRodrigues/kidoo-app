import { Ionicons } from '@expo/vector-icons';
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { StarRating } from './StarRating';
import { Avatar, Text } from '@/components/ui';
import { spacing, useStyles, useTheme, type ThemeColors } from '@/theme';
import type { Review } from '@/types/domain';

/** "há 3 dias" / "há 2 meses" — data exata não acrescenta nada aqui. */
function relativeTime(iso: string, now: Date = new Date()): string {
  const days = Math.floor((now.getTime() - Date.parse(iso)) / (1000 * 60 * 60 * 24));
  if (days <= 0) return 'hoje';
  if (days === 1) return 'ontem';
  if (days < 30) return `há ${days} dias`;
  const months = Math.floor(days / 30);
  return months === 1 ? 'há 1 mês' : `há ${months} meses`;
}

function ReviewCardBase({ review }: { review: Review }) {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Avatar name={review.authorName} size={36} />
        <View style={styles.flex}>
          <Text variant="bodyStrong" numberOfLines={1}>
            {review.authorName}
          </Text>
          <View style={styles.meta}>
            <StarRating rating={review.rating} size={12} />
            <Text variant="caption" color={colors.textFaint}>
              {relativeTime(review.createdAt)}
            </Text>
          </View>
        </View>
      </View>

      <Text variant="body" color={colors.textMuted}>
        {review.comment}
      </Text>

      {review.helpfulCount > 0 ? (
        <View style={styles.helpful}>
          <Ionicons name="thumbs-up-outline" size={13} color={colors.textFaint} />
          <Text variant="caption" color={colors.textFaint}>
            {review.helpfulCount === 1
              ? '1 pessoa achou útil'
              : `${review.helpfulCount} pessoas acharam útil`}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const makeStyles = (_colors: ThemeColors) =>
  StyleSheet.create({
    card: { gap: spacing.sm, paddingVertical: spacing.base },
    header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    meta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    helpful: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
    flex: { flex: 1 },
  });

export const ReviewCard = memo(ReviewCardBase);
