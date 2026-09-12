import { StyleSheet, View } from 'react-native';

import { AchievementIcon } from './AchievementIcon';
import { Text } from '@/components/ui';
import { radius, spacing, useStyles, useTheme, type ThemeColors } from '@/theme';
import type { Achievement } from '@/types/domain';

/** Conquista bloqueada aparece esmaecida — mostra o que ainda dá para buscar. */
export function AchievementBadge({ achievement }: { achievement: Achievement }) {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const unlocked = achievement.unlockedAt !== null;

  return (
    <View
      style={[styles.badge, unlocked ? styles.unlocked : styles.locked]}
      // A dica só entra quando ainda há o que buscar. Na destravada ela seria
      // ruído: quem já fez cinco aulas não precisa que leiam "complete 5 aulas".
      accessibilityLabel={
        unlocked ? achievement.label : `${achievement.label}, bloqueada. ${achievement.hint}`
      }
    >
      <AchievementIcon
        icon={achievement.icon}
        tone={achievement.tone}
        size={40}
        locked={!unlocked}
      />
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

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    badge: {
      flex: 1,
      minHeight: 104,
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      // Padding lateral estreito: com 4 colunas, "Explorador" quebrava no meio
      // da palavra por falta de alguns pixels.
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.xxs,
      borderRadius: radius.lg,
      borderWidth: 1.5,
    },
    unlocked: { backgroundColor: colors.primaryTint, borderColor: colors.primarySoft },
    locked: { backgroundColor: colors.backgroundMuted, borderColor: colors.border },
  });
