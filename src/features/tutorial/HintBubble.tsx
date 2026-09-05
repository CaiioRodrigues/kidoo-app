import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { Mascot } from './Mascot';
import { Text } from '@/components/ui';
import { hitSlop, radius, shadows, spacing, useStyles, useTheme, type ThemeColors } from '@/theme';

/**
 * Dica do Kiddo dentro da própria tela, ao lado do que ele está explicando.
 * Diferente do tutorial de abertura, ela não bloqueia a tela: a pessoa pode
 * ignorar e seguir usando.
 */
export function HintBubble({
  text,
  visible,
  onDismiss,
}: {
  text: string;
  visible: boolean;
  onDismiss: () => void;
}) {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);

  if (!visible) return null;

  return (
    <Animated.View
      entering={FadeIn.duration(320)}
      exiting={FadeOut.duration(180)}
      style={styles.row}
    >
      <Mascot size={54} waving={false} />

      <View style={styles.bubble}>
        <Text variant="caption" color={colors.text} style={styles.text}>
          {text}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Entendi, fechar dica"
          hitSlop={hitSlop}
          onPress={onDismiss}
        >
          <Ionicons name="close" size={16} color={colors.textFaint} />
        </Pressable>
      </View>
    </Animated.View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    bubble: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      padding: spacing.md,
      borderRadius: radius.lg,
      backgroundColor: colors.primaryTint,
      borderWidth: 1,
      borderColor: colors.primarySoft,
      ...shadows.card,
    },
    text: { flex: 1 },
  });
