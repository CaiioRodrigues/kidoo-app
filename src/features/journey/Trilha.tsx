import { useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { AchievementIcon } from './AchievementIcon';
import { CategoryIcon } from '@/components/CategoryIcon';
import { Text } from '@/components/ui';
import { formatPastDate } from '@/lib/format';
import type { PassoDaTrilha } from '@/lib/trilha';
import {
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

export function Trilha({
  passos,
  anteriores = 0,
}: {
  passos: PassoDaTrilha[];
  /** Quantas aulas ficaram antes do trecho mostrado. Zero esconde o aviso. */
  anteriores?: number;
}) {
  const { colors, isDark } = useTheme();
  const styles = useStyles(makeStyles);
  const [largura, setLargura] = useState(0);

  const medir = (e: LayoutChangeEvent) => setLargura(e.nativeEvent.layout.width);

  if (passos.length === 0) return null;

  const xDoPasso = (i: number) => (i % 2 === 0 ? ESQUERDA : DIREITA) * largura;
  const yDoPasso = (i: number) => i * PASSO + PASSO / 2;

  // Cúbica entre cada par de nós: os pontos de controle ficam na vertical de
  // cada ponta, o que dá a curva em S e nunca um bico.
  let caminho = '';
  if (largura > 0) {
    caminho = `M ${xDoPasso(0)} ${yDoPasso(0)}`;
    for (let i = 1; i < passos.length; i += 1) {
      const x0 = xDoPasso(i - 1);
      const y0 = yDoPasso(i - 1);
      const x1 = xDoPasso(i);
      const y1 = yDoPasso(i);
      caminho += ` C ${x0} ${y0 + PASSO / 2}, ${x1} ${y1 - PASSO / 2}, ${x1} ${y1}`;
    }
  }

  return (
    <View>
      {anteriores > 0 ? (
        <Text variant="caption" color={colors.textMuted} style={styles.anteriores}>
          {anteriores === 1
            ? '1 aula antes desta parte da trilha'
            : `${anteriores} aulas antes desta parte da trilha`}
        </Text>
      ) : null}

      <View onLayout={medir} style={{ height: passos.length * PASSO }}>
        {largura > 0 ? (
          <Svg
            style={StyleSheet.absoluteFill}
            width={largura}
            height={passos.length * PASSO}
            pointerEvents="none"
          >
            <Path
              d={caminho}
              stroke={colors.border}
              strokeWidth={4}
              strokeLinecap="round"
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
