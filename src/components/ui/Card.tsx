import { StyleSheet, View, type ViewProps } from 'react-native';

import { colors, radius, shadows, spacing, type ShadowToken } from '@/theme';

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
  background = colors.card,
  style,
  ...rest
}: CardProps) {
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: background },
        padded && styles.padded,
        bordered && styles.bordered,
        shadows[elevation],
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.xl, overflow: 'hidden' },
  padded: { padding: spacing.base },
  bordered: { borderWidth: 1, borderColor: colors.border },
});
