import { Ionicons } from '@expo/vector-icons';
import { memo, useCallback } from 'react';
import * as Haptics from 'expo-haptics';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { Text } from './Text';
import { CategoryIcon } from '@/components/CategoryIcon';
import { blobRadius, categoryTone, spacing, useStyles, useTheme, type ThemeColors } from '@/theme';
import type { ActivityCategoryId } from '@/types/domain';

export type SelectableCardProps = {
  label: string;
  category: ActivityCategoryId;
  selected: boolean;
  onToggle: () => void;
};

/** Tile de modalidade da tela "Quais atividades ele mais gosta?". */
function SelectableCardBase({ label, category, selected, onToggle }: SelectableCardProps) {
  const { colors, isDark } = useTheme();
  const styles = useStyles(makeStyles);
  const tone = categoryTone(category, isDark);
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
        selected
          ? { backgroundColor: tone.soft, borderColor: tone.solid }
          : styles.cardIdle,
        pressed && styles.pressed,
      ]}
    >
      {selected ? (
        <View style={[styles.check, { backgroundColor: tone.solid }]}>
          <Ionicons name="checkmark" size={14} color={colors.textOnPrimary} />
        </View>
      ) : null}
      <CategoryIcon category={category} size={34} />
      <Text variant="label" color={selected ? tone.solid : colors.text} numberOfLines={1}>
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
      borderWidth: 2,
      ...blobRadius.tile,
    },
    cardIdle: { backgroundColor: colors.background, borderColor: colors.border },
    pressed: { opacity: 0.85, transform: [{ scale: 0.97 }] },
    check: {
      position: 'absolute',
      top: spacing.sm,
      right: spacing.sm,
      width: 22,
      height: 22,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });

export const SelectableCard = memo(SelectableCardBase);
