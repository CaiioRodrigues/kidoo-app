import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { Badge, CoinBadge, Text } from '@/components/ui';
import { formatSessionTime } from '@/lib/format';
import { slotsAvailable, type ClassSession, type Uuid } from '@/types/domain';
import { blobRadius, spacing, useStyles, useTheme, type ThemeColors } from '@/theme';

/**
 * Escolha da turma.
 *
 * A reserva deixou de ser "quero esta atividade" e passou a ser "quero este
 * horário": quem tem lugar é a turma. E o preço vem dela, não da atividade —
 * a turma com vaga sobrando custa menos coins, que é o empurrão para a família
 * escolher justamente o horário que o parceiro consegue vender barato.
 */
export function SessionPicker({
  sessions,
  reserved,
  onSelect,
}: {
  sessions: ClassSession[];
  /**
   * Turmas em que a criança ativa já tem lugar. Vêm de fora porque quem sabe
   * de qual criança estamos falando é a tela, não a lista.
   */
  reserved: Set<Uuid>;
  onSelect: (session: ClassSession) => void;
}) {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);

  if (sessions.length === 0) {
    return (
      <Text variant="caption" color={colors.textMuted}>
        Nenhuma turma com vaga aberta no momento. O parceiro libera novos horários toda semana.
      </Text>
    );
  }

  return (
    <View style={styles.list}>
      {sessions.map((session) => {
        const free = slotsAvailable(session);
        // O banco recusa a segunda reserva da mesma criança na mesma turma.
        // Deixar o toque disponível seria oferecer um caminho que termina em
        // erro — e depois de o usuário atravessar a tela de confirmação.
        const jaReservada = reserved.has(session.id);
        return (
          <Pressable
            key={session.id}
            accessibilityRole="button"
            accessibilityState={{ disabled: jaReservada }}
            accessibilityLabel={
              jaReservada
                ? `${formatSessionTime(session.startsAt)}, você já reservou esta turma`
                : `${formatSessionTime(session.startsAt)}, ${free} ${
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
                {formatSessionTime(session.startsAt)}
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
                    {session.kind === 'ociosa' ? (
                      <Badge label="Turma com espaço" tone="success" />
                    ) : null}
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
    pressed: { opacity: 0.7 },
    info: { flex: 1, gap: spacing.xxs, minWidth: 0 },
    meta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  });
