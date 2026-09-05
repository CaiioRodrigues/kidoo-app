import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { HeaderBar } from '@/components/navigation';
import { Badge, Card, ProgressBar, Screen, Text } from '@/components/ui';
import { LEVEL_TABLE, XP_PER_CHECK_IN, type LevelRow } from '@/lib/levels';
import { useChildren, useJourney } from '@/hooks/queries';
import { useOnboardingStore } from '@/stores/onboarding-store';
import { radius, spacing, useStyles, useTheme, type ThemeColors } from '@/theme';

/**
 * Níveis e recompensas.
 *
 * A pergunta que esta tela responde é "o que eu ganho no próximo nível?".
 * Por isso o próximo nível vem destacado no topo, e não só como mais uma
 * linha no meio da tabela.
 */
export default function LevelsScreen() {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);

  const activeChildId = useOnboardingStore((state) => state.activeChildId);
  const { data: children = [] } = useChildren();
  const child = useMemo(
    () => children.find((item) => item.id === activeChildId) ?? children[0] ?? null,
    [activeChildId, children],
  );
  const { data: journey } = useJourney(child?.id ?? null);

  const currentLevel = journey?.level ?? 1;
  const nextRow = LEVEL_TABLE.find((row) => row.level === currentLevel + 1) ?? null;
  const xpToNext = journey ? journey.xpForLevel - journey.xpIntoLevel : 0;
  const activitiesToNext = Math.ceil(xpToNext / XP_PER_CHECK_IN);

  return (
    <Screen padded={false} edges={['top']}>
      <View style={styles.header}>
        <HeaderBar title="Níveis e recompensas" />
      </View>

      <FlatList
        data={LEVEL_TABLE}
        keyExtractor={keyExtractor}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.intro}>
            {journey && !journey.isMaxLevel && nextRow ? (
              <Card background={colors.primaryTint} elevation="none" style={styles.nextCard}>
                <Text variant="label" color={colors.textMuted}>
                  Próximo nível
                </Text>
                <View style={styles.nextHeader}>
                  <Text variant="title" color={colors.primary}>
                    Nível {nextRow.level}
                  </Text>
                  <Badge label={nextRow.name} tone="brand" />
                </View>

                <View style={styles.rewardRow}>
                  <Text style={styles.gift}>🎁</Text>
                  <Text variant="bodyStrong" color={colors.text}>
                    {nextRow.bonus === 1 ? '1 moeda bônus' : `${nextRow.bonus} moedas bônus`}
                  </Text>
                </View>

                <ProgressBar
                  value={journey.xpIntoLevel}
                  max={journey.xpForLevel}
                  label={`Progresso do nível ${journey.level}`}
                />
                <Text variant="caption" color={colors.textMuted}>
                  Faltam {xpToNext} XP —{' '}
                  {activitiesToNext === 1 ? '1 aula' : `${activitiesToNext} aulas`} para chegar lá.
                </Text>
              </Card>
            ) : journey?.isMaxLevel ? (
              <Card background={colors.primaryTint} elevation="none" style={styles.nextCard}>
                <Text style={styles.gift}>🏆</Text>
                <Text variant="subheading" color={colors.primary}>
                  Nível máximo alcançado
                </Text>
                <Text variant="caption" color={colors.textMuted}>
                  Você chegou ao nível {journey.maxLevel}. Novos níveis vêm por aí!
                </Text>
              </Card>
            ) : null}

            <Text variant="caption" color={colors.textFaint} style={styles.legend}>
              Cada aula com check-in vale {XP_PER_CHECK_IN} XP. As moedas bônus valem 30 dias e são
              usadas antes dos coins da assinatura.
            </Text>
          </View>
        }
        renderItem={({ item }) => <LevelRowItem row={item} currentLevel={currentLevel} />}
      />
    </Screen>
  );
}

function LevelRowItem({ row, currentLevel }: { row: LevelRow; currentLevel: number }) {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);

  const reached = row.level <= currentLevel;
  const isCurrent = row.level === currentLevel;

  return (
    <View style={[styles.row, isCurrent && styles.rowCurrent]}>
      <View style={[styles.levelBadge, reached ? styles.levelReached : styles.levelLocked]}>
        <Text variant="bodyStrong" color={reached ? colors.textOnPrimary : colors.textFaint}>
          {row.level}
        </Text>
      </View>

      <View style={styles.rowInfo}>
        <Text variant="bodyStrong" color={reached ? colors.text : colors.textMuted}>
          {row.name}
        </Text>
        <Text variant="caption" color={colors.textFaint}>
          {row.level === 1
            ? 'Ponto de partida'
            : `${row.totalXp} XP acumulados · ${row.totalActivities} aulas`}
        </Text>
      </View>

      {row.bonus > 0 ? (
        <View style={styles.rowReward}>
          <Text style={styles.giftSmall}>🎁</Text>
          <Text variant="label" color={reached ? colors.text : colors.textFaint}>
            {row.bonus}
          </Text>
        </View>
      ) : (
        <Ionicons name="flag-outline" size={16} color={colors.textFaint} />
      )}
    </View>
  );
}

const keyExtractor = (row: LevelRow) => String(row.level);

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    header: { paddingHorizontal: spacing.xl },
    list: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl },
    intro: { gap: spacing.base, marginBottom: spacing.lg },
    nextCard: { gap: spacing.sm },
    nextHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    rewardRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    gift: { fontSize: 22 },
    giftSmall: { fontSize: 14 },
    legend: { paddingHorizontal: spacing.xxs },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
      borderRadius: radius.lg,
    },
    rowCurrent: { backgroundColor: colors.primaryTint },
    levelBadge: {
      width: 40,
      height: 40,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    levelReached: { backgroundColor: colors.primary },
    levelLocked: { backgroundColor: colors.backgroundMuted },
    rowInfo: { flex: 1, gap: spacing.xxs },
    rowReward: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  });
