import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { Badge, Button, CoinBadge, Text } from '@/components/ui';
import { timeOnly } from '@/lib/schedule';
import { slotsAvailable, type ClassSession, type SlotKind, type Uuid } from '@/types/domain';
import { blobRadius, spacing, useStyles, useTheme, type ThemeColors } from '@/theme';

/**
 * As turmas de UM dia.
 *
 * A reserva deixou de ser "quero esta atividade" e passou a ser "quero este
 * horário": quem tem lugar é a turma. E o preço vem dela, não da atividade —
 * a turma que já acontece de qualquer jeito custa menos coins, porque a criança
 * a mais não custa nada ao parceiro. É o único desconto que existe aqui sem
 * alguém pagar por ele.
 *
 * A lista mostra só a hora porque o dia já está no cabeçalho acima dela.
 * Repetir "qui., 10/09" em cada linha de um dia só é ruído.
 */
/**
 * O que o tipo da turma significa para quem vai reservar.
 *
 * `kind` nasceu para calcular repasse e preço, e chegava à família como um selo
 * "Turma com espaço" que aparecia só às vezes — repetindo o "3 vagas" ao lado e
 * sem explicar nada. Mas a classificação carrega um fato que muda a tarde da
 * criança: turma com matriculados fixos é grupo que já se conhece e tem rotina;
 * turma sem eles é aula montada com quem aparecer.
 *
 * Sempre sai um dos dois, nunca nenhum. Selo intermitente deixa a ausência
 * ambígua: a família não sabe se é o outro caso ou se faltou o dado.
 */
function tipoDaTurma(kind: SlotKind): string {
  return kind === 'ociosa' ? 'Turma em andamento' : 'Aula aberta';
}

export function SessionPicker({
  sessions,
  reserved,
  waiting,
  onToggleWaitlist,
  waitlistPending,
  onSelect,
}: {
  sessions: ClassSession[];
  /**
   * Turmas em que a criança ativa já tem lugar. Vêm de fora porque quem sabe
   * de qual criança estamos falando é a tela, não a lista.
   */
  reserved: Set<Uuid>;
  /** Turmas cheias em que esta criança já pediu aviso. */
  waiting: Set<Uuid>;
  /** Entra ou sai da fila da turma cheia. */
  onToggleWaitlist: (session: ClassSession, esperando: boolean) => void;
  /** Verdadeiro enquanto a chamada de entrar/sair da fila está no ar. */
  waitlistPending?: boolean;
  onSelect: (session: ClassSession) => void;
}) {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);

  return (
    <View style={styles.list}>
      {sessions.map((session) => {
        const free = slotsAvailable(session);
        // O banco recusa a segunda reserva da mesma criança na mesma turma.
        // Deixar o toque disponível seria oferecer um caminho que termina em
        // erro — e depois de o usuário atravessar a tela de confirmação.
        const jaReservada = reserved.has(session.id);
        const cheia = free <= 0 && !jaReservada;
        const esperando = waiting.has(session.id);

        // A turma cheia não é um destino: ela vira um cartão com um pedido de
        // aviso. Sem isso, a única saída era a família voltar ao app de tempos
        // em tempos torcendo para dar sorte — e a demanda pelo horário mais
        // disputado não deixava rastro nenhum para mostrar ao parceiro.
        if (cheia) {
          return (
            // Empilhado, e não lado a lado como as demais: com o botão à
            // direita o horário não cabia e virava "sáb., 12/09 às 15…" —
            // truncar justamente o dado que a família usa para decidir.
            <View key={session.id} style={[styles.row, styles.full]}>
              <View style={styles.fullHeader}>
                <Text variant="bodyStrong" color={colors.textMuted} style={styles.flex}>
                  {timeOnly(session.startsAt)}
                </Text>
                <Text variant="caption" color={esperando ? colors.primary : colors.textFaint}>
                  {esperando ? 'Avisamos quando vagar' : 'Turma lotada'}
                </Text>
              </View>
              <Button
                title={esperando ? 'Esperando aviso' : 'Avise-me quando vagar'}
                variant="secondary"
                size="sm"
                loading={waitlistPending}
                left={
                  <Ionicons
                    name={esperando ? 'notifications' : 'notifications-outline'}
                    size={15}
                    color={colors.primary}
                  />
                }
                onPress={() => onToggleWaitlist(session, esperando)}
              />
            </View>
          );
        }

        return (
          <Pressable
            key={session.id}
            accessibilityRole="button"
            accessibilityState={{ disabled: jaReservada }}
            accessibilityLabel={
              jaReservada
                ? `${timeOnly(session.startsAt)}, você já reservou esta turma`
                : `${timeOnly(session.startsAt)}, ${tipoDaTurma(session.kind)}, ${free} ${
                    free === 1 ? 'vaga' : 'vagas'
                  }, ${session.coinCost} coins`
            }
            disabled={jaReservada}
            onPress={() => onSelect(session)}
            style={({ pressed }) => [
              styles.row,
              jaReservada && styles.reserved,
              pressed && !jaReservada && styles.pressed,
            ]}
          >
            <View style={styles.info}>
              <Text
                variant="bodyStrong"
                color={jaReservada ? colors.textMuted : colors.text}
                numberOfLines={1}
              >
                {timeOnly(session.startsAt)}
              </Text>
              <View style={styles.meta}>
                {jaReservada ? (
                  <Badge
                    label="Você já reservou"
                    tone="brand"
                    left={<Ionicons name="checkmark-circle" size={13} color={colors.primary} />}
                  />
                ) : (
                  <>
                    <Text variant="caption" color={free <= 2 ? colors.warning : colors.textMuted}>
                      {free === 1 ? 'última vaga' : `${free} vagas`}
                    </Text>
                    <Badge label={tipoDaTurma(session.kind)} tone="neutral" />
                  </>
                )}
              </View>
            </View>

            {jaReservada ? null : (
              <>
                <CoinBadge amount={session.coinCost} size="sm" />
                <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
              </>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    list: { gap: spacing.sm },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      padding: spacing.base,
      borderWidth: 1,
      borderColor: colors.border,
      ...blobRadius.tile,
    },
    // Sem seta e sem preço, sobre o fundo abafado: a linha continua legível
    // como informação ("esta é a sua aula de quinta") mas parou de parecer um
    // destino. Opacidade sozinha faria o texto sumir junto.
    reserved: { backgroundColor: colors.backgroundMuted, borderColor: 'transparent' },
    // Tracejado: diz "existe, mas não está disponível" sem precisar de texto.
    full: {
      borderStyle: 'dashed',
      borderColor: colors.border,
      flexDirection: 'column',
      alignItems: 'stretch',
      gap: spacing.md,
    },
    fullHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    flex: { flex: 1 },
    pressed: { opacity: 0.7 },
    info: { flex: 1, gap: spacing.xxs, minWidth: 0 },
    meta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  });
