import { memo } from 'react';
import { Text as RNText, StyleSheet, type TextProps as RNTextProps } from 'react-native';

import { textVariants, useTheme, type TextVariant } from '@/theme';

export type AppTextProps = RNTextProps & {
  variant?: TextVariant;
  color?: string;
  center?: boolean;
};

/**
 * Único ponto de saída de texto do app: garante Poppins e escala tipográfica
 * consistentes, e evita `fontFamily` solto espalhado pelas telas.
 */
function AppTextBase({
  variant = 'body',
  color,
  center = false,
  style,
  // Respeita o tamanho de fonte do sistema, mas com teto para não quebrar layout.
  maxFontSizeMultiplier = 1.4,
  ...rest
}: AppTextProps) {
  const { colors } = useTheme();
  // A cor padrão vem do tema ativo, então resolve aqui e não na assinatura.
  const tone = color ?? colors.text;

  return (
    <RNText
      maxFontSizeMultiplier={maxFontSizeMultiplier}
      style={[textVariants[variant], { color: tone }, center && styles.center, style]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  center: { textAlign: 'center' },
});

export const Text = memo(AppTextBase);
