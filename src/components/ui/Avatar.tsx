import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { Text } from './Text';
import { colors, radius } from '@/theme';

const BLURHASH = 'L6PZfSjE.AyE_3t7t7R**0o#DgR4';

/** Iniciais como fallback: nunca mostra caixa vazia enquanto a foto carrega. */
function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

export function Avatar({
  name,
  uri,
  size = 48,
  ring = false,
}: {
  name: string;
  uri?: string | null;
  size?: number;
  ring?: boolean;
}) {
  const dimension = { width: size, height: size, borderRadius: size / 2 };

  return (
    <View
      style={[
        styles.wrapper,
        dimension,
        ring && { borderWidth: 3, borderColor: colors.primarySoft },
      ]}
      accessibilityLabel={`Foto de ${name}`}
    >
      {uri ? (
        <Image
          source={{ uri }}
          style={[styles.image, dimension]}
          contentFit="cover"
          placeholder={{ blurhash: BLURHASH }}
          transition={180}
          cachePolicy="memory-disk"
        />
      ) : (
        <Text variant="bodyStrong" color={colors.primary} style={{ fontSize: size * 0.36 }}>
          {initials(name)}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  image: { backgroundColor: colors.primarySoft },
});
