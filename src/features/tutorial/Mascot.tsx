import Svg, { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';

import { useTheme } from '@/theme';

/**
 * Kiddo, o mascote.
 *
 * Construído com a mesma geometria da marca: corpo redondo e o sorriso em arco
 * dos dois "o" do logotipo. Desenhado em SVG e não como imagem para escalar em
 * qualquer densidade e acompanhar a paleta do tema.
 */
export function Mascot({ size = 96, waving = true }: { size?: number; waving?: boolean }) {
  const { palette } = useTheme();

  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      {/* braços atrás do corpo */}
      <G>
        <Rect
          x="6"
          y="52"
          width="20"
          height="9"
          rx="4.5"
          fill={palette.purpleDark}
          transform={waving ? 'rotate(-28 16 56)' : undefined}
        />
        <Rect x="74" y="56" width="20" height="9" rx="4.5" fill={palette.purpleDark} />
      </G>

      {/* corpo */}
      <Circle cx="50" cy="52" r="34" fill={palette.purple} />

      {/* rosto */}
      <Ellipse cx="39" cy="46" rx="5" ry="6" fill="#FFFFFF" />
      <Ellipse cx="61" cy="46" rx="5" ry="6" fill="#FFFFFF" />
      <Circle cx="40" cy="47" r="2.6" fill="#1E1E2F" />
      <Circle cx="62" cy="47" r="2.6" fill="#1E1E2F" />
      <Path
        d="M 39 60 q 11 11 22 0"
        stroke="#FFFFFF"
        strokeWidth="4.2"
        strokeLinecap="round"
        fill="none"
      />

      {/* bochechas */}
      <Circle cx="30" cy="57" r="4" fill={palette.pink} opacity={0.55} />
      <Circle cx="70" cy="57" r="4" fill={palette.pink} opacity={0.55} />

      {/* antena com a bolinha amarela da marca */}
      <Path
        d="M 50 18 L 50 8"
        stroke={palette.purpleDark}
        strokeWidth="3.4"
        strokeLinecap="round"
      />
      <Circle cx="50" cy="6" r="5" fill={palette.yellow} />
    </Svg>
  );
}
