import { StyleSheet } from 'react-native';

import { Guara } from '@/components/brand';
import { Button, Card, Text } from '@/components/ui';
import { possessivo } from '@/lib/genero';
import { spacing, useStyles, useTheme, type ThemeColors, type ThemePalette } from '@/theme';
import type { Gender } from '@/types/domain';

/**
 * A Jornada de quem ainda não teve aula nenhuma.
 *
 * Antes daqui a tela respondia com três "ainda não" seguidos — carteira de
 * bônus zerada, nenhuma aula registrada, nenhuma evolução —, cada um num
 * bloco com seu próprio título. Três ausências enfileiradas não informam três
 * vezes: informam uma vez e desanimam duas, porque a tela inteira vira uma
 * lista do que a família não tem.
 *
 * Este cartão diz a mesma coisa uma vez só, e diz para onde ir. O que ele
 * substitui não é informação que se perde: saldo zero de bônus e zero aulas
 * são exatamente o que "a primeira aula ainda não aconteceu" já significa.
 *
 * As medalhas trancadas continuam logo abaixo, e são de propósito: elas são a
 * única parte da tela vazia que promete alguma coisa em vez de constatar
 * falta.
 */
export function PrimeiraJornada({
  nome,
  genero,
  aoExplorar,
}: {
  nome: string;
  genero: Gender;
  aoExplorar: () => void;
}) {
  const { colors, palette } = useTheme();
  const styles = useStyles(makeStyles);

  return (
    <Card background={palette.yellowSoft} elevation="none" style={styles.cartao}>
      <Guara size={96} pose="aponta" />
      <Text variant="subheading" style={styles.centro}>
        A jornada {possessivo(nome, genero)} começa na primeira aula
      </Text>
      <Text variant="body" color={colors.textMuted} style={styles.centro}>
        Quando o professor confirmar a presença, o XP entra, o nível sobe e as medalhas aqui de
        baixo começam a abrir.
      </Text>
      <Button title="Explorar atividades" onPress={aoExplorar} />
    </Card>
  );
}

const makeStyles = (_colors: ThemeColors, _palette: ThemePalette) =>
  StyleSheet.create({
    cartao: { alignItems: 'center', gap: spacing.md, marginTop: spacing.md },
    centro: { textAlign: 'center' },
  });
