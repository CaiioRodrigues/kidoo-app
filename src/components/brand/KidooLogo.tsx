import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { Text } from '@/components/ui';
import { fontFamily, palette } from '@/theme';

type Props = {
  size?: number;
  /** Em fundo escuro o "Kid" vira branco para manter contraste. */
  onDark?: boolean;
};

/**
 * Marca do Kidoo: "Kid" no roxo da marca e dois "o" sorridentes
 * (amarelo e rosa), reproduzindo o logotipo do guia de identidade.
 */
export function KidooLogo({ size = 44, onDark = false }: Props) {
  const circle = size * 0.86;
  const smile = circle * 0.44;

  return (
    <View style={styles.row} accessibilityRole="image" accessibilityLabel="Kidoo">
      <Text
        style={[
          styles.word,
          { fontSize: size, lineHeight: size * 1.12, color: onDark ? '#FFFFFF' : palette.purple },
        ]}
      >
        Kid
      </Text>

      <SmileCircle color={palette.yellow} diameter={circle} smileWidth={smile} />
      <SmileCircle color={palette.pink} diameter={circle} smileWidth={smile} />
    </View>
  );
}

function SmileCircle({
  color,
  diameter,
  smileWidth,
}: {
  color: string;
  diameter: number;
  smileWidth: number;
}) {
  const stroke = Math.max(2, diameter * 0.09);

  return (
    <View
      style={[
        styles.circle,
        { width: diameter, height: diameter, borderRadius: diameter / 2, backgroundColor: color },
      ]}
    >
      <Svg width={smileWidth} height={smileWidth / 2 + stroke} viewBox="0 0 20 12">
        <Path
          d="M2 2 C 5 10, 15 10, 18 2"
          stroke="#FFFFFF"
          strokeWidth={3.2}
          strokeLinecap="round"
          fill="none"
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  word: { fontFamily: fontFamily.extrabold, letterSpacing: -1 },
  circle: { alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
});
