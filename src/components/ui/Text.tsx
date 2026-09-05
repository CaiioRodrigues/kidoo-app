import { memo } from 'react';
import { Text as RNText, StyleSheet, type TextProps as RNTextProps } from 'react-native';

import { colors, textVariants, type TextVariant } from '@/theme';

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
  color = colors.text,
  center = false,
  style,
  // Respeita o tamanho de fonte do sistema, mas com teto para não quebrar layout.
  maxFontSizeMultiplier = 1.4,
  ...rest
}: AppTextProps) {
  return (
    <RNText
      maxFontSizeMultiplier={maxFontSizeMultiplier}
      style={[textVariants[variant], { color }, center && styles.center, style]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  center: { textAlign: 'center' },
});

export const Text = memo(AppTextBase);
