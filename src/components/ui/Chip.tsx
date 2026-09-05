import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { Text } from './Text';
import { colors, radius, spacing } from '@/theme';

export type ChipProps = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  left?: React.ReactNode;
  right?: React.ReactNode;
  tone?: 'default' | 'brand' | 'muted';
  style?: ViewStyle;
};

export function Chip({
  label,
  selected = false,
  onPress,
  left,
  right,
  tone = 'default',
  style,
}: ChipProps) {
  const background = selected
    ? colors.primarySoft
    : tone === 'muted'
      ? colors.backgroundMuted
      : colors.background;
  const border = selected ? colors.primary : colors.border;
  const label_ = selected ? colors.primary : colors.text;

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
