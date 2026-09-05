import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from './Text';
import {
  minTouchTarget,
  radius,
  spacing,
  useStyles,
  useTheme,
  type ThemeColors,
  type ThemeMode,
} from '@/theme';

const OPTIONS: { mode: ThemeMode; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { mode: 'light', label: 'Claro', icon: 'sunny-outline' },
  { mode: 'dark', label: 'Escuro', icon: 'moon-outline' },
  { mode: 'system', label: 'Automático', icon: 'phone-portrait-outline' },
];

/**
 * Seletor de tema. "Automático" segue o aparelho — é o padrão, porque a
 * maioria já configurou a preferência no sistema.
 */
export function ThemePicker() {
  const { colors, mode, setMode } = useTheme();
  const styles = useStyles(makeStyles);

  return (
    <View style={styles.row} accessibilityRole="radiogroup">
      {OPTIONS.map((option) => {
        const active = mode === option.mode;
        return (
          <Pressable
            key={option.mode}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`Tema ${option.label}`}
            onPress={() => setMode(option.mode)}
            style={({ pressed }) => [
              styles.option,
              active && styles.optionActive,
              pressed && styles.pressed,
            ]}
          >
            <Ionicons
              name={option.icon}
              size={18}
              color={active ? colors.primary : colors.textFaint}
            />
            <Text variant="caption" color={active ? colors.primary : colors.textMuted}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    row: { flexDirection: 'row', gap: spacing.sm },
    option: {
      flex: 1,
      minHeight: minTouchTarget,
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xxs,
      paddingVertical: spacing.md,
      borderRadius: radius.md,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    optionActive: { borderColor: colors.primary, backgroundColor: colors.primaryTint },
    pressed: { opacity: 0.7 },
  });
