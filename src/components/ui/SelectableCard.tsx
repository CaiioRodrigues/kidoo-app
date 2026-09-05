import { Ionicons } from '@expo/vector-icons';
import { memo, useCallback } from 'react';
import * as Haptics from 'expo-haptics';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { Text } from './Text';
import { radius, spacing, useStyles, useTheme, type ThemeColors } from '@/theme';

export type SelectableCardProps = {
  label: string;
  emoji: string;
  selected: boolean;
  onToggle: () => void;
};

/** Tile de modalidade da tela "Quais atividades ele mais gosta?". */
function SelectableCardBase({ label, emoji, selected, onToggle }: SelectableCardProps) {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const handlePress = useCallback(() => {
    if (Platform.OS !== 'web') {
      void Haptics.selectionAsync();
    }
    onToggle();
  }, [onToggle]);

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={label}
      onPress={handlePress}
      style={({ pressed }) => [
        styles.card,
        selected ? styles.cardSelected : styles.cardIdle,
        pressed && styles.pressed,
      ]}
    >
      {selected ? (
        <View style={styles.check}>
          <Ionicons name="checkmark" size={14} color={colors.textOnPrimary} />
        </View>
      ) : null}
      <Text style={styles.emoji}>{emoji}</Text>
      <Text variant="label" color={selected ? colors.primary : colors.text} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      flex: 1,
      minHeight: 108,
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      padding: spacing.md,
      borderRadius: radius.lg,
      borderWidth: 2,
    },
    cardIdle: { backgroundColor: colors.background, borderColor: colors.border },
    cardSelected: { backgroundColor: colors.primaryTint, borderColor: colors.primary },
    pressed: { opacity: 0.85, transform: [{ scale: 0.97 }] },
    emoji: { fontSize: 30, lineHeight: 36 },
    check: {
      position: 'absolute',
      top: spacing.sm,
      right: spacing.sm,
      width: 22,
      height: 22,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
    },
  });

export const SelectableCard = memo(SelectableCardBase);
