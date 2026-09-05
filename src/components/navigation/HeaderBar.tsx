import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { colors, hitSlop, minTouchTarget, radius, spacing } from '@/theme';

type Props = {
  title?: string;
  /** Conteúdo central — usado pelo indicador de etapas do onboarding. */
  center?: React.ReactNode;
  right?: React.ReactNode;
  onBack?: () => void;
};

export function HeaderBar({ title, center, right, onBack }: Props) {
  const router = useRouter();

  const handleBack = () => {
    if (onBack) return onBack();
    if (router.canGoBack()) router.back();
  };

  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Voltar"
        hitSlop={hitSlop}
        onPress={handleBack}
        style={({ pressed }) => [styles.back, pressed && styles.pressed]}
      >
        <Ionicons name="arrow-back" size={22} color={colors.primary} />
      </Pressable>

      <View style={styles.center}>
        {center ??
          (title ? (
            <Text variant="subheading" numberOfLines={1}>
              {title}
            </Text>
          ) : null)}
      </View>

      <View style={styles.right}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.base,
    paddingVertical: spacing.md,
  },
  back: {
    width: minTouchTarget,
    height: minTouchTarget,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.6, backgroundColor: colors.primaryTint },
  center: { flex: 1 },
  right: { minWidth: minTouchTarget, alignItems: 'flex-end' },
});
