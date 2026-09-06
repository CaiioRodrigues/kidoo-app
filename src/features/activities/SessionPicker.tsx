import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { Badge, CoinBadge, Text } from '@/components/ui';
import { formatSessionTime } from '@/lib/format';
import { slotsAvailable, type ClassSession } from '@/types/domain';
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
  onSelect,
}: {
  sessions: ClassSession[];
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
        return (
          <Pressable
            key={session.id}
            accessibilityRole="button"
            accessibilityLabel={`${formatSessionTime(session.startsAt)}, ${free} ${
              free === 1 ? 'vaga' : 'vagas'
            }, ${session.coinCost} coins`}
            onPress={() => onSelect(session)}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          >
            <View style={styles.info}>
              <Text variant="bodyStrong" numberOfLines={1}>
                {formatSessionTime(session.startsAt)}
              </Text>
              <View style={styles.meta}>
                <Text variant="caption" color={free <= 2 ? colors.warning : colors.textMuted}>
                  {free === 1 ? 'última vaga' : `${free} vagas`}
                </Text>
                {session.kind === 'ociosa' ? <Badge label="Turma com espaço" tone="success" /> : null}
              </View>
            </View>

            <CoinBadge amount={session.coinCost} size="sm" />
            <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
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
    pressed: { opacity: 0.7 },
    info: { flex: 1, gap: spacing.xxs, minWidth: 0 },
    meta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  });
