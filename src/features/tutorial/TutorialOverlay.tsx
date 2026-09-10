import { Ionicons } from '@expo/vector-icons';
import { useCallback, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown, FadeOut } from 'react-native-reanimated';

import { Guara } from '@/components/brand';
import { SpeechBubble } from './SpeechBubble';
import { Button, Text } from '@/components/ui';
import { hitSlop, radius, spacing, useStyles } from '@/theme';

/**
 * Branco literal, e não uma cor do tema.
 *
 * O fundo do tutorial é escuro nos dois temas — é ele que tira o foco da tela
 * de trás. `textOnPrimary` seguia o tema e, no escuro, virava quase preto: o
 * pontinho do passo atual sumia e "Pular" ficava ilegível, justamente sobre o
 * fundo que nunca muda.
 */
const SOBRE_O_ESCURO = '#FFFFFF';

type Step = { title: string; text: string; icon: keyof typeof Ionicons.glyphMap };

/**
 * Quatro passos, um por pergunta que alguém faz no primeiro dia.
 *
 * A tentação aqui é explicar o aplicativo inteiro. Não funciona: ninguém
 * lembra do passo 3 de um carrossel quando chega na porta da aula três dias
 * depois. Por isso o que é instrução de momento ("mostre este código") vive
 * como dica na própria tela, e aqui fica só o mapa: o que o app faz, o que
 * gasta, como entra na aula e o que a criança ganha.
 */
const STEPS: Step[] = [
  {
    icon: 'sparkles-outline',
    title: 'Oi! Eu sou o Kiddo 👋',
    text: 'Aqui você acha aulas perto de casa, na idade certa do seu pequeno. Você escolhe o dia e vê as turmas daquele dia.',
  },
  {
    icon: 'wallet-outline',
    title: 'Kidoo Coins',
    text: 'Cada reserva usa coins da sua assinatura. Eles voltam ao cheio toda segunda-feira — dá para manter uma rotina sem pagar aula avulsa.',
  },
  {
    icon: 'qr-code-outline',
    title: 'Na hora da aula',
    text: 'Chegando lá, faça o check-in no app e mostre o código ao parceiro. É ele quem confirma que o seu pequeno chegou.',
  },
  {
    icon: 'trophy-outline',
    title: 'A jornada dele',
    text: 'Cada aula rende XP. Ele sobe de nível e destrava moedas bônus, que valem aulas fora da cota da semana.',
  },
];

/** Tutorial de boas-vindas, apresentado pelo mascote. */
export function TutorialOverlay({ visible, onFinish }: { visible: boolean; onFinish: () => void }) {
  const styles = useStyles(makeStyles);
  // Modal não recebe área segura automaticamente: sem isto, o botão final fica
  // por baixo dos botões do sistema no Android.
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(0);

  const step = STEPS[index] ?? STEPS[0]!;
  const isLast = index === STEPS.length - 1;

  const next = useCallback(() => {
    if (isLast) {
      onFinish();
      return;
    }
    setIndex((current) => current + 1);
  }, [isLast, onFinish]);

  const back = useCallback(() => setIndex((current) => Math.max(0, current - 1)), []);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onFinish}>
      <View style={styles.backdrop}>
        {/*
          Tocar fora fecha. Vem antes do conteúdo, então fica por baixo dele: o
          toque no cartão continua sendo do cartão, e só o escuro em volta
          dispensa o tutorial. Era a primeira coisa que alguém tentava — e o
          tutorial engolia o toque sem fazer nada.
        */}
        <Pressable
          style={StyleSheet.absoluteFill}
          accessibilityRole="button"
          accessibilityLabel="Fechar tutorial"
          onPress={onFinish}
        />

        <Animated.View
          entering={FadeIn.duration(260)}
          exiting={FadeOut.duration(160)}
          style={[styles.content, { paddingBottom: spacing.lg + insets.bottom }]}
        >
          <View style={styles.topRow}>
            {/* Voltar só existe quando há para onde voltar; o espaço fica
                reservado de qualquer jeito para o "Pular" não dançar na tela. */}
            {index > 0 ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Passo anterior"
                hitSlop={hitSlop}
                onPress={back}
                style={styles.chip}
              >
                <Ionicons name="chevron-back" size={15} color={SOBRE_O_ESCURO} />
                <Text variant="label" color={SOBRE_O_ESCURO}>
                  Voltar
                </Text>
              </Pressable>
            ) : (
              <View />
            )}

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Pular tutorial"
              hitSlop={hitSlop}
              onPress={onFinish}
              style={styles.chip}
            >
              <Text variant="label" color={SOBRE_O_ESCURO}>
                Pular
              </Text>
            </Pressable>
          </View>

          <Animated.View key={index} entering={FadeInDown.duration(280)} style={styles.bubbleArea}>
            <SpeechBubble title={step.title} text={step.text} icon={step.icon} />
          </Animated.View>

          <View style={styles.mascotRow}>
            <Guara size={104} />
          </View>

          {/* Os pontinhos dizem "faltam dois" para quem enxerga; o rótulo diz o
              mesmo para quem ouve a tela. */}
          <View
            style={styles.dots}
            accessible
            accessibilityLabel={`Passo ${index + 1} de ${STEPS.length}`}
          >
            {STEPS.map((item, position) => (
              <View
                key={item.title}
                style={[styles.dot, position === index ? styles.dotActive : styles.dotIdle]}
              />
            ))}
          </View>

          <Button title={isLast ? 'Bora começar!' : 'Continuar'} onPress={next} />
        </Animated.View>
      </View>
    </Modal>
  );
}

const makeStyles = () =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      // Mais escuro que o overlay padrão: o tutorial precisa tirar o foco da
      // tela de trás, e no tema claro o overlay padrão quase não escurece.
      backgroundColor: 'rgba(20, 18, 32, 0.72)',
      justifyContent: 'flex-end',
      padding: spacing.xl,
    },
    content: { gap: spacing.base },
    topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    // Chip com fundo próprio: texto branco solto sobre a tela clara por baixo
    // ficava ilegível.
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingHorizontal: spacing.base,
      paddingVertical: spacing.sm,
      borderRadius: radius.pill,
      backgroundColor: 'rgba(255,255,255,0.18)',
    },
    bubbleArea: { alignSelf: 'stretch' },
    mascotRow: { alignItems: 'flex-start', marginTop: -spacing.sm, marginLeft: spacing.base },
    dots: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm },
    dot: { height: 6, borderRadius: radius.pill },
    dotActive: { width: 22, backgroundColor: SOBRE_O_ESCURO },
    dotIdle: { width: 6, backgroundColor: 'rgba(255,255,255,0.45)' },
  });
