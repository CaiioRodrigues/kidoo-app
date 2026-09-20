import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar, Divider, Text } from '@/components/ui';
import { formatAge } from '@/lib/format';
import { minTouchTarget, radius, spacing, useStyles, useTheme, type ThemeColors } from '@/theme';
import type { Child } from '@/types/domain';

/**
 * Trocar de criança.
 *
 * A família assina uma vez e cadastra quantos filhos tiver, e TUDO que o app
 * mostra é de uma criança só: as recomendações da Home, a Jornada, o XP, as
 * conquistas, a trilha. Até aqui a escolhida era a última cadastrada na
 * sessão, e quem abrisse o app de novo caía na primeira da lista — sem nada na
 * tela para mudar isso. O chip da Home tinha a setinha para baixo desde o
 * primeiro dia e nunca abriu nada.
 *
 * Gaveta e não tela: a troca acontece no meio de outra coisa — olhando a
 * vitrine, lendo a Jornada — e empilhar uma tela por cima faria a família
 * perder o lugar onde estava.
 */
export function SeletorDeCrianca({
  visivel,
  criancas,
  ativaId,
  aoEscolher,
  aoFechar,
  aoAdicionar,
}: {
  visivel: boolean;
  criancas: Child[];
  ativaId: string | null;
  aoEscolher: (id: string) => void;
  aoFechar: () => void;
  aoAdicionar: () => void;
}) {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  // Modal não herda área segura: sem isto a última linha da lista fica por
  // baixo dos botões do sistema no Android, e ela é uma linha tocável.
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visivel} transparent animationType="slide" onRequestClose={aoFechar}>
      {/* O fundo fecha a gaveta. É o gesto que todo mundo tenta primeiro, e
          sem ele a única saída seria o botão do aparelho — que no iOS não
          existe. */}
      <Pressable
        style={styles.backdrop}
        accessibilityRole="button"
        accessibilityLabel="Fechar"
        onPress={aoFechar}
      />

      <View style={[styles.gaveta, { paddingBottom: insets.bottom + spacing.lg }]}>
        <View style={styles.puxador} />

        <Text variant="subheading" style={styles.titulo}>
          Quem vai se movimentar?
        </Text>

        {/* Rola quando a lista não cabe: uma família grande não pode perder a
            última criança atrás da borda da tela. `bounces` desligado porque,
            numa lista de duas, o repique parece defeito. */}
        <ScrollView style={styles.lista} bounces={false}>
          {criancas.map((crianca, i) => {
            const ativa = crianca.id === ativaId;
            return (
              <View key={crianca.id}>
                {i > 0 ? <Divider /> : null}
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: ativa }}
                  accessibilityLabel={`${crianca.name}${ativa ? ', em foco agora' : ''}`}
                  onPress={() => aoEscolher(crianca.id)}
                  style={({ pressed }) => [styles.linha, pressed && styles.pressionada]}
                >
                  <Avatar name={crianca.name} uri={crianca.photoUri} size={44} ring={ativa} />
                  <View style={styles.dados}>
                    <Text variant="bodyStrong" numberOfLines={1}>
                      {crianca.name}
                    </Text>
                    <Text variant="caption" color={colors.textMuted} numberOfLines={1}>
                      {formatAge(crianca.birthDate)} • nível {crianca.level}
                    </Text>
                  </View>
                  {/* O visto entra no lugar de um rádio: a escolha já está
                      feita, e um círculo vazio ao lado de cada uma pediria
                      para ser preenchido antes de valer. */}
                  {ativa ? (
                    <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
                  ) : null}
                </Pressable>
              </View>
            );
          })}
        </ScrollView>

        <Divider />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Adicionar outra criança"
          onPress={aoAdicionar}
          style={({ pressed }) => [styles.linha, pressed && styles.pressionada]}
        >
          <View style={styles.maisRedondo}>
            <Ionicons name="add" size={22} color={colors.primary} />
          </View>
          <Text variant="bodyStrong" color={colors.primary}>
            Adicionar outra criança
          </Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: 'rgba(20, 12, 40, 0.5)' },
    gaveta: {
      backgroundColor: colors.background,
      borderTopLeftRadius: radius.xxl,
      borderTopRightRadius: radius.xxl,
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.md,
    },
    puxador: {
      alignSelf: 'center',
      width: 40,
      height: 4,
      borderRadius: radius.pill,
      backgroundColor: colors.border,
      marginBottom: spacing.base,
    },
    titulo: { marginBottom: spacing.sm },
    // Teto, não altura: com duas crianças a gaveta é baixa, e com seis ela
    // para antes de virar tela cheia.
    lista: { maxHeight: 320 },
    linha: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.base,
      minHeight: minTouchTarget + spacing.base,
      paddingVertical: spacing.md,
    },
    pressionada: { opacity: 0.6 },
    dados: { flex: 1, gap: spacing.xxs },
    maisRedondo: {
      width: 44,
      height: 44,
      borderRadius: radius.pill,
      borderWidth: 1.5,
      borderStyle: 'dashed',
      borderColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
