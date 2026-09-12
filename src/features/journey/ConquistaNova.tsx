import { Modal, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown, ZoomIn } from 'react-native-reanimated';

import { AchievementIcon } from './AchievementIcon';
import { Guara } from '@/components/brand';
import { Button, Text } from '@/components/ui';
import { spacing, useStyles } from '@/theme';
import type { Achievement } from '@/types/domain';

/**
 * Branco literal, e não `textOnPrimary`.
 *
 * O fundo desta tela é escuro nos dois temas — é ele que tira o foco do app de
 * trás e faz a medalha brilhar. `textOnPrimary` segue o tema e, no escuro,
 * viraria quase preto sobre um fundo que nunca muda. Mesmo motivo do tutorial.
 */
const SOBRE_O_ESCURO = '#FFFFFF';
/** O mesmo branco recuado, para a linha de apoio não competir com o título. */
const APOIO_SOBRE_O_ESCURO = 'rgba(255, 255, 255, 0.72)';

/** Confete desenhado. Emoji aqui repetiria o problema que a medalha resolveu. */
const CONFETES = [
  { left: '8%', top: 6, cor: '#FFC839', giro: '18deg' },
  { left: '22%', top: 34, cor: '#3FD8DA', giro: '-24deg' },
  { left: '38%', top: 2, cor: '#FF8AB8', giro: '42deg' },
  { left: '56%', top: 26, cor: '#A382F0', giro: '-12deg' },
  { left: '72%', top: 8, cor: '#7FD463', giro: '30deg' },
  { left: '86%', top: 38, cor: '#FFC839', giro: '-38deg' },
] as const;

/**
 * A comemoração de uma conquista nova.
 *
 * Aparece por cima de onde a família estiver, porque o momento não é escolhido
 * por ela: quem confirma a aula é o parceiro, do outro lado do balcão, e o app
 * só descobre na próxima vez que abrir. Esperar a pessoa visitar a aba Jornada
 * faria a conquista chegar dias depois — ou nunca.
 */
export function ConquistaNova({
  conquista,
  nomeDaCrianca,
  desbloqueadas,
  total,
  onClose,
}: {
  conquista: Achievement;
  nomeDaCrianca: string;
  /** Quantas a criança já tem, contando esta. */
  desbloqueadas: number;
  total: number;
  onClose: () => void;
}) {
  const styles = useStyles(makeStyles);
  // Modal não recebe área segura automaticamente: sem isto o botão fica por
  // baixo dos botões do sistema no Android.
  const insets = useSafeAreaInsets();

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Animated.View
          entering={FadeInDown.duration(360)}
          style={[styles.card, { marginBottom: insets.bottom }]}
        >
          <View style={styles.confetes} pointerEvents="none">
            {CONFETES.map((confete, i) => (
              <Animated.View
                key={confete.left}
                entering={FadeInDown.delay(120 + i * 60).duration(420)}
                style={[
                  styles.confete,
                  {
                    left: confete.left,
                    top: confete.top,
                    backgroundColor: confete.cor,
                    transform: [{ rotate: confete.giro }],
                  },
                ]}
              />
            ))}
          </View>

          <Animated.View entering={FadeIn.delay(80).duration(400)}>
            <Guara size={132} pose="comemora" />
          </Animated.View>

          {/* A medalha entra depois do mascote, e crescendo: é ela o assunto. */}
          <Animated.View entering={ZoomIn.delay(260).duration(420)} style={styles.medalha}>
            <AchievementIcon icon={conquista.icon} tone={conquista.tone} size={84} />
          </Animated.View>

          <Text variant="display" color={SOBRE_O_ESCURO} center>
            Parabéns, {nomeDaCrianca}!
          </Text>
          <Text variant="subheading" color={SOBRE_O_ESCURO} center style={styles.nome}>
            {conquista.label}
          </Text>
          <Text variant="caption" color={APOIO_SOBRE_O_ESCURO} center>
            {desbloqueadas === total
              ? 'Você destravou todas as conquistas do Kidoo!'
              : `${desbloqueadas} de ${total} conquistas destravadas.`}
          </Text>

          <Button title="Vamos lá!" onPress={onClose} style={styles.botao} />
        </Animated.View>
      </View>
    </Modal>
  );
}

const makeStyles = () =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      // Centrado, e não encostado embaixo: colado no rodapé a composição
      // deixava metade da tela de escuro vazio acima do mascote, e o conjunto
      // lia como uma gaveta, não como uma comemoração.
      justifyContent: 'center',
      backgroundColor: 'rgba(20, 12, 40, 0.86)',
    },
    card: {
      alignItems: 'center',
      gap: spacing.sm,
      paddingTop: spacing.xxl,
      paddingHorizontal: spacing.xl,
      paddingBottom: spacing.xl,
    },
    confetes: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
    confete: { position: 'absolute', width: 10, height: 16, borderRadius: 3 },
    medalha: { marginTop: -spacing.sm, marginBottom: spacing.sm },
    nome: { marginTop: -spacing.xxs },
    botao: { alignSelf: 'stretch', marginTop: spacing.lg },
  });
