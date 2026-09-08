import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { radius, shadows, spacing, useStyles, useTheme, type ThemeColors } from '@/theme';

/**
 * Balão de fala com a "rabinha" apontando para baixo, na direção do mascote.
 * O triângulo é feito com bordas em vez de SVG: é mais leve e acompanha a cor
 * do tema sem nenhum trabalho extra.
 */
export function SpeechBubble({
  title,
  text,
  icon,
}: {
  title: string;
  text: string;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);

  return (
    <View style={styles.wrapper}>
      <View style={styles.bubble}>
        <View style={styles.head}>
          {/*
            Um ícone por passo. Quatro telas de texto puro com o mesmo mascote
            eram indistinguíveis uma da outra: quem voltava um passo não tinha
            como saber que voltou.
          */}
          {icon ? (
            <View style={styles.icone}>
              <Ionicons name={icon} size={19} color={colors.primary} />
            </View>
          ) : null}
          <Text variant="subheading" style={styles.title}>
            {title}
          </Text>
        </View>
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
    head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    icone: {
      width: 34,
      height: 34,
      borderRadius: radius.pill,
      backgroundColor: colors.primaryTint,
      alignItems: 'center',
      justifyContent: 'center',
    },
    // `flex: 1` para o título quebrar em duas linhas em vez de empurrar o
    // ícone para fora do balão numa fonte grande de acessibilidade.
    title: { flex: 1 },
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
