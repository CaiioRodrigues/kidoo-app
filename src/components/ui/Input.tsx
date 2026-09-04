import { Ionicons } from '@expo/vector-icons';
import { forwardRef, useCallback, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { Text } from './Text';
import { colors, fontFamily, hitSlop, minTouchTarget, radius, spacing } from '@/theme';

export type InputProps = Omit<TextInputProps, 'style'> & {
  label?: string;
  error?: string | undefined;
  hint?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  suffix?: React.ReactNode;
  containerStyle?: ViewStyle;
  /** Campo somente de exibição que abre um seletor ao toque (data, cidade...). */
  onPressField?: () => void;
};

export const Input = forwardRef<TextInput, InputProps>(function Input(
  {
    label,
    error,
    hint,
    icon,
    suffix,
    containerStyle,
    onPressField,
    secureTextEntry,
    onFocus,
    onBlur,
    ...rest
  },
  ref,
) {
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const isPassword = Boolean(secureTextEntry);

  const handleFocus = useCallback<NonNullable<TextInputProps['onFocus']>>(
    (e) => {
      setFocused(true);
      onFocus?.(e);
    },
    [onFocus],
  );

  const handleBlur = useCallback<NonNullable<TextInputProps['onBlur']>>(
    (e) => {
      setFocused(false);
      onBlur?.(e);
    },
    [onBlur],
  );

  const field = (
    <View
      style={[styles.field, focused && styles.fieldFocused, Boolean(error) && styles.fieldError]}
    >
      {icon ? <Ionicons name={icon} size={20} color={colors.primary} style={styles.icon} /> : null}
      <TextInput
        ref={ref}
        style={styles.input}
        placeholderTextColor={colors.textFaint}
        cursorColor={colors.primary}
        selectionColor={colors.primary}
        onFocus={handleFocus}
        onBlur={handleBlur}
        editable={onPressField ? false : rest.editable}
        pointerEvents={onPressField ? 'none' : 'auto'}
        secureTextEntry={isPassword && !revealed}
        accessibilityLabel={label ?? rest.placeholder}
        maxFontSizeMultiplier={1.3}
        {...rest}
      />
      {isPassword ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={revealed ? 'Ocultar senha' : 'Mostrar senha'}
          hitSlop={hitSlop}
          onPress={() => setRevealed((v) => !v)}
        >
          <Ionicons
            name={revealed ? 'eye-off-outline' : 'eye-outline'}
            size={20}
            color={colors.textFaint}
          />
        </Pressable>
      ) : null}
      {suffix}
    </View>
  );

  return (
    <View style={[styles.container, containerStyle]}>
      {label ? (
        <Text variant="label" color={colors.textMuted} style={styles.label}>
          {label}
        </Text>
      ) : null}

      {onPressField ? (
        <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPressField}>
          {field}
        </Pressable>
      ) : (
        field
      )}

      {error ? (
        <Text variant="caption" color={colors.danger} style={styles.helper}>
          {error}
        </Text>
      ) : hint ? (
        <Text variant="caption" color={colors.textFaint} style={styles.helper}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  container: { gap: spacing.xs },
  label: { marginLeft: spacing.xxs },
  field: {
    minHeight: minTouchTarget + 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.base,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  fieldFocused: { borderColor: colors.primary, backgroundColor: colors.primaryTint },
  fieldError: { borderColor: colors.danger, backgroundColor: colors.dangerSoft },
  icon: { width: 20 },
  input: {
    flex: 1,
    paddingVertical: spacing.md,
    color: colors.text,
    fontFamily: fontFamily.medium,
    fontSize: 15,
  },
  helper: { marginLeft: spacing.xxs },
});
