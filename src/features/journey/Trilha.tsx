import { useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { AchievementIcon } from './AchievementIcon';
import { CategoryIcon } from '@/components/CategoryIcon';
import { Text } from '@/components/ui';
import { formatPastDate } from '@/lib/format';
import type { PassoDaTrilha } from '@/lib/trilha';
import {
  blobRadius,
  categoryTone,
  spacing,
  useStyles,
  useTheme,
  type ThemeColors,
  type ThemePalette,
} from '@/theme';

/**
 * A trilha da criança: as aulas que aconteceram, em ordem, com as medalhas
 * pousadas na aula que as destravou.
 *
 * O resto da Jornada responde "quanto" — total, por modalidade, por semana.
 * Nenhuma dessas respostas tem ordem, e sem ordem não há jornada: há painel.
 * Aqui a primeira aula fica no alto e a mais recente embaixo, que é onde o
 * olho termina de rolar a tela.
 *
 * ## Por que o caminho é SVG e as linhas não
 *
 * O caminho é uma curva que passa pelos centros dos nós, alternando os lados —
 * e curva de verdade precisa de `Path`. O conteúdo de cada passo é texto, que
 * dentro do SVG perderia quebra de linha, tamanho de fonte do tema e leitor de
 * tela. Então são as duas coisas empilhadas: o traço atrás, em SVG, e os
 * passos por cima, em `View`.
 *
 * Isso obriga a medir a largura (`onLayout`): o `Path` precisa de números, e
 * porcentagem não serve para ele. Antes da primeira medida o traço não
 * desenha, e só ele — os passos já aparecem, então não há tela vazia.
 */

/** Altura de cada passo. Fixa porque é ela que dá as coordenadas ao traço. */
const PASSO = 104;
/** Onde os nós pousam, em fração da largura. Alternados é o que faz a curva. */
const ESQUERDA = 0.2;
const DIREITA = 0.8;
const NO = 56;

/** As cores da marca, cicladas pelas manchas do fundo. */
const CORES_DAS_MANCHAS: ((p: ThemePalette) => string)[] = [
  (p) => p.purple,
  (p) => p.teal,
  (p) => p.yellow,
  (p) => p.pink,
];

/**
 * Uma forma orgânica em torno de um ponto.
 *
 * Quatro cúbicas com os raios desencontrados: círculo perfeito lê como bolha
 * de interface, e a marca não tem nenhum trecho reto nem nenhum raio igual ao
 * vizinho. Os fatores são fixos para a forma não mudar a cada renderização.
 */
function blob(cx: number, cy: number, r: number, variante: number): string {
  // Quatro quartos, cada um com o seu raio. Dois raios iguais já devolvem a
  // oval regular que a primeira versão desenhou — e oval lê como destaque de
  // interface, não como forma da marca.
  const v = variante % 2 === 0 ? 1 : -1;
  const cima = r * (0.9 + 0.22 * v);
  const dir = r * (1.14 - 0.3 * v);
  const baixo = r * (0.78 + 0.34 * v);
  const esq = r * (1.05 + 0.18 * v);
  const k = 0.56;
  return (
    `M ${cx} ${cy - cima} ` +
    `C ${cx + dir * k * 1.3} ${cy - cima}, ${cx + dir} ${cy - baixo * k}, ${cx + dir} ${cy} ` +
    `C ${cx + dir} ${cy + baixo * k * 1.25}, ${cx + esq * k} ${cy + baixo}, ${cx} ${cy + baixo} ` +
    `C ${cx - esq * k * 1.2} ${cy + baixo}, ${cx - esq} ${cy + baixo * k}, ${cx - esq} ${cy} ` +
    `C ${cx - esq} ${cy - cima * k * 1.15}, ${cx - dir * k * 0.9} ${cy - cima}, ${cx} ${cy - cima} Z`
  );
}

export function Trilha({
  passos,
  anteriores = 0,
}: {
  passos: PassoDaTrilha[];
  /** Quantas aulas ficaram antes do trecho mostrado. Zero esconde o aviso. */
  anteriores?: number;
}) {
  const { colors, palette, isDark } = useTheme();
  const styles = useStyles(makeStyles);
  const [largura, setLargura] = useState(0);

  const medir = (e: LayoutChangeEvent) => setLargura(e.nativeEvent.layout.width);

  if (passos.length === 0) return null;

  const altura = passos.length * PASSO;
  const xDoPasso = (i: number) => (i % 2 === 0 ? ESQUERDA : DIREITA) * largura;
  const yDoPasso = (i: number) => i * PASSO + PASSO / 2;
  const corDoPasso = (i: number) => categoryTone(passos[i]!.aula.category, isDark).solid;

  /*
    Um trecho por par de nós, e não um traço só.

    O caminho cinza único era a parte sem vida da tela: cada passo tem a cor da
    modalidade no nó, e a linha que os liga ignorava todas elas. Agora cada
    trecho é um degradê da cor de onde saiu para a cor de onde chega — a
    troca acontece ao longo da curva, e não num corte embaixo do nó.

    A cúbica é a mesma: pontos de controle na vertical de cada ponta, o que dá
    a curva em S e nunca um bico.
  */
  const trechos =
    largura > 0
      ? passos.slice(1).map((_, k) => {
          const i = k + 1;
          const x0 = xDoPasso(i - 1);
          const y0 = yDoPasso(i - 1);
          const x1 = xDoPasso(i);
          const y1 = yDoPasso(i);
          return {
            id: `${passos[i - 1]!.aula.id}-${passos[i]!.aula.id}`,
            d: `M ${x0} ${y0} C ${x0} ${y0 + PASSO / 2}, ${x1} ${y1 - PASSO / 2}, ${x1} ${y1}`,
            de: corDoPasso(i - 1),
            para: corDoPasso(i),
            y0,
            y1,
          };
        })
      : [];

  /*
    O rabo tracejado, depois do último passo.

    A trilha terminar no nó mais recente fecha a história como se ela tivesse
    acabado. O tracejado que segue e some diz o contrário — e é tracejado, e
    não cheio, porque a próxima aula ainda não existe.
  */
  const ultimo = passos.length - 1;
  const rabo =
    largura > 0
      ? `M ${xDoPasso(ultimo)} ${yDoPasso(ultimo)} C ${xDoPasso(ultimo)} ${
          yDoPasso(ultimo) + PASSO * 0.4
        }, ${xDoPasso(ultimo + 1)} ${yDoPasso(ultimo) + PASSO * 0.3}, ${xDoPasso(ultimo + 1)} ${
          yDoPasso(ultimo) + PASSO * 0.62
        }`
      : '';

  /*
    As formas do guia da marca, atrás do caminho.

    Elas existem na abertura e no alto das telas (`BlobBackdrop`) e paravam
    ali. Aqui a superfície é grande e vazia por natureza — é um mapa —, e sem
    elas a trilha flutua em branco. Ficam presas aos passos, e não espalhadas
    ao acaso: uma a cada dois, do lado OPOSTO ao nó, onde não há texto para
    competir com elas.
  */
  const manchas =
    largura > 0
      ? passos
          .map((_, i) => i)
          .filter((i) => i % 2 === 1)
          .map((i) => ({
            id: `mancha-${i}`,
            // Do lado OPOSTO ao nó. Na primeira versão a conta não olhava de
            // que lado o nó estava, e uma mancha caiu bem atrás de um deles:
            // lida assim, ela vira destaque de seleção — o passo parecia
            // escolhido.
            // Encostada na borda, e não no meio do vazio: o `overflow: hidden`
            // do mapa corta boa parte dela, e é o corte que faz a forma ler
            // como fundo. Centrada, ela virava uma faixa clara atrás do texto
            // — parecia realce de linha selecionada.
            // `i % 4`, e não `i % 2`: as manchas só existem em passo ímpar, e
            // `i % 2 === 0` ali dentro nunca é verdadeiro — todas as três
            // caíram do mesmo lado. Alternar pede o dobro do período.
            cx: (i % 4 === 1 ? -0.02 : 1.02) * largura,
            // No vão entre dois passos, não na altura de um deles: é onde não
            // há nó nem texto, e onde o caminho está atravessando o meio.
            cy: yDoPasso(i) + PASSO / 2,
            r: 52 + ((i * 17) % 26),
            cor: CORES_DAS_MANCHAS[i % CORES_DAS_MANCHAS.length]!,
            variante: i,
          }))
      : [];

  return (
    <View>
      {anteriores > 0 ? (
        <Text variant="caption" color={colors.textMuted} style={styles.anteriores}>
          {anteriores === 1
            ? '1 aula antes desta parte da trilha'
            : `${anteriores} aulas antes desta parte da trilha`}
        </Text>
      ) : null}

      <View onLayout={medir} style={[styles.mapa, { height: altura }]}>
        {largura > 0 ? (
          <Svg style={StyleSheet.absoluteFill} width={largura} height={altura} pointerEvents="none">
            <Defs>
              {trechos.map((trecho) => (
                <LinearGradient
                  key={trecho.id}
                  id={trecho.id}
                  x1="0"
                  y1={trecho.y0}
                  x2="0"
                  y2={trecho.y1}
                  gradientUnits="userSpaceOnUse"
                >
                  <Stop offset="0" stopColor={trecho.de} />
                  <Stop offset="1" stopColor={trecho.para} />
                </LinearGradient>
              ))}
            </Defs>

            {manchas.map((mancha) => (
              <Path
                key={mancha.id}
                d={blob(mancha.cx, mancha.cy, mancha.r, mancha.variante)}
                fill={mancha.cor(palette)}
                opacity={isDark ? 0.14 : 0.18}
              />
            ))}

            {trechos.map((trecho) => (
              <Path
                key={trecho.id}
                d={trecho.d}
                stroke={`url(#${trecho.id})`}
                strokeWidth={5}
                strokeLinecap="round"
                fill="none"
              />
            ))}

            <Path
              d={rabo}
              stroke={colors.border}
              strokeWidth={5}
              strokeLinecap="round"
              strokeDasharray="2 12"
              fill="none"
            />
          </Svg>
        ) : null}

        {passos.map((passo, i) => {
          const naEsquerda = i % 2 === 0;
          const tom = categoryTone(passo.aula.category, isDark);
          return (
            <View key={passo.aula.id} style={styles.passo}>
              <View
                style={[
                  styles.no,
                  { backgroundColor: tom.soft, borderColor: tom.solid },
                  naEsquerda ? styles.noEsquerda : styles.noDireita,
                ]}
              >
                <CategoryIcon category={passo.aula.category} size={28} />
              </View>

              <View style={[styles.texto, naEsquerda ? styles.textoDireita : styles.textoEsquerda]}>
                <Text
                  variant="bodyStrong"
                  numberOfLines={2}
                  style={naEsquerda ? undefined : styles.fimDaLinha}
                >
                  {passo.aula.activityName}
                </Text>
                <Text
                  variant="caption"
                  color={colors.textMuted}
                  style={naEsquerda ? undefined : styles.fimDaLinha}
                >
                  {formatPastDate(passo.aula.date)}
                </Text>

                {passo.conquistas.length > 0 ? (
                  <View style={[styles.premios, naEsquerda ? undefined : styles.premiosDireita]}>
                    {passo.conquistas.map((conquista) => (
                      <View key={conquista.id} style={styles.premio}>
                        <AchievementIcon icon={conquista.icon} tone={conquista.tone} size={22} />
                        <Text variant="caption" numberOfLines={1}>
                          {conquista.label}
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const makeStyles = (colors: ThemeColors, _palette: ThemePalette) =>
  StyleSheet.create({
    anteriores: { marginBottom: spacing.sm },
    /*
      A superfície do mapa.

      A trilha ocupa meia tela e, em fundo liso, ela lê como um diagrama solto
      no branco. O tom surdo do tema a transforma numa área — um lugar por onde
      o caminho passa —, e o raio grande num canto é o mesmo recorte dos
      cartões da marca.
    */
    mapa: {
      backgroundColor: colors.backgroundMuted,
      overflow: 'hidden',
      paddingHorizontal: spacing.sm,
      ...blobRadius.card,
    },
    passo: { height: PASSO, justifyContent: 'center' },
    no: {
      position: 'absolute',
      width: NO,
      height: NO,
      marginLeft: -NO / 2,
      borderRadius: NO / 2,
      borderWidth: 2,
      alignItems: 'center',
      justifyContent: 'center',
      // O nó tapa o traço que passa por baixo dele; a cor de fundo da tela é o
      // que faz o corte ficar limpo em vez de virar um risco atravessando o
      // círculo.
      shadowColor: colors.text,
    },
    noEsquerda: { left: `${ESQUERDA * 100}%` },
    noDireita: { left: `${DIREITA * 100}%` },
    /*
      A folga do nó é em pixels, e não em porcentagem.

      Na primeira versão era `left: '28%'` contra um nó centrado em 20%: num
      aparelho de 390px isso dava 3px de folga do lado do círculo, e o texto
      passava por baixo dele. Porcentagem não sabe o raio do nó; a conta certa
      é meio nó mais um respiro, que é a mesma em qualquer largura.
    */
    texto: { position: 'absolute', gap: spacing.xxs, maxWidth: '50%' },
    textoDireita: { left: `${ESQUERDA * 100}%`, marginLeft: NO / 2 + spacing.base },
    textoEsquerda: {
      right: `${(1 - DIREITA) * 100}%`,
      marginRight: NO / 2 + spacing.base,
      alignItems: 'flex-end',
    },
    fimDaLinha: { textAlign: 'right' },
    premios: { gap: spacing.xxs, marginTop: spacing.xxs },
    premiosDireita: { alignItems: 'flex-end' },
    premio: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  });
