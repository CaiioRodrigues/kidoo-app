import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { CoinBadge, Text } from '@/components/ui';
import { StarRating } from '@/features/reviews';
import { formatDistance } from '@/lib/format';
import { radius, spacing, useStyles, useTheme, type ThemeColors } from '@/theme';
import type { Activity } from '@/types/domain';

const BLURHASH = 'L5H2EC=PM+yV0g-mq.wG9c010J}I';

/** Linha compacta usada na tela Explorar. */
function ActivityListItemBase({ activity, onPress }: { activity: Activity; onPress: () => void }) {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${activity.title}, ${activity.partner.name}`}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <Image
        source={{ uri: activity.imageUrl }}
        style={styles.thumb}
        contentFit="cover"
        placeholder={{ blurhash: BLURHASH }}
        transition={160}
        cachePolicy="memory-disk"
        recyclingKey={activity.id}
        accessibilityIgnoresInvertColors
      />

      <View style={styles.info}>
        <Text variant="bodyStrong" numberOfLines={1}>
          {activity.title}
        </Text>
        <View style={styles.metaRow}>
          <Text variant="caption" color={colors.textMuted}>
            {activity.minAge}-{activity.maxAge} anos
          </Text>
          <StarRating rating={activity.rating} size={11} />
          <Text variant="caption" color={colors.textMuted}>
            {activity.rating.toFixed(1).replace('.', ',')} ({activity.reviewCount})
          </Text>
        </View>
        <View style={styles.metaRow}>
          <Ionicons name="location-outline" size={13} color={colors.textFaint} />
          <Text variant="caption" color={colors.textMuted} numberOfLines={1} style={styles.flex}>
            {activity.partner.neighborhood} • {formatDistance(activity.distanceKm)}
          </Text>
        </View>
        <CoinBadge amount={activity.coinCost} size="sm" />
      </View>

      <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
    </Pressable>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.md,
    },
    pressed: { opacity: 0.7 },
    thumb: {
      width: 74,
      height: 74,
      borderRadius: radius.lg,
      backgroundColor: colors.backgroundMuted,
    },
    info: { flex: 1, gap: spacing.xxs },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
    flex: { flex: 1 },
  });

export const ActivityListItem = memo(ActivityListItemBase);
