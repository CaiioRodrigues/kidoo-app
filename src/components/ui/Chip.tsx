import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { Text } from './Text';
import { radius, spacing, useTheme } from '@/theme';

export type ChipProps = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  left?: React.ReactNode;
  right?: React.ReactNode;
  tone?: 'default' | 'brand' | 'muted';
  /** Cor da modalidade, quando o chip representa uma. */
  tint?: { solid: string; soft: string };
  style?: ViewStyle;
};

export function Chip({
  label,
  selected = false,
  onPress,
  left,
  right,
  tone = 'default',
  tint,
  style,
}: ChipProps) {
  const { colors } = useTheme();
  // Com cor de modalidade, o chip selecionado assume a cor dela — é o que
  // torna o filtro reconhecível de longe, sem depender de ler o rótulo.
  const background = selected
    ? (tint?.soft ?? colors.primarySoft)
    : tone === 'muted'
      ? colors.backgroundMuted
      : colors.background;
  const border = selected ? (tint?.solid ?? colors.primary) : colors.border;
  const label_ = selected ? (tint?.solid ?? colors.primary) : colors.text;

  const content = (
    <View style={[styles.chip, { backgroundColor: background, borderColor: border }, style]}>
      {left}
      <Text variant="label" color={label_} numberOfLines={1}>
        {label}
      </Text>
      {right}
    </View>
  );

  if (!onPress) return content;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => pressed && styles.pressed}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 38,
    paddingHorizontal: spacing.base,
    borderRadius: radius.pill,
    borderWidth: 1.5,
  },
  pressed: { opacity: 0.7 },
});
