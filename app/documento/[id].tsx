import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { HeaderBar } from '@/components/navigation';
import { Screen, Text } from '@/components/ui';
import { DOCUMENTOS, type Bloco, type DocumentoId } from '@shared/documentos';
import { spacing, useStyles, useTheme, type ThemeColors } from '@/theme';

/**
 * Termos de Uso e Política de Privacidade.
 *
 * Uma tela para os dois, porque o texto vem de `shared/documentos.ts` — o
 * mesmo arquivo que o painel serve na web. A loja exige URL, a família merece
 * ler dentro do app, e as duas coisas precisam dizer exatamente a mesma frase.
 *
 * Antes daqui, o cadastro pedia para aceitar "os Termos de Uso e a Política de
 * Privacidade" em texto puro: sem link, sem tela, sem documento. A família
 * marcava que tinha lido dois papéis que não existiam.
 */
export default function DocumentoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);

  const documento = DOCUMENTOS[id as DocumentoId];

  if (!documento) {
    return (
      <Screen edges={['top']}>
        <HeaderBar title="Documento" />
        <Text variant="body" color={colors.textFaint}>
          Não encontramos este documento.
        </Text>
      </Screen>
    );
  }

  return (
    <Screen scroll edges={['top']} contentContainerStyle={styles.scroll}>
      <HeaderBar title={documento.titulo} />

      <Text variant="body" color={colors.textMuted} style={styles.resumo}>
        {documento.resumo}
      </Text>
      <Text variant="caption" color={colors.textFaint}>
        Atualizado em {documento.atualizadoEm}
      </Text>

      {documento.secoes.map((secao) => (
        <View key={secao.titulo} style={styles.secao}>
          <Text variant="subheading" style={styles.titulo}>
            {secao.titulo}
          </Text>
          {secao.blocos.map((bloco, i) => (
            <BlocoDoTexto key={i} bloco={bloco} />
          ))}
        </View>
      ))}
    </Screen>
  );
}

function BlocoDoTexto({ bloco }: { bloco: Bloco }) {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);

  if (bloco.tipo === 'p') {
    return (
      <Text variant="body" color={colors.textMuted} style={styles.paragrafo}>
        {bloco.texto}
      </Text>
    );
  }

  return (
    <View style={styles.lista}>
      {bloco.itens.map((item) => (
        // O marcador é um View, e não um "•" no texto: bullet dentro da string
        // quebra o alinhamento quando o item passa de uma linha — a segunda
        // linha volta para debaixo do ponto em vez de alinhar com a primeira.
        <View key={item} style={styles.item}>
          <View style={styles.marcador} />
          <Text variant="body" color={colors.textMuted} style={styles.itemTexto}>
            {item}
          </Text>
        </View>
      ))}
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    scroll: { paddingBottom: spacing.xxl },
    resumo: { marginTop: spacing.sm, marginBottom: spacing.xs },
    secao: { marginTop: spacing.xl, gap: spacing.sm },
    titulo: { marginBottom: spacing.xxs },
    paragrafo: { lineHeight: 22 },
    lista: { gap: spacing.sm },
    item: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
    marcador: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.primary,
      // Alinha o ponto com a primeira linha do texto, não com o topo da caixa.
      marginTop: 8,
    },
    itemTexto: { flex: 1, lineHeight: 22 },
  });
