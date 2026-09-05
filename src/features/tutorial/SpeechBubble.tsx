import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { radius, shadows, spacing, useStyles, useTheme, type ThemeColors } from '@/theme';

/**
 * Balão de fala com a "rabinha" apontando para baixo, na direção do mascote.
 * O triângulo é feito com bordas em vez de SVG: é mais leve e acompanha a cor
 * do tema sem nenhum trabalho extra.
 */
export function SpeechBubble({ title, text }: { title: string; text: string }) {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);

  return (
    <View style={styles.wrapper}>
      <View style={styles.bubble}>
        <Text variant="subheading">{title}</Text>
        <Text variant="body" color={colors.textMuted}>
          {text}
        </Text>
      </View>
      <View style={styles.tail} />
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    wrapper: { alignSelf: 'stretch', alignItems: 'flex-start' },
    bubble: {
      alignSelf: 'stretch',
      gap: spacing.sm,
      padding: spacing.lg,
      borderRadius: radius.xxl,
      backgroundColor: colors.card,
      ...shadows.raised,
    },
    tail: {
      marginLeft: spacing.xxl,
      width: 0,
      height: 0,
      borderLeftWidth: 10,
      borderRightWidth: 10,
      borderTopWidth: 14,
      borderLeftColor: 'transparent',
      borderRightColor: 'transparent',
      borderTopColor: colors.card,
    },
  });
