import { StyleSheet, View, type ViewProps } from 'react-native';

import {
  radius,
  shadows,
  spacing,
  useStyles,
  useTheme,
  type ShadowToken,
  type ThemeColors,
} from '@/theme';

export type CardProps = ViewProps & {
  elevation?: ShadowToken;
  padded?: boolean;
  bordered?: boolean;
  background?: string;
};

export function Card({
  elevation = 'card',
  padded = true,
  bordered = false,
  background,
  style,
  ...rest
}: CardProps) {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  // O padrão depende do tema, então resolve aqui e não na assinatura.
  const surface = background ?? colors.card;

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: surface },
        padded && styles.padded,
        bordered && styles.bordered,
        shadows[elevation],
        style,
      ]}
      {...rest}
    />
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: { borderRadius: radius.xl, overflow: 'hidden' },
    padded: { padding: spacing.base },
    bordered: { borderWidth: 1, borderColor: colors.border },
  });
