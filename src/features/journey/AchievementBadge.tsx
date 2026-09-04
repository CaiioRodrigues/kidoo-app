import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { colors, radius, spacing } from '@/theme';
import type { Achievement } from '@/types/domain';

/** Conquista bloqueada aparece esmaecida — mostra o que ainda dá para buscar. */
export function AchievementBadge({ achievement }: { achievement: Achievement }) {
  const unlocked = achievement.unlockedAt !== null;

  return (
    <View
      style={[styles.badge, unlocked ? styles.unlocked : styles.locked]}
      accessibilityLabel={`${achievement.label}${unlocked ? '' : ', ainda bloqueada'}`}
    >
      <Text style={[styles.emoji, !unlocked && styles.dimmed]}>{achievement.emoji}</Text>
      <Text
        variant="caption"
        color={unlocked ? colors.text : colors.textFaint}
        center
        numberOfLines={2}
      >
        {achievement.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flex: 1,
    minHeight: 92,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    padding: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1.5,
  },
  unlocked: { backgroundColor: colors.primaryTint, borderColor: colors.primarySoft },
  locked: { backgroundColor: colors.backgroundMuted, borderColor: colors.border },
  emoji: { fontSize: 26, lineHeight: 32 },
  dimmed: { opacity: 0.35 },
});
