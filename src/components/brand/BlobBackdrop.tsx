import { StyleSheet, View, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { useTheme } from '@/theme';

/**
 * Formas orgânicas da identidade, atrás do cabeçalho.
 *
 * O guia da marca é cheio de blobs, mas eles tinham ficado só na abertura —
 * as telas internas eram fundo liso. Trazê-los para cá dá personalidade sem
 * atrapalhar: ficam por trás do conteúdo, com opacidade baixa.
 */
export function BlobBackdrop({
  height = 220,
  style,
}: {
  height?: number;
  /** Para sangrar as formas além do padding da tela (`left`/`right` negativos). */
  style?: ViewStyle;
}) {
  const { palette, isDark } = useTheme();
  // Opacidade baixa de propósito: o texto do cabeçalho passa por cima destas
  // formas. Na primeira tentativa elas competiam com a saudação e atrapalhavam
  // a leitura.
  const opacity = isDark ? 0.16 : 0.2;

  return (
    <View style={[styles.wrapper, { height }, style]} pointerEvents="none">
      <Svg width="100%" height={height} viewBox="0 0 390 220" preserveAspectRatio="none">
        {/* Curvas fechadas, sem nenhum trecho reto: o que faz a forma parecer
            orgânica em vez de um retângulo arredondado. */}
        <Path
          d="M330 -120 C 425 -112, 478 -24, 436 62 C 396 144, 280 138, 248 62 C 218 -8, 262 -124, 330 -120 Z"
          fill={palette.purple}
          opacity={opacity}
        />
        <Path
          d="M60 -150 C 130 -142, 162 -66, 120 -14 C 78 38, -6 22, -32 -34 C -56 -88, -6 -156, 60 -150 Z"
          fill={palette.teal}
          opacity={opacity * 0.85}
        />
        <Path
          d="M392 96 C 442 90, 476 136, 454 178 C 432 220, 368 214, 352 172 C 338 134, 354 100, 392 96 Z"
          fill={palette.yellow}
          opacity={opacity * 0.9}
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', top: 0, left: 0, right: 0, overflow: 'hidden' },
});
