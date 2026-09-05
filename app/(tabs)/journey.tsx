import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AchievementBadge, BonusWalletCard, EvolutionChart } from '@/features/journey';
import { Avatar, Badge, Card, ComingSoon, ProgressBar, Screen, Text } from '@/components/ui';
import { useChildren, useJourney } from '@/hooks/queries';
import { useOnboardingStore } from '@/stores/onboarding-store';
import { radius, spacing, useStyles, useTheme, type ThemeColors, type ThemePalette } from '@/theme';

/** Tela 10 — Jornada da criança. */
export default function JourneyScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const activeChildId = useOnboardingStore((state) => state.activeChildId);
  const { data: children = [] } = useChildren();

  const child = useMemo(
    () => children.find((item) => item.id === activeChildId) ?? children[0] ?? null,
    [activeChildId, children],
  );

  const { data: journey, isPending } = useJourney(child?.id ?? null);

  if (!child) {
    return (
      <Screen>
        <ComingSoon
          icon="star-outline"
          title="Jornada"
          description="Cadastre uma criança para acompanhar XP, conquistas e a evolução das atividades."
        />
      </Screen>
    );
  }

  if (isPending || !journey) {
    return (
      <Screen>
        <Text variant="body" color={colors.textFaint}>
          Montando a jornada…
        </Text>
      </Screen>
    );
  }

  const firstName = child.name.split(' ')[0] ?? child.name;
  const xpToNextLevel = journey.xpForLevel - journey.xpIntoLevel;

  return (
    <Screen scroll edges={['top']} contentContainerStyle={styles.scroll}>
      <Text variant="title" style={styles.pageTitle}>
        Jornada do {firstName}
      </Text>

      <Card bordered elevation="none" style={styles.headerCard}>
        <Avatar name={child.name} uri={child.photoUri} size={56} ring />
        <View style={styles.headerInfo}>
          <Text variant="subheading" numberOfLines={1}>
            {child.name}
          </Text>
          <Badge label={journey.levelName} tone="brand" />
        </View>
        <View style={styles.xpBadge}>
          <Text style={styles.xpEmoji}>🏆</Text>
          <Text variant="label" color={colors.warning}>
            {journey.xp} XP
          </Text>
        </View>
      </Card>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Ver todos os níveis e recompensas"
        onPress={() => router.push('/journey/levels')}
      >
        <Card bordered elevation="none" style={styles.levelCard}>
          <View style={styles.levelRow}>
            <Text variant="label" color={colors.textMuted}>
              Nível {journey.level} de {journey.maxLevel}
            </Text>
            <View style={styles.levelLink}>
              <Text variant="caption" color={colors.primary}>
                {journey.isMaxLevel ? 'Nível máximo' : `faltam ${xpToNextLevel} XP`}
              </Text>
              <Ionicons name="chevron-forward" size={14} color={colors.primary} />
            </View>
          </View>

          <ProgressBar
            value={journey.isMaxLevel ? 1 : journey.xpIntoLevel}
            max={journey.isMaxLevel ? 1 : journey.xpForLevel}
            label={`Progresso do nível ${journey.level}`}
          />

          {journey.isMaxLevel ? (
            <Text variant="caption" color={colors.textMuted}>
              Você chegou ao topo por enquanto. Novos níveis vêm por aí!
            </Text>
          ) : (
            <Text variant="caption" color={colors.textMuted}>
              No nível {journey.level + 1} você ganha {journey.nextLevelBonus}
              {journey.nextLevelBonus === 1 ? ' moeda bônus' : ' moedas bônus'}.
            </Text>
          )}
        </Card>
      </Pressable>

      <Text variant="subheading" style={styles.sectionTitle}>
        Moedas bônus
      </Text>
      <BonusWalletCard wallet={journey.bonus} />

      <Text variant="subheading" style={styles.sectionTitle}>
        Minhas conquistas
      </Text>
      <View style={styles.achievements}>
        {journey.achievements.map((achievement) => (
          <View key={achievement.id} style={styles.achievementSlot}>
            <AchievementBadge achievement={achievement} />
          </View>
        ))}
      </View>

      <Text variant="subheading" style={styles.sectionTitle}>
        Minhas atividades
      </Text>
      {journey.activityTally.length === 0 ? (
        <Card bordered elevation="none">
          <Text variant="caption" color={colors.textMuted}>
            Ainda não há aulas registradas. Faça o check-in na próxima atividade para começar a
            jornada do {firstName}.
          </Text>
        </Card>
      ) : (
        <View style={styles.tallyRow}>
          {journey.activityTally.map((item) => (
            <View key={item.category} style={styles.tallyCard}>
              <Text style={styles.tallyEmoji}>{item.emoji}</Text>
              <Text variant="label" numberOfLines={1}>
                {item.label}
              </Text>
              <Text variant="caption" color={colors.textMuted}>
                {item.count === 1 ? '1 aula' : `${item.count} aulas`}
              </Text>
            </View>
          ))}
        </View>
      )}

      <Text variant="subheading" style={styles.sectionTitle}>
        Minha evolução
      </Text>
      <Card bordered elevation="none" style={styles.chartCard}>
        <EvolutionChart data={journey.weeklyActivity} />
        <View style={styles.chartFooter}>
          <View style={styles.stat}>
            <Text variant="subheading" color={colors.primary}>
              {journey.totalActivities}
            </Text>
            <Text variant="caption" color={colors.textMuted}>
              {journey.totalActivities === 1 ? 'atividade' : 'atividades'}
            </Text>
          </View>
          <View style={styles.stat}>
            <Text variant="subheading" color={colors.primary}>
              {journey.totalCategories}
            </Text>
            <Text variant="caption" color={colors.textMuted}>
              {journey.totalCategories === 1 ? 'modalidade' : 'modalidades'}
            </Text>
          </View>
        </View>
      </Card>
    </Screen>
  );
}

const makeStyles = (colors: ThemeColors, palette: ThemePalette) =>
  StyleSheet.create({
    scroll: { paddingBottom: spacing.xxl },
    pageTitle: { marginTop: spacing.md, marginBottom: spacing.lg },
    headerCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.base },
    headerInfo: { flex: 1, gap: spacing.xs },
    xpBadge: {
      alignItems: 'center',
      gap: spacing.xxs,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.md,
      backgroundColor: palette.yellowSoft,
    },
    xpEmoji: { fontSize: 16 },
    levelCard: { gap: spacing.sm, marginTop: spacing.md },
    levelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    levelLink: { flexDirection: 'row', alignItems: 'center', gap: spacing.xxs },
    sectionTitle: { marginTop: spacing.xl, marginBottom: spacing.md },
    achievements: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    achievementSlot: { width: '23%', flexGrow: 1, flexBasis: '23%' },
    tallyRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    tallyCard: {
      flexGrow: 1,
      flexBasis: '30%',
      alignItems: 'center',
      gap: spacing.xxs,
      padding: spacing.md,
      borderRadius: radius.lg,
      backgroundColor: colors.backgroundMuted,
    },
    tallyEmoji: { fontSize: 24, lineHeight: 30 },
    chartCard: { gap: spacing.lg },
    chartFooter: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: spacing.base,
    },
    stat: { alignItems: 'center', gap: spacing.xxs },
  });
