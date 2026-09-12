import Svg, { Circle, Path } from 'react-native-svg';

import { useTheme } from '@/theme';
import type { AchievementIcon as IconId, AchievementTone } from '@/types/domain';

/**
 * A medalha de uma conquista, desenhada.
 *
 * Eram emoji a `fontSize: 26`, e emoji tem dois problemas que já conhecemos
 * daqui: cada sistema desenha o seu (o app fica com a cara do Android, não com
 * a do Kidoo) e a fonte do sistema tem métricas mais altas que as da Poppins,
 * o que corta o glifo dentro de linha de altura fixa. É a mesma história do
 * `CoinIcon`, agora doze vezes.
 *
 * O desenho é sempre o mesmo par: disco cheio na cor da conquista, anel de
 * relevo por dentro, e o glifo por cima. O que muda entre as doze é só o
 * glifo e a cor — assim uma medalha nova custa um `Path`, não uma ilustração.
 */
export function AchievementIcon({
  icon,
  tone,
  size = 44,
  locked = false,
}: {
  icon: IconId;
  tone: AchievementTone;
  size?: number;
  locked?: boolean;
}) {
  const { colors, isDark } = useTheme();

  // Bloqueada não é uma medalha apagada: é uma medalha que ainda não existe.
  // Por isso o disco assume a cor de superfície do tema (e acompanha claro e
  // escuro), enquanto a destravada tem cor própria e fixa.
  const face = locked ? colors.backgroundMuted : TONS[tone].face;
  const relief = locked ? colors.border : TONS[tone].relief;
  const glifo = locked ? colors.textFaint : '#FFFFFF';

  const traco = {
    stroke: glifo,
    strokeWidth: 2.1,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: 'none' as const,
  };

  return (
    <Svg width={size} height={size} viewBox="0 0 40 40">
      <Circle cx="20" cy="20" r="19" fill={face} />
      <Circle cx="20" cy="20" r="15.6" stroke={relief} strokeWidth="1.6" fill="none" />
      {GLYPHS[icon]({ ...traco, cheio: glifo, escuro: isDark })}
    </Svg>
  );
}

type P = {
  stroke: string;
  strokeWidth: number;
  strokeLinecap: 'round';
  strokeLinejoin: 'round';
  fill: 'none';
  /** Cor para os glifos que ficam melhor preenchidos que traçados. */
  cheio: string;
  escuro: boolean;
};

/*
  As cores não vêm do tema, pelo mesmo motivo do `CoinIcon`: medalha é objeto,
  não superfície. Uma medalha de ouro é da mesma cor na sala clara e na escura.
  O `relief` é a versão clara da face, e existe para o anel aparecer sem
  precisar de sombra.
*/
const TONS: Record<AchievementTone, { face: string; relief: string }> = {
  ouro: { face: '#E9960E', relief: '#FFD98A' },
  laranja: { face: '#D9451F', relief: '#FFB199' },
  agua: { face: '#0E8A8F', relief: '#7FE3E6' },
  verde: { face: '#3B7F28', relief: '#A8E68F' },
  rosa: { face: '#C93368', relief: '#FFA8C8' },
  roxo: { face: '#5B32B0', relief: '#BFA3F5' },
};

