import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Badge, Button, Card, Text } from '@/components/ui';
import { HeaderBar } from '@/components/navigation';
import { formatPrice } from '@/lib/format';
import { toUserMessage } from '@/services';
import { useCreateChild, usePlans, useSubscribe } from '@/hooks/queries';
import { useOnboardingStore } from '@/stores/onboarding-store';
import { colors, palette, radius, spacing } from '@/theme';
import type { Plan, PlanId } from '@/types/domain';

/** Tela 4 — Escolha o plano ideal para sua família. */
export default function PlanScreen() {
  const router = useRouter();
  const { data: plans = [] } = usePlans();
  const draft = useOnboardingStore((state) => state.draft);
  const selectedPlanId = useOnboardingStore((state) => state.selectedPlanId);
  const selectPlan = useOnboardingStore((state) => state.selectPlan);
  const setActiveChild = useOnboardingStore((state) => state.setActiveChild);
  const reset = useOnboardingStore((state) => state.reset);

  const createChild = useCreateChild();
  const subscribe = useSubscribe();
  const [error, setError] = useState<string | null>(null);

  const activePlanId: PlanId | null =
    selectedPlanId ?? plans.find((plan) => plan.highlighted)?.id ?? null;

  const handleConfirm = useCallback(async () => {
    if (!activePlanId) return;
    setError(null);

    try {
      // Esta tela também é usada por quem só quer assinar (já tem criança
      // cadastrada). Sem rascunho preenchido, não há criança nova para criar.
      const hasDraft = draft.name.trim().length > 0 && draft.birthDate.length > 0;

      if (hasDraft) {
        // O cadastro da criança só é enviado agora, ao final do fluxo consentido.
        const child = await createChild.mutateAsync({
          name: draft.name,
          birthDate: draft.birthDate,
          gender: draft.gender,
          photoUri: draft.photoUri,
          interests: draft.interests,
        });
        setActiveChild(child.id);
      }

      await subscribe.mutateAsync(activePlanId);

      reset();
      router.replace('/(tabs)/home');
    } catch (caught) {
      setError(toUserMessage(caught));
    }
  }, [activePlanId, createChild, draft, reset, router, setActiveChild, subscribe]);

  const submitting = createChild.isPending || subscribe.isPending;

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.header}>
        <View style={styles.headerInner}>
          <HeaderBar
            center={
              <View style={styles.headerCenter}>
                <Text style={styles.crown}>👑</Text>
                <Text variant="subheading" color={colors.textOnPrimary} center>
                  Escolha o plano ideal{'\n'}para sua família
                </Text>
              </View>
            }
          />
          <Badge label="Cancele quando quiser" tone="yellow" style={styles.headerBadge} />
        </View>
      </SafeAreaView>

      <SafeAreaView edges={['bottom']} style={styles.body}>
        <View style={styles.plans}>
          {plans.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              selected={plan.id === activePlanId}
              onSelect={() => selectPlan(plan.id)}
            />
          ))}
        </View>

        <Card background={palette.yellowSoft} elevation="none" style={styles.cycleCard}>
          <Text style={styles.cycleEmoji}>🔄</Text>
          <Text variant="caption" color={colors.text} style={styles.cycleText}>
            Seus coins voltam ao cheio toda segunda-feira. A cobrança é mensal, mas a cota é semanal
            — assim dá para manter uma rotina de atividades.
          </Text>
        </Card>

        <View style={styles.perks}>
          <PerkPill icon="checkmark-circle-outline" label="Acesso a todos os parceiros" />
          <PerkPill icon="refresh-outline" label="Cancelamento fácil" />
          <PerkPill icon="chatbubble-ellipses-outline" label="Suporte especializado" />
        </View>

        {error ? (
          <Text variant="caption" color={colors.danger} style={styles.error}>
            {error}
          </Text>
        ) : null}

        <Button
          title="Escolher plano"
          loading={submitting}
          disabled={!activePlanId}
          onPress={() => void handleConfirm()}
          style={styles.cta}
        />
        <Text variant="caption" color={colors.textFaint} center>
          A cobrança só acontece após a confirmação no próximo passo.
        </Text>
      </SafeAreaView>
    </View>
  );
}

function PlanCard({
  plan,
  selected,
  onSelect,
}: {
  plan: Plan;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`Plano ${plan.name}, ${formatPrice(plan.priceCents)} por mês`}
      onPress={onSelect}
    >
      <Card
        bordered
        elevation={selected ? 'raised' : 'none'}
        style={[styles.planCard, selected && styles.planCardSelected]}
      >
        {plan.highlighted ? (
          <Badge label="Mais escolhido" tone="teal" style={styles.planTag} />
        ) : null}

        <View style={styles.planHeader}>
          <Text variant="subheading">{plan.name}</Text>
          <View style={styles.planPrice}>
            <Text variant="bodyStrong" color={selected ? colors.primary : colors.text}>
              {formatPrice(plan.priceCents)}
            </Text>
            <Text variant="caption" color={colors.textFaint}>
              /mês
            </Text>
            {selected ? (
              <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
            ) : null}
          </View>
        </View>

        <View style={styles.planCoins}>
          <Text style={styles.coinEmoji}>🪙</Text>
          <Text variant="label" color={colors.warning}>
            {plan.coinsPerWeek} coins por semana
          </Text>
        </View>

        <Text variant="caption" color={colors.textMuted}>
          Cerca de {plan.activitiesPerWeek} atividades por semana · {plan.tagline}
        </Text>
      </Card>
    </Pressable>
  );
}

function PerkPill({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  return (
    <View style={styles.perk}>
      <Ionicons name={icon} size={16} color={colors.primary} />
      <Text variant="caption" color={colors.textMuted} style={styles.perkLabel}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { backgroundColor: colors.primary },
  headerInner: { paddingHorizontal: spacing.xl, paddingBottom: spacing.lg, alignItems: 'center' },
  headerCenter: { alignItems: 'center', gap: spacing.xs },
  crown: { fontSize: 24 },
  headerBadge: { marginTop: spacing.md },
  body: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.base,
    gap: spacing.base,
  },
  plans: { gap: spacing.md },
  planCard: { gap: spacing.sm, borderColor: colors.border },
  planCardSelected: { borderColor: colors.primary, backgroundColor: colors.primaryTint },
  planTag: { marginBottom: spacing.xs },
  planHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  planPrice: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  planCoins: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  coinEmoji: { fontSize: 14 },
  cycleCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  cycleEmoji: { fontSize: 20 },
  cycleText: { flex: 1 },
  perks: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'center' },
  perk: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: palette.purpleTint,
  },
  perkLabel: { flexShrink: 1 },
  error: { textAlign: 'center' },
  cta: { marginTop: 'auto' },
});
