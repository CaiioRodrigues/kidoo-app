import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { HeaderBar } from '@/components/navigation';
import { Guara } from '@/components/brand';
import { Button, Card, Screen, SelectableCard, StepIndicator, Text } from '@/components/ui';
import { useCategories, useSubscription } from '@/hooks/queries';
import { useCriarCriancaDoRascunho } from '@/hooks/onboarding';
import { toUserMessage } from '@/services';
import { useOnboardingStore } from '@/stores/onboarding-store';
import { spacing, useStyles, useTheme, type ThemeColors, type ThemePalette } from '@/theme';

/** Tela 3 (etapa 2) — Quais atividades ele mais gosta? */
export default function InterestsScreen() {
  const { colors, palette } = useTheme();
  const styles = useStyles(makeStyles);
  const router = useRouter();
  const { data: categories = [], isPending } = useCategories();
  const interests = useOnboardingStore((state) => state.draft.interests);
  const toggleInterest = useOnboardingStore((state) => state.toggleInterest);
  const reset = useOnboardingStore((state) => state.reset);
  const {
    data: subscription,
    isPending: assinaturaPendente,
    fetchStatus: assinaturaFetchStatus,
  } = useSubscription();
  const { criar, criando } = useCriarCriancaDoRascunho();
  const [error, setError] = useState<string | null>(null);

  const jaAssina = subscription != null;

  /**
   * `subscription` é `undefined` tanto para quem não assina quanto enquanto a
   * resposta não chegou — e os dois casos levam a telas diferentes. Decidir com
   * `undefined` mandaria uma família que já assina para a tela de planos só por
   * ela ter tocado no botão rápido demais.
   *
   * `isPending` sozinho não serve: a consulta é `enabled: authenticated`, e uma
   * consulta desligada fica em `pending` para sempre — o botão nunca liberaria
   * para quem está sem conta. Buscando de verdade é `pending` **e**
   * `fetchStatus === 'fetching'`; desligada é `pending` com `'idle'`.
   */
  const conferindoAssinatura = assinaturaPendente && assinaturaFetchStatus === 'fetching';

  /**
   * Quem já assina não passa pela tela de planos — e isso não é atalho de
   * conveniência.
   *
   * `subscribe_plan` resolve o conflito com `renews_at = excluded.renews_at`.
   * Mandar uma família que já assina para a tela de planos e deixá-la
   * confirmar empurraria a renovação um mês para a frente a cada irmão
   * cadastrado: um mês de graça por filho, sem nada na tela denunciando.
   * O plano é da família, não da criança; cadastrar irmão não toca na
   * assinatura.
   */
  const handleContinue = useCallback(async () => {
    if (interests.length === 0) {
      setError('Escolha ao menos uma atividade para personalizarmos as sugestões.');
      return;
    }
    setError(null);

    if (!jaAssina) {
      router.push('/(onboarding)/plan');
      return;
    }

    try {
      await criar();
      reset();
      router.replace('/(tabs)/home');
    } catch (caught) {
      setError(toUserMessage(caught));
    }
  }, [criar, interests.length, jaAssina, reset, router]);

  return (
    <Screen scroll contentContainerStyle={styles.scroll}>
      {/* Quem já assina percorre duas telas, não quatro: a contagem acompanha
          o caminho que a pessoa está fazendo, senão os pontos param no meio. */}
      <HeaderBar center={<StepIndicator total={jaAssina ? 2 : 4} current={2} />} />

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
          <Guara size={72} />
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
                category={category.id}
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

      <Button
        title={jaAssina ? 'Concluir cadastro' : 'Continuar'}
        onPress={() => void handleContinue()}
        loading={criando || conferindoAssinatura}
        style={styles.cta}
      />
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
      borderRadius: 44,
      borderBottomLeftRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: palette.pinkSoft,
    },
    loading: { marginTop: spacing.xxl },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.md,
      marginTop: spacing.xl,
    },
    // 3 colunas: 31% arredondava para mais que a largura útil e caía para 2.
    gridItem: { flexGrow: 1, flexBasis: '30%' },
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
