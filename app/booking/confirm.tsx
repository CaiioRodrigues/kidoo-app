import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { HeaderBar } from '@/components/navigation';
import { Avatar, Button, Card, CoinBadge, Screen, Text } from '@/components/ui';
import { formatAge, formatSessionTime } from '@/lib/format';
import { toUserMessage } from '@/services';
import { useActivity, useChildren, useCreateBooking, useSubscription } from '@/hooks/queries';
import { useOnboardingStore } from '@/stores/onboarding-store';
import { colors, palette, radius, spacing } from '@/theme';

/** Tela 8 — Confirmar reserva. */
export default function ConfirmBookingScreen() {
  const router = useRouter();
  const { activityId } = useLocalSearchParams<{ activityId: string }>();

  const { data: activity, isPending } = useActivity(activityId ?? '');
  const { data: children = [] } = useChildren();
  const { data: subscription } = useSubscription();
  const activeChildId = useOnboardingStore((state) => state.activeChildId);
  const createBooking = useCreateBooking();
  const [error, setError] = useState<string | null>(null);

  const child = useMemo(
    () => children.find((item) => item.id === activeChildId) ?? children[0] ?? null,
    [activeChildId, children],
  );

  const coinsAfter =
    subscription && activity ? subscription.coinsRemaining - activity.coinCost : null;
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
      ) : (
        <Card bordered elevation="none" style={styles.childCard}>
          <Ionicons name="alert-circle-outline" size={22} color={colors.warning} />
          <Text variant="caption" color={colors.textMuted} style={styles.flex}>
            Cadastre uma criança antes de reservar uma atividade.
          </Text>
        </Card>
      )}

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

      <Button
        title="Confirmar reserva"
        loading={createBooking.isPending}
        disabled={!child || notEnoughCoins}
        onPress={() => void handleConfirm()}
        style={styles.cta}
      />

      {coinsAfter !== null ? (
        <Text variant="caption" color={notEnoughCoins ? colors.danger : colors.textFaint} center>
          {notEnoughCoins
            ? 'Kidoo Coins insuficientes para esta reserva neste ciclo.'
            : `Você ainda terá ${coinsAfter} coins após esta reserva.`}
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
  coinsRow: { alignItems: 'center', marginTop: spacing.lg },
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
