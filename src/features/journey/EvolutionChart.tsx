import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { colors, radius, spacing } from '@/theme';

const CHART_HEIGHT = 96;

/**
 * Gráfico de barras da evolução semanal.
 * Feito com Views em vez de biblioteca: são poucos pontos, e evitar uma
 * dependência de charting mantém o bundle menor e o render mais barato.
 */
export function EvolutionChart({ data }: { data: { label: string; count: number }[] }) {
  const max = Math.max(1, ...data.map((item) => item.count));

  return (
    <View
      style={styles.container}
      accessibilityRole="image"
      accessibilityLabel={`Evolução por semana: ${data
        .map((item) => `${item.label}, ${item.count} aulas`)
        .join('; ')}`}
    >
      {data.map((item) => (
        <View key={item.label} style={styles.column}>
          <Text variant="caption" color={colors.textFaint}>
            {item.count > 0 ? item.count : ''}
          </Text>
          <View style={styles.track}>
            <View
              style={[
                styles.bar,
                {
                  height: Math.max(6, (item.count / max) * CHART_HEIGHT),
                  backgroundColor: item.count > 0 ? colors.primary : colors.border,
                },
              ]}
            />
          </View>
          <Text variant="caption" color={colors.textFaint}>
            {item.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  column: { flex: 1, alignItems: 'center', gap: spacing.xs },
  track: { height: CHART_HEIGHT, justifyContent: 'flex-end' },
  bar: { width: 22, borderRadius: radius.sm },
});
