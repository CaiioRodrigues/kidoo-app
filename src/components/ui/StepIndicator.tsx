import { StyleSheet, View } from 'react-native';

import { radius, spacing, useStyles, type ThemeColors } from '@/theme';

/** Barra de progresso segmentada do onboarding (topo das telas 3 e 4). */
export function StepIndicator({ total, current }: { total: number; current: number }) {
  const styles = useStyles(makeStyles);
  return (
    <View
      style={styles.row}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 1, max: total, now: current }}
      accessibilityLabel={`Etapa ${current} de ${total}`}
    >
      {Array.from({ length: total }, (_, index) => (
        <View
          key={index}
          style={[styles.segment, index < current ? styles.filled : styles.empty]}
        />
      ))}
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    row: { flexDirection: 'row', gap: spacing.sm, flex: 1 },
    segment: { flex: 1, height: 5, borderRadius: radius.pill },
    filled: { backgroundColor: colors.primary },
    empty: { backgroundColor: colors.border },
  });
