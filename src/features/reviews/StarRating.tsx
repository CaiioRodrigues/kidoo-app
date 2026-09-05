import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { spacing, useTheme } from '@/theme';

/**
 * Estrelas de 0 a 5, com meia estrela. A meia é decidida por arredondamento
 * para o 0,5 mais próximo, então 4,3 mostra 4 cheias e meia — o número exato
 * fica ao lado, para não depender só do desenho.
 */
export function StarRating({
  rating,
  size = 14,
  showValue = false,
  reviewCount,
}: {
  rating: number;
  size?: number;
  showValue?: boolean;
  reviewCount?: number;
}) {
  const { colors } = useTheme();
  const rounded = Math.round(rating * 2) / 2;

  return (
    <View
      style={styles.row}
      accessibilityLabel={
        reviewCount === undefined
          ? `Nota ${rating.toFixed(1).replace('.', ',')} de 5`
          : `Nota ${rating.toFixed(1).replace('.', ',')} de 5, ${reviewCount} avaliações`
      }
    >
      {[1, 2, 3, 4, 5].map((position) => {
        const name =
          rounded >= position ? 'star' : rounded >= position - 0.5 ? 'star-half' : 'star-outline';
        return (
          <Ionicons
            key={position}
            name={name}
            size={size}
            color={name === 'star-outline' ? colors.textFaint : colors.accentYellow}
          />
        );
      })}

      {showValue ? (
        <Text variant="label" color={colors.textMuted} style={styles.value}>
          {rating.toFixed(1).replace('.', ',')}
          {reviewCount !== undefined ? ` (${reviewCount})` : ''}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  value: { marginLeft: spacing.xs },
});
