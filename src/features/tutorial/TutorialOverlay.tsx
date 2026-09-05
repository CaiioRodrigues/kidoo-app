import { useCallback, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown, FadeOut } from 'react-native-reanimated';

import { Mascot } from './Mascot';
import { SpeechBubble } from './SpeechBubble';
import { Button, Text } from '@/components/ui';
import { radius, spacing, useStyles, useTheme, type ThemeColors } from '@/theme';

type Step = { title: string; text: string };

const STEPS: Step[] = [
  {
    title: 'Oi! Eu sou o Kiddo 👋',
    text: 'Aqui você encontra aulas perto de casa, na idade certa do seu pequeno, com parceiros verificados.',
  },
  {
    title: 'Kidoo Coins',
    text: 'Cada reserva usa coins da sua assinatura. Eles voltam ao cheio toda segunda-feira, então dá para manter uma rotina.',
  },
  {
    title: 'Na hora da aula',
    text: 'Faça o check-in no app e mostre o código ao parceiro. É ele que confirma que o seu pequeno chegou.',
  },
  {
    title: 'A jornada dele',
    text: 'Cada aula rende XP. Ele sobe de nível e destrava moedas bônus para usar em novas atividades.',
  },
];

/** Tutorial de boas-vindas, apresentado pelo mascote. */
export function TutorialOverlay({ visible, onFinish }: { visible: boolean; onFinish: () => void }) {
  const { colors } = useTheme();
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

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onFinish}>
      <View style={styles.backdrop}>
        <Animated.View
          entering={FadeIn.duration(260)}
          exiting={FadeOut.duration(160)}
          style={[styles.content, { paddingBottom: spacing.lg + insets.bottom }]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Pular tutorial"
            onPress={onFinish}
            style={styles.skip}
          >
            <Text variant="label" color={colors.textOnPrimary}>
              Pular
            </Text>
          </Pressable>

          <Animated.View key={index} entering={FadeInDown.duration(280)} style={styles.bubbleArea}>
            <SpeechBubble title={step.title} text={step.text} />
          </Animated.View>

          <View style={styles.mascotRow}>
            <Mascot size={104} />
          </View>

          <View style={styles.dots}>
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

const makeStyles = (colors: ThemeColors) =>
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
    // Chip com fundo próprio: texto branco solto sobre a tela clara por baixo
    // ficava ilegível.
    skip: {
      alignSelf: 'flex-end',
      paddingHorizontal: spacing.base,
      paddingVertical: spacing.sm,
      borderRadius: radius.pill,
      backgroundColor: 'rgba(255,255,255,0.18)',
    },
    bubbleArea: { alignSelf: 'stretch' },
    mascotRow: { alignItems: 'flex-start', marginTop: -spacing.sm, marginLeft: spacing.base },
    dots: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm },
    dot: { height: 6, borderRadius: radius.pill },
    dotActive: { width: 22, backgroundColor: colors.textOnPrimary },
    dotIdle: { width: 6, backgroundColor: 'rgba(255,255,255,0.45)' },
  });
