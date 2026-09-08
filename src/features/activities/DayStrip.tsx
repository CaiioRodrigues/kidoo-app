import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { shortDayLabel, type ScheduleDay } from '@/lib/schedule';
import { spacing, useStyles, useTheme, type ThemeColors } from '@/theme';

/**
 * A semana da atividade, em chips.
 *
 * Todos os dias aparecem, inclusive os sem aula. É o buraco que ensina o ritmo
 * da turma — "essa é quinta e domingo" — e esse é o dado que a família usa para
 * encaixar na rotina. Uma tira só com os dias que têm aula viraria uma lista de
 * datas soltas, mais curta e menos informativa.
 *
 * O dia vazio continua tocável de propósito: em vez de um beco sem saída, a
 * tela responde qual é a próxima aula e leva até ela.
 */
export function DayStrip({
  schedule,
  selected,
  onSelect,
}: {
  schedule: ScheduleDay[];
  selected: string;
  onSelect: (key: string) => void;
}) {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const agora = new Date();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.tira}
      // A tira sangra até as bordas: um chip cortado na margem é o que diz
      // "tem mais para o lado" sem precisar de seta.
      style={styles.scroll}
    >
      {schedule.map((day) => {
        const tem = day.sessions.length > 0;
        const ativo = day.key === selected;
        const rotulo = shortDayLabel(day.date, agora);
        return (
          <Pressable
            key={day.key}
            accessibilityRole="button"
            accessibilityState={{ selected: ativo }}
            accessibilityLabel={`${rotulo}, dia ${day.date.getDate()}, ${
              tem
                ? `${day.sessions.length} ${day.sessions.length === 1 ? 'turma' : 'turmas'}`
                : 'sem turma'
            }`}
            onPress={() => onSelect(day.key)}
            style={[styles.dia, ativo && styles.diaAtivo, !tem && !ativo && styles.diaVazio]}
          >
            <Text
              variant="label"
              color={ativo ? colors.textOnPrimary : colors.textFaint}
              style={styles.sem}
            >
              {rotulo}
            </Text>
            <Text variant="bodyStrong" color={ativo ? colors.textOnPrimary : colors.text}>
              {day.date.getDate()}
            </Text>
            {/* O ponto some quando não há aula, e o espaço fica: sem isso os
                chips com e sem aula teriam alturas diferentes e a tira
                "pularia" ao rolar. */}
            <View
              style={[
                styles.ponto,
                tem && { backgroundColor: ativo ? colors.textOnPrimary : colors.primary },
              ]}
            />
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    scroll: { marginHorizontal: -spacing.xl },
    tira: { paddingHorizontal: spacing.xl, gap: spacing.sm, paddingVertical: 2 },
    dia: {
      minWidth: 52,
      alignItems: 'center',
      paddingVertical: spacing.sm,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.card,
      borderRadius: 16,
      borderBottomRightRadius: 26,
    },
    diaAtivo: { backgroundColor: colors.primary, borderColor: colors.primary },
    // Esmaecido, não escondido: é o vazio que mostra o ritmo da turma.
    diaVazio: { opacity: 0.34 },
    sem: { textTransform: 'uppercase', letterSpacing: 0.6, fontSize: 10.5 },
    ponto: { width: 5, height: 5, borderRadius: 99, marginTop: 3 },
  });
