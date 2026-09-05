import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { HeaderBar } from '@/components/navigation';
import { Button, Card, Screen, SelectableCard, StepIndicator, Text } from '@/components/ui';
import { useCategories } from '@/hooks/queries';
import { useOnboardingStore } from '@/stores/onboarding-store';
import { radius, spacing, useStyles, useTheme, type ThemeColors, type ThemePalette } from '@/theme';

/** Tela 3 (etapa 2) — Quais atividades ele mais gosta? */
export default function InterestsScreen() {
  const { colors, palette } = useTheme();
  const styles = useStyles(makeStyles);
  const router = useRouter();
  const { data: categories = [], isPending } = useCategories();
  const interests = useOnboardingStore((state) => state.draft.interests);
  const toggleInterest = useOnboardingStore((state) => state.toggleInterest);
  const [error, setError] = useState<string | null>(null);

  const handleContinue = useCallback(() => {
    if (interests.length === 0) {
      setError('Escolha ao menos uma atividade para personalizarmos as sugestões.');
      return;
    }
    setError(null);
    router.push('/(onboarding)/plan');
  }, [interests.length, router]);

  return (
    <Screen scroll contentContainerStyle={styles.scroll}>
      <HeaderBar center={<StepIndicator total={4} current={2} />} />

      <View style={styles.intro}>
        <View style={styles.introText}>
          <Text variant="title">
            Quais{' '}
            <Text variant="title" color={colors.primary}>
              atividades
            </Text>{' '}
            ele mais gosta?
          </Text>
          <Text variant="body" color={colors.textMuted}>
            Selecione as atividades que ele tem mais interesse.
          </Text>
        </View>
        <View style={styles.introArt}>
          <Text style={styles.introEmoji}>🏆</Text>
        </View>
      </View>

      {isPending ? (
        <Text variant="body" color={colors.textFaint} style={styles.loading}>
          Carregando atividades…
        </Text>
      ) : (
        <View style={styles.grid}>
          {categories.map((category) => (
            <View key={category.id} style={styles.gridItem}>
              <SelectableCard
                label={category.label}
                emoji={category.emoji}
                selected={interests.includes(category.id)}
                onToggle={() => toggleInterest(category.id)}
              />
            </View>
          ))}
        </View>
      )}

      <Card background={palette.yellowSoft} elevation="none" style={styles.tip}>
        <Text style={styles.tipEmoji}>⭐</Text>
        <Text variant="caption" color={colors.text} style={styles.tipText}>
          Não se preocupe, depois vocês podem explorar novas atividades juntos!
        </Text>
      </Card>

      {error ? (
        <Text variant="caption" color={colors.danger} style={styles.error}>
          {error}
        </Text>
      ) : null}

      <Button title="Continuar" onPress={handleContinue} style={styles.cta} />
    </Screen>
  );
}

const makeStyles = (_colors: ThemeColors, palette: ThemePalette) =>
  StyleSheet.create({
    scroll: { paddingBottom: spacing.xxl },
    intro: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.base,
      paddingTop: spacing.sm,
    },
    introText: { flex: 1, gap: spacing.sm },
    introArt: {
      width: 88,
      height: 88,
      borderRadius: radius.xxl,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: palette.pinkSoft,
    },
    introEmoji: { fontSize: 40, lineHeight: 48 },
    loading: { marginTop: spacing.xxl },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.md,
      marginTop: spacing.xl,
    },
    // 3 colunas: cada item ocupa ~1/3 descontando os dois gaps.
    gridItem: { width: '31%', flexGrow: 1, flexBasis: '31%' },
    tip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      marginTop: spacing.xl,
    },
    tipEmoji: { fontSize: 22 },
    tipText: { flex: 1 },
    error: { marginTop: spacing.md },
    cta: { marginTop: spacing.xl },
  });
