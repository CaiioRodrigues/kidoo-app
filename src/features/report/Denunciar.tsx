import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Divider, Input, Text } from '@/components/ui';
import { api, toUserMessage } from '@/services';
import { useAuthStore } from '@/stores/auth-store';
import { minTouchTarget, radius, spacing, useStyles, useTheme, type ThemeColors } from '@/theme';
import type { ReportReason } from '@/types/domain';

/**
 * Denunciar uma atividade.
 *
 * A capa passou a ter fila de análise, mas a fila não cobre tudo: a capa que
 * já estava publicada antes dela existir, e o julgamento que erra — quem
 * analisa é gente, e vê uma imagem por segundo.
 *
 * Quem fecha esse buraco é quem está olhando o cartão.
 */
const MOTIVOS: { id: ReportReason; rotulo: string; explica: string }[] = [
  {
    id: 'imagem',
    rotulo: 'A imagem é imprópria',
    // A única que tem efeito imediato, e a tela diz isso antes do envio: uma
    // ação que derruba conteúdo alheio não pode acontecer sem quem a fez
    // saber o que fez.
    explica: 'Ela sai do ar na hora, até alguém do Kidoo revisar.',
  },
  { id: 'descricao', rotulo: 'A descrição não confere', explica: 'Alguém do Kidoo vai conferir.' },
  {
    id: 'seguranca',
    rotulo: 'Algo aqui me preocupa',
    explica: 'Conte o que aconteceu — isso vai direto para quem cuida do Kidoo.',
  },
  { id: 'outro', rotulo: 'Outro motivo', explica: '' },
];

export function Denunciar({ activityId, titulo }: { activityId: string; titulo: string }) {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const autenticado = useAuthStore((state) => state.status === 'authenticated');

  const [aberto, setAberto] = useState(false);
  const [motivo, setMotivo] = useState<ReportReason | null>(null);
  const [detalhe, setDetalhe] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pronto, setPronto] = useState(false);

  /*
    Só para quem entrou.

    Denúncia derruba conteúdo de outra pessoa, então precisa de alguém por
    trás — é o que permite limitar a uma por família e olhar para quem abusa.
    Visitante navegando o catálogo não vê o botão: oferecê-lo e recusar no
    envio seria pior que não oferecer.
  */
  if (!autenticado) return null;

  const fechar = () => {
    setAberto(false);
    setMotivo(null);
    setDetalhe('');
    setErro(null);
    setPronto(false);
  };

  const enviar = async () => {
    if (!motivo) return;
    setEnviando(true);
    setErro(null);
    try {
      await api.catalog.report({ activityId, reason: motivo, detail: detalhe.trim() || undefined });
      setPronto(true);
    } catch (e) {
      setErro(toUserMessage(e));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Denunciar ${titulo}`}
        onPress={() => setAberto(true)}
        style={styles.gatilho}
      >
        <Ionicons name="flag-outline" size={14} color={colors.textFaint} />
        <Text variant="caption" color={colors.textFaint}>
          Denunciar
        </Text>
      </Pressable>

      <Modal visible={aberto} transparent animationType="slide" onRequestClose={fechar}>
        <Pressable
          style={styles.backdrop}
          accessibilityRole="button"
          accessibilityLabel="Fechar"
          onPress={fechar}
        />
        <View style={[styles.gaveta, { paddingBottom: insets.bottom + spacing.lg }]}>
          <View style={styles.puxador} />

          {pronto ? (
            <View style={styles.fim}>
              <Ionicons name="checkmark-circle" size={44} color={colors.success} />
              <Text variant="subheading" center>
                Recebemos
              </Text>
              <Text variant="body" color={colors.textMuted} center>
                {motivo === 'imagem'
                  ? 'A imagem saiu do ar e alguém do Kidoo vai revisar.'
                  : 'Alguém do Kidoo vai olhar isso.'}
              </Text>
              <Button title="Fechar" onPress={fechar} style={styles.botao} />
            </View>
          ) : (
            <>
              <Text variant="subheading">O que está errado aqui?</Text>
              <Text variant="caption" color={colors.textMuted} style={styles.sub}>
                {titulo}
              </Text>

              {MOTIVOS.map((item, i) => (
                <View key={item.id}>
                  {i > 0 ? <Divider /> : null}
                  <Pressable
                    accessibilityRole="radio"
                    accessibilityState={{ selected: motivo === item.id }}
                    accessibilityLabel={item.rotulo}
                    onPress={() => setMotivo(item.id)}
                    style={({ pressed }) => [styles.linha, pressed && styles.pressionada]}
                  >
                    <Ionicons
                      name={motivo === item.id ? 'radio-button-on' : 'radio-button-off'}
                      size={22}
                      color={motivo === item.id ? colors.primary : colors.textFaint}
                    />
                    <View style={styles.flex}>
                      <Text variant="body">{item.rotulo}</Text>
                      {item.explica ? (
                        <Text variant="caption" color={colors.textMuted}>
                          {item.explica}
                        </Text>
                      ) : null}
                    </View>
                  </Pressable>
                </View>
              ))}

              {motivo ? (
                <Input
                  label="Quer contar mais? (opcional)"
                  placeholder="O que você viu"
                  value={detalhe}
                  onChangeText={setDetalhe}
                  maxLength={300}
                  multiline
                  containerStyle={styles.campo}
                />
              ) : null}

              {erro ? (
                <Text variant="caption" color={colors.danger}>
                  {erro}
                </Text>
              ) : null}

              <Button
                title="Enviar denúncia"
                onPress={() => void enviar()}
                disabled={!motivo}
                loading={enviando}
                style={styles.botao}
              />
            </>
          )}
        </View>
      </Modal>
    </>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    gatilho: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      alignSelf: 'center',
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.base,
      minHeight: minTouchTarget,
    },
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
    sub: { marginBottom: spacing.sm },
    linha: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.md,
      minHeight: minTouchTarget,
    },
    pressionada: { opacity: 0.6 },
    flex: { flex: 1, gap: spacing.xxs },
    campo: { marginTop: spacing.md },
    botao: { marginTop: spacing.lg },
    fim: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.lg },
  });
