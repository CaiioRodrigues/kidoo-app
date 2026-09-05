import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { HeaderBar } from '@/components/navigation';
import { Avatar, Button, Card, CoinBadge, Screen, Text } from '@/components/ui';
import { formatAge, formatDaysUntil, formatSessionTime } from '@/lib/format';
import { daysUntilReset } from '@/lib/subscription';
import { splitPayment } from '@/lib/bonus';
import { toUserMessage } from '@/services';
import {
  useActivity,
  useChildren,
  useCreateBooking,
  useJourney,
  useSubscription,
} from '@/hooks/queries';
import { useAuthStore } from '@/stores/auth-store';
import { useOnboardingStore } from '@/stores/onboarding-store';
import { colors, palette, radius, spacing } from '@/theme';

type Blocker = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  action: string;
  href: '/(auth)/sign-up' | '/(onboarding)/child' | '/(onboarding)/plan';
};

/** Tela 8 — Confirmar reserva. */
export default function ConfirmBookingScreen() {
  const router = useRouter();
  const { activityId } = useLocalSearchParams<{ activityId: string }>();

  const { data: activity, isPending } = useActivity(activityId ?? '');
  const { data: children = [] } = useChildren();
  const { data: subscription } = useSubscription();
  const activeChildId = useOnboardingStore((state) => state.activeChildId);
  const authenticated = useAuthStore((state) => state.status === 'authenticated');
  const createBooking = useCreateBooking();
  const [error, setError] = useState<string | null>(null);

  const child = useMemo(
    () => children.find((item) => item.id === activeChildId) ?? children[0] ?? null,
    [activeChildId, children],
  );

  /**
   * O que ainda falta para reservar. Cada caso tem uma ação — a tela nunca
   * apenas informa que não dá; ela leva o usuário ao passo que resolve.
   */
  const blocker: Blocker | null = !authenticated
    ? {
        icon: 'person-add-outline',
        title: 'Crie sua conta para reservar',
        description: 'Leva menos de um minuto e você já sai com a primeira aula marcada.',
        action: 'Criar conta',
        href: '/(auth)/sign-up',
      }
    : !child
      ? {
          icon: 'happy-outline',
          title: 'Falta cadastrar o seu pequeno',
          description: 'Precisamos saber a idade da criança para confirmar a turma certa.',
          action: 'Cadastrar criança',
          href: '/(onboarding)/child',
        }
      : !subscription
        ? {
            icon: 'card-outline',
            title: 'Escolha um plano para reservar',
            description: 'As reservas usam Kidoo Coins, que vêm com a assinatura.',
            action: 'Ver planos',
            href: '/(onboarding)/plan',
          }
        : null;

  const { data: journey } = useJourney(child?.id ?? null);
  const bonusBalance = journey?.bonus.balance ?? 0;

  // As moedas bônus entram antes da cota semanal, porque expiram.
  const payment = activity ? splitPayment(activity.coinCost, bonusBalance) : null;
  const coinsAfter =
    subscription && payment ? subscription.coinsRemaining - payment.fromSubscription : null;
  const notEnoughCoins = coinsAfter !== null && coinsAfter < 0;

  const handleConfirm = useCallback(async () => {
    if (!activity || !child) return;
    setError(null);

    try {
      const booking = await createBooking.mutateAsync({
        activityId: activity.id,
        childId: child.id,
      });
      router.replace({ pathname: '/booking/[id]/check-in', params: { id: booking.id } });
    } catch (caught) {
      setError(toUserMessage(caught));
    }
  }, [activity, child, createBooking, router]);

  if (isPending || !activity) {
    return (
      <Screen>
        <HeaderBar />
        <Text variant="body" color={colors.textFaint}>
          Carregando reserva…
        </Text>
      </Screen>
    );
  }

  return (
    <Screen scroll contentContainerStyle={styles.scroll}>
      <HeaderBar />

      <Text variant="title" center style={styles.title}>
        Confirmar reserva?
      </Text>

      {child ? (
        <Card bordered elevation="none" style={styles.childCard}>
          <Avatar name={child.name} uri={child.photoUri} size={48} ring />
          <View style={styles.flex}>
            <Text variant="bodyStrong" numberOfLines={1}>
              {child.name}
            </Text>
            <Text variant="caption" color={colors.textMuted}>
              {formatAge(child.birthDate)}
            </Text>
          </View>
        </Card>
      ) : blocker ? (
        <Card background={palette.purpleTint} elevation="none" style={styles.blockerCard}>
          <View style={styles.blockerHeader}>
            <View style={styles.blockerIcon}>
              <Ionicons name={blocker.icon} size={20} color={colors.primary} />
            </View>
            <View style={styles.flex}>
              <Text variant="bodyStrong">{blocker.title}</Text>
              <Text variant="caption" color={colors.textMuted}>
                {blocker.description}
              </Text>
            </View>
          </View>
          <Button title={blocker.action} size="md" onPress={() => router.push(blocker.href)} />
        </Card>
      ) : null}

      <Card bordered elevation="none" style={styles.detailsCard}>
        <DetailRow icon="football-outline" label={activity.title} sub={activity.partner.name} />
        <DetailRow
          icon="calendar-outline"
          label={formatSessionTime(activity.nextSessionAt)}
          sub={`${activity.partner.neighborhood}, ${activity.partner.city}`}
        />
      </Card>

      <View style={styles.coinsRow}>
        <CoinBadge amount={activity.coinCost} />
        {payment && payment.fromBonus > 0 ? (
          <Text variant="caption" color={colors.textMuted} center style={styles.split}>
            {payment.fromBonus === 1 ? '1 moeda bônus' : `${payment.fromBonus} moedas bônus`}
            {payment.fromSubscription > 0
              ? ` + ${payment.fromSubscription} da assinatura`
              : ' — esta aula sai de graça!'}
          </Text>
        ) : null}
      </View>

      <Card background={palette.purpleTint} elevation="none" style={styles.noticeCard}>
        <Ionicons name="information-circle-outline" size={18} color={colors.primary} />
        <View style={styles.flex}>
          <Text variant="label" color={colors.text}>
            Importante
          </Text>
          <Text variant="caption" color={colors.textMuted}>
            Leve garrafinha de água e roupa confortável. Chegue 10 minutos antes para o check-in.
          </Text>
        </View>
      </Card>

      {error ? (
        <Text variant="caption" color={colors.danger} center style={styles.error}>
          {error}
        </Text>
      ) : null}

      {blocker ? null : (
        <Button
          title="Confirmar reserva"
          loading={createBooking.isPending}
          disabled={notEnoughCoins}
          onPress={() => void handleConfirm()}
          style={styles.cta}
        />
      )}

      {coinsAfter !== null && subscription ? (
        <Text variant="caption" color={notEnoughCoins ? colors.danger : colors.textFaint} center>
          {notEnoughCoins
            ? `Seus coins desta semana acabaram. A cota volta ao cheio ${formatDaysUntil(
                daysUntilReset(subscription),
              )}.`
            : `Você ainda terá ${coinsAfter} de ${subscription.coinsPerWeek} coins nesta semana.`}
        </Text>
      ) : null}
    </Screen>
  );
}

function DetailRow({
  icon,
  label,
  sub,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  sub: string;
}) {
  return (
    <View style={styles.detailRow}>
      <View style={styles.detailIcon}>
        <Ionicons name={icon} size={18} color={colors.primary} />
      </View>
      <View style={styles.flex}>
        <Text variant="bodyStrong" numberOfLines={1}>
          {label}
        </Text>
        <Text variant="caption" color={colors.textMuted} numberOfLines={1}>
          {sub}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.xxl },
  title: { marginTop: spacing.sm, marginBottom: spacing.xl },
  childCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.base,
    marginBottom: spacing.md,
  },
  blockerCard: { gap: spacing.base, marginBottom: spacing.md },
  blockerHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  blockerIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  detailsCard: { gap: spacing.base },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  detailIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryTint,
  },
  coinsRow: { alignItems: 'center', gap: spacing.sm, marginTop: spacing.lg },
  split: { paddingHorizontal: spacing.base },
  noticeCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  error: { marginTop: spacing.md },
  cta: { marginTop: spacing.xl, marginBottom: spacing.md },
  flex: { flex: 1 },
});
