import * as Haptics from 'expo-haptics';
import { useCallback } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  View,
  type PressableProps,
  type ViewStyle,
} from 'react-native';

import { Text } from './Text';
import { minTouchTarget, radius, shadows, spacing, useTheme, type ThemeColors } from '@/theme';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

export type ButtonProps = Omit<PressableProps, 'style' | 'children'> & {
  title: string;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  fullWidth?: boolean;
  left?: React.ReactNode;
  right?: React.ReactNode;
  haptic?: boolean;
  style?: ViewStyle;
};

const HEIGHTS: Record<Size, number> = { sm: 40, md: 48, lg: 56 };

export function Button({
  title,
  variant = 'primary',
  size = 'lg',
  loading = false,
  disabled = false,
  fullWidth = true,
  left,
  right,
  haptic = true,
  style,
  onPress,
  ...rest
}: ButtonProps) {
  const { colors } = useTheme();
  const isDisabled = disabled || loading;

  const handlePress = useCallback<NonNullable<PressableProps['onPress']>>(
    (event) => {
      if (haptic && Platform.OS !== 'web') {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      onPress?.(event);
    },
    [haptic, onPress],
  );

  const v = variantsFor(colors)[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      accessibilityLabel={title}
      disabled={isDisabled}
      onPress={handlePress}
      style={({ pressed }) => [
        styles.base,
        { height: HEIGHTS[size], backgroundColor: v.background, borderColor: v.border },
        v.border !== 'transparent' && styles.bordered,
        variant === 'primary' && !isDisabled && shadows.card,
        fullWidth && styles.fullWidth,
        pressed && styles.pressed,
        isDisabled && styles.disabled,
        style,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={v.label} />
      ) : (
        <View style={styles.content}>
          {left ? <View style={styles.slot}>{left}</View> : null}
          <Text variant="button" color={v.label} numberOfLines={1}>
            {title}
          </Text>
          {right ? <View style={styles.slot}>{right}</View> : null}
        </View>
      )}
    </Pressable>
  );
}

const variantsFor = (
  colors: ThemeColors,
): Record<Variant, { background: string; label: string; border: string }> => ({
  primary: { background: colors.primary, label: colors.textOnPrimary, border: 'transparent' },
  secondary: { background: colors.background, label: colors.primary, border: colors.border },
  ghost: { background: 'transparent', label: colors.primary, border: 'transparent' },
  danger: { background: colors.danger, label: colors.textOnPrimary, border: 'transparent' },
});

const styles = StyleSheet.create({
  base: {
    minHeight: minTouchTarget,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  bordered: { borderWidth: 1.5 },
  fullWidth: { alignSelf: 'stretch' },
  content: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  slot: { alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.85, transform: [{ scale: 0.985 }] },
  disabled: { opacity: 0.45 },
});