const GLYPHS: Record<IconId, (p: P) => React.ReactNode> = {
  // Estrela cheia: traçada nesse tamanho as pontas somem.
  estrela: (p) => (
    <Path
      d="M20 11.4 L22.7 16.9 L28.8 17.8 L24.4 22.1 L25.4 28.1 L20 25.3 L14.6 28.1 L15.6 22.1 L11.2 17.8 L17.3 16.9 Z"
      fill={p.cheio}
    />
  ),
  // Raio: também cheio, pelo mesmo motivo.
  raio: (p) => (
    <Path d="M22.6 10.5 L14 21.2 L18.8 21.2 L17.4 29.5 L26 18.4 L21.2 18.4 Z" fill={p.cheio} />
  ),
  // Medalha de fita: o disco em cima e a fita entalhada pendurada embaixo.
  //
  // Duas versões anteriores punham as fitas *acima* do disco, e as duas liam
  // como chifres — dois riscos saindo do topo de um círculo são chifres, não
  // importa a espessura. Com a fita embaixo o desenho é o de uma escarapela, e
  // não há leitura concorrente.
  medalha: (p) => (
    <>
      <Circle cx="20" cy="17.2" r="6.8" {...p} />
      <Path d="M16.6 23 L15 30 L20 27.2 L25 30 L23.4 23" {...p} />
    </>
  ),
  // Troféu: taça, alças, haste e base.
  trofeu: (p) => (
    <>
      <Path d="M14.8 11.4 H25.2 V17.2 A5.2 5.2 0 0 1 14.8 17.2 Z" {...p} />
      <Path d="M14.8 13 H12 A3 3 0 0 0 14.9 17.6 M25.2 13 H28 A3 3 0 0 1 25.1 17.6" {...p} />
      <Path d="M20 22.4 V25.6 M15.8 28.6 H24.2" {...p} />
    </>
  ),
  // Mapa dobrado em três painéis.
  mapa: (p) => (
    <>
      <Path d="M11.2 15 L17 12.4 L23 15 L28.8 12.4 V25 L23 27.6 L17 25 L11.2 27.6 Z" {...p} />
      <Path d="M17 12.4 V25 M23 15 V27.6" {...p} />
    </>
  ),
  // Bússola: aro e agulha. A agulha é cheia, e não traçada — vazada nesse
  // tamanho ela virava um risco diagonal, que é o que qualquer coisa
  // atravessando um círculo parece.
  bussola: (p) => (
    <>
      <Circle cx="20" cy="20" r="9" {...p} />
      <Path d="M25.4 14.6 L18.8 18.8 L14.6 25.4 L21.2 21.2 Z" fill={p.cheio} stroke="none" />
    </>
  ),
  coroa: (p) => (
    <>
      <Path d="M11.4 26 L13.2 13.6 L17.2 19.4 L20 12 L22.8 19.4 L26.8 13.6 L28.6 26 Z" {...p} />
      <Path d="M13 28.4 H27" {...p} />
    </>
  ),
  // Bola: aro e os gomos centrais, na mesma leitura do ícone de futebol.
  bola: (p) => (
    <>
      <Circle cx="20" cy="20" r="8.8" {...p} />
      <Path d="M20 14.8 L23.6 17.6 L22.2 21.9 L17.8 21.9 L16.4 17.6 Z" {...p} />
      <Path
        d="M20 11.2 V14.8 M28.8 17.6 H23.6 M25.6 27.2 L22.2 21.9 M14.4 27.2 L17.8 21.9 M11.2 17.6 H16.4"
        {...p}
      />
    </>
  ),
  // Ondas: três linhas d'água.
  onda: (p) => (
    <>
      <Path d="M11 16.4 Q14.5 13.6 18 16.4 T25 16.4 T29 16.4" {...p} />
      <Path d="M11 21 Q14.5 18.2 18 21 T25 21 T29 21" {...p} />
      <Path d="M11 25.6 Q14.5 22.8 18 25.6 T25 25.6 T29 25.6" {...p} />
    </>
  ),
  // Nota musical: haste, bandeira e as duas cabeças.
  nota: (p) => (
    <>
      <Path d="M17.4 26 V13.6 L27 11.4 V23.8" {...p} />
      <Path d="M17.4 17.4 L27 15.2" {...p} />
      <Circle cx="14.6" cy="26.6" r="3" {...p} />
      <Circle cx="24.2" cy="24.4" r="3" {...p} />
    </>
  ),
  // Faixa de judô, no nó: as duas alças, o miolo e as pontas caindo.
  //
  // Terceira tentativa, e as duas anteriores erraram do mesmo jeito. Faixa
  // desenhada esticada — uma tira horizontal com um nó quadrado no meio e duas
  // pontas para baixo — é tronco, braços e pernas: sai um bonequinho, e depois
  // de visto não se desvê. O nó de frente não tem essa leitura.
  faixa: (p) => (
    <>
      <Path d="M19 17.4 L11.6 12.6 V22.2 Z" {...p} />
      <Path d="M21 17.4 L28.4 12.6 V22.2 Z" {...p} />
      <Path d="M18.4 21 L16.6 28.4 M21.6 21 L23.4 28.4" {...p} />
    </>
  ),
  // Paleta de pintura: o contorno com o furo do polegar e as tintas.
  paleta: (p) => (
    <>
      <Path
        d="M20 11.2 A8.8 8.8 0 1 0 20 28.8 C22 28.8 21.2 26.6 22.4 25.6 C23.6 24.6 26 25.6 27.4 24 A8.8 8.8 0 0 0 20 11.2 Z"
        {...p}
      />
      <Circle cx="16.4" cy="16.6" r="1.5" fill={p.cheio} stroke="none" />
      <Circle cx="22.6" cy="15.4" r="1.5" fill={p.cheio} stroke="none" />
      <Circle cx="14.6" cy="22" r="1.5" fill={p.cheio} stroke="none" />
    </>
  ),
};
