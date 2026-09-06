import Svg, { Circle, Ellipse, Path } from 'react-native-svg';

import { categoryTone, useTheme } from '@/theme';
import type { ActivityCategoryId } from '@/types/domain';

/**
 * Ícone desenhado de cada modalidade.
 *
 * Emoji resolve rápido, mas cada plataforma desenha o seu — o app fica com a
 * cara do sistema, não da marca. Estes são traçados grossos e arredondados,
 * na mesma linguagem do logotipo, e assumem a cor da modalidade.
 */
export function CategoryIcon({
  category,
  size = 28,
  color,
}: {
  category: ActivityCategoryId;
  size?: number;
  color?: string;
}) {
  const { isDark } = useTheme();
  const stroke = color ?? categoryTone(category, isDark).solid;
  const props: P = {
    stroke,
    strokeWidth: 2.4,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    fill: 'none',
  };

  return (
    <Svg width={size} height={size} viewBox="0 0 32 32">
      {GLYPHS[category](props)}
    </Svg>
  );
}

type P = {
  stroke: string;
  strokeWidth: number;
  strokeLinecap: 'round';
  strokeLinejoin: 'round';
  fill: 'none';
};

const GLYPHS: Record<ActivityCategoryId, (p: P) => React.ReactNode> = {
  // Bola: círculo com os gomos centrais
  futebol: (p) => (
    <>
      <Circle cx="16" cy="16" r="11" {...p} />
      <Path d="M16 9.5 L20.5 13 L18.8 18.4 L13.2 18.4 L11.5 13 Z" {...p} />
      <Path d="M16 5 L16 9.5 M27 13 L20.5 13 M22.5 25 L18.8 18.4 M9.5 25 L13.2 18.4 M5 13 L11.5 13" {...p} />
    </>
  ),
  // Nado: braçada sobre as ondas
  natacao: (p) => (
    <>
      <Circle cx="21" cy="10" r="2.8" {...p} />
      <Path d="M6 17 L12 13.5 L17.5 15.5 L23 12" {...p} />
      <Path d="M4 24 q4 -3 8 0 t8 0 t8 0" {...p} />
    </>
  ),
  // Kimono: gola em V, faixa e as pontas do nó
  judo: (p) => (
    <>
      <Path d="M11 7 L7 10 L9.5 13 L9.5 26 L22.5 26 L22.5 13 L25 10 L21 7" {...p} />
      <Path d="M11 7 L16 14 L21 7" {...p} />
      <Path d="M7 18 L25 18" {...p} strokeWidth={3.4} />
      <Path d="M15 20 L13.5 25 M17 20 L18.5 25" {...p} />
    </>
  ),
  // Figura em giro, um braço no alto
  danca: (p) => (
    <>
      <Circle cx="18" cy="6.5" r="2.7" {...p} />
      <Path d="M18 9.5 q-3 4 -4 8" {...p} />
      <Path d="M14 17.5 q-5 1 -8 -2" {...p} />
      <Path d="M18 11 q5 -1 7 -5" {...p} />
      <Path d="M8 26 q3 -9 6 -8.5 q4 0.5 6 8.5" {...p} />
    </>
  ),
  // Salto em grand jeté — o gesto que separa ginástica de dança
  ginastica: (p) => (
    <>
      <Circle cx="16" cy="6.5" r="2.8" {...p} />
      <Path d="M16 9.5 L15 18" {...p} />
      <Path d="M9 13 L15 15 L23 7" {...p} />
      <Path d="M5 25 L15 18 L27 23" {...p} />
    </>
  ),
  // Raquete inclinada e a bolinha
  tenis: (p) => (
    <>
      <Ellipse cx="13.5" cy="12.5" rx="7.5" ry="9" transform="rotate(-32 13.5 12.5)" {...p} />
      <Path d="M18.5 19.5 L25 26.5" {...p} />
      <Circle cx="25" cy="10" r="3" {...p} />
    </>
  ),
  // Bola de basquete com as linhas
  basquete: (p) => (
    <>
      <Circle cx="16" cy="16" r="11" {...p} />
      <Path d="M16 5 L16 27 M5 16 L27 16" {...p} />
      <Path d="M8 8 q8 8 0 16 M24 8 q-8 8 0 16" {...p} />
    </>
  ),
  // Vôlei: gomos assimétricos, que é o que distingue da bola de basquete.
  // Sem a linha da rede embaixo: ela fazia a bola parecer um volante.
  volei: (p) => (
    <>
      <Circle cx="16" cy="16" r="11" {...p} />
      <Path d="M7.5 9 q7 9 2 17" {...p} />
      <Path d="M20 5.6 q-6 9 -1 20.8" {...p} />
      <Path d="M5.2 18.5 q11 -5 21.6 -1.5" {...p} />
    </>
  ),
  // Paleta de tintas
  artes: (p) => (
    <>
      <Path d="M16 5 q11 0 11 9 0 5 -5 5 h-3 q-2 0 -2 2 0 3 -3 3 -9 0 -9 -9.5T16 5Z" {...p} />
      <Circle cx="12" cy="12" r="1.6" {...p} />
      <Circle cx="18" cy="10" r="1.6" {...p} />
      <Circle cx="21.5" cy="15" r="1.6" {...p} />
    </>
  ),
};
