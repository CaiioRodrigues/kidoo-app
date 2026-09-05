import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { CoinBadge, Text } from '@/components/ui';
import { formatDistance, formatSessionTime } from '@/lib/format';
import { colors, radius, shadows, spacing } from '@/theme';
import type { Activity } from '@/types/domain';

const BLURHASH = 'L5H2EC=PM+yV0g-mq.wG9c010J}I';

export const ACTIVITY_CARD_WIDTH = 232;

/** Card horizontal usado no carrossel de recomendados da Home. */
function ActivityCardBase({ activity, onPress }: { activity: Activity; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${activity.title}, ${activity.partner.name}`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <Image
        source={{ uri: activity.imageUrl }}
        style={styles.image}
        contentFit="cover"
        placeholder={{ blurhash: BLURHASH }}
        transition={200}
        cachePolicy="memory-disk"
        recyclingKey={activity.id}
        accessibilityIgnoresInvertColors
      />

      <View style={styles.content}>
        <Text variant="bodyStrong" numberOfLines={1}>
          {activity.title}
        </Text>

        <View style={styles.metaRow}>
          <Text variant="caption" color={colors.textMuted}>
            {activity.minAge}-{activity.maxAge} anos
          </Text>
          <Text variant="caption" color={colors.textFaint}>
            •
          </Text>
          <Ionicons name="star" size={12} color={colors.accentYellow} />
          <Text variant="caption" color={colors.textMuted}>
            {activity.rating.toFixed(1).replace('.', ',')}
          </Text>
        </View>

        <View style={styles.metaRow}>
          <Ionicons name="location-outline" size={13} color={colors.textFaint} />
          <Text variant="caption" color={colors.textMuted} numberOfLines={1} style={styles.flex}>
            {activity.partner.neighborhood} • {formatDistance(activity.distanceKm)}
          </Text>
        </View>

        <View style={styles.metaRow}>
          <Ionicons name="time-outline" size={13} color={colors.textFaint} />
          <Text variant="caption" color={colors.textMuted}>
            {formatSessionTime(activity.nextSessionAt)}
          </Text>
        </View>

        <CoinBadge amount={activity.coinCost} size="sm" />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: ACTIVITY_CARD_WIDTH,
    borderRadius: radius.xl,
    backgroundColor: colors.card,
    overflow: 'hidden',
    ...shadows.card,
  },
  pressed: { opacity: 0.9, transform: [{ scale: 0.99 }] },
  image: { width: '100%', height: 124, backgroundColor: colors.backgroundMuted },
  content: { padding: spacing.md, gap: spacing.xs },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  flex: { flex: 1 },
});

export const ActivityCard = memo(ActivityCardBase);
