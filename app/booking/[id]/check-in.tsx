import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, ZoomIn } from 'react-native-reanimated';

import { HeaderBar } from '@/components/navigation';
import { Avatar, Button, Card, Screen, Text } from '@/components/ui';
import { CheckInTicketCard, ProximityCard } from '@/features/check-in';
import { HintBubble, useOneTimeHint } from '@/features/tutorial';
import { PreferenceKeys } from '@/lib/preferences';
import { AchievementCard, shareAchievement, type AchievementShare } from '@/features/share';
import { levelName } from '@/lib/levels';
import { formatSessionTime } from '@/lib/format';
import {
  canCancel,
  cancellationMessage,
  cancellationWarning,
  formatDeadline,
} from '@/lib/cancellation';
import { canCheckIn, checkInWindow, isTicketValid, proximityTo } from '@/lib/check-in';
import { confirmAction } from '@/lib/confirm';
import { useLocationStore } from '@/stores/location-store';
import { toUserMessage } from '@/services';
import { useBooking, useCancelBooking, useCheckIn } from '@/hooks/queries';
import { hitSlop, radius, spacing, useStyles, useTheme, type ThemeColors } from '@/theme';

const CONFETTI = ['🎉', '⭐', '🎈', '✨', '🎊', '💜'];

/** Tela 9 — Check-in realizado. */
export default function CheckInScreen() {
  const { colors, palette } = useTheme();
  const styles = useStyles(makeStyles);
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  // O hook relê sozinho enquanto a confirmação do parceiro não chega: é nessa
  // janela que o XP entra, e ele entra do outro lado do balcão.
  const { data: booking, isPending } = useBooking(id ?? '');
  const checkIn = useCheckIn();
  const [error, setError] = useState<string | null>(null);

  const locationProof = useLocationStore((state) => state.proof);
  const locationStatus = useLocationStore((state) => state.status);
  const ensureLocation = useLocationStore((state) => state.ensure);
  const refreshLocation = useLocationStore((state) => state.refresh);
  const requestLocation = useLocationStore((state) => state.request);

  const result = checkIn.data ?? null;
  const reward = booking?.reward ?? null;
  const cancelBooking = useCancelBooking();
  const cardRef = useRef<View>(null);
  const done = booking?.status === 'checked_in' || booking?.status === 'completed';
  const confirmed = booking?.status === 'completed' && booking.partnerConfirmedAt !== null;
  // Depois da confirmação o banco anula o código — e a tela também tem de
  // anular. `result` guarda o comprovante da chamada de check-in, então sem
  // esta guarda o QR continuaria na tela com cara de válido depois de usado.
  const ticket = confirmed ? null : (result?.ticket ?? booking?.checkIn ?? null);
  // O código vale 30 minutos, mas a janela de check-in vai até 90 depois da
  // aula: quem entra cedo e espera o professor fica com um código morto na
  // mão. Reemitir é o próprio check-in de novo — ele não credita nada nem
  // revalida distância para quem já entrou.
  const ticketExpirado = ticket !== null && !isTicketValid(ticket);
  // A dica só aparece quando há código na tela — é sobre ele que ela fala.
  const hint = useOneTimeHint(PreferenceKeys.hintCheckIn, Boolean(ticket));
  const firstName = booking?.child.name.split(' ')[0] ?? '';

  const handleCheckIn = useCallback(async () => {
    if (!booking) return;
    setError(null);
    try {
      await checkIn.mutateAsync(booking.id);
    } catch (caught) {
      setError(toUserMessage(caught));
    }
  }, [booking, checkIn]);

  // A posição guardada pode ser de outra tela, de minutos atrás. Aqui ela
  // precisa ser de agora — é o que decide se o botão abre.
  //
  // E `ensure`, não `refresh`: este só relê uma permissão que já existe. Com
  // ele, quem nunca tocou em "Perto de mim" chegava aqui sem localização
  // nenhuma e o portão de 250 m não checava nada. Agora o app pergunta, uma
  // vez, no único momento em que o motivo é óbvio para quem responde.
  useEffect(() => {
    void ensureLocation();
  }, [ensureLocation]);

  const proximity = useMemo(
    () =>
      booking
        ? proximityTo(
            {
              latitude: booking.activity.partner.latitude,
              longitude: booking.activity.partner.longitude,
            },
            locationProof,
          )
        : ({ kind: 'unknown' } as const),
    [booking, locationProof],
  );

  const window = useMemo(
    () => checkInWindow(booking?.scheduledAt ?? new Date().toISOString()),
    [booking?.scheduledAt],
  );

  const gate = canCheckIn(proximity, window);

  const cancellation = booking ? canCancel(booking) : null;

  const handleCancel = useCallback(async () => {
    if (!booking || !cancellation?.allowed) return;
    // O aviso muda com o prazo, e tem de mudar: prometer "os coins voltam" em
    // cima da hora seria mentir na única tela em que a pessoa ainda pode
    // desistir de desistir.
    const confirmado = await confirmAction({
      title: cancellation.refunds ? 'Cancelar reserva?' : 'Desmarcar sem devolução?',
      message: cancellationWarning(cancellation),
      confirmLabel: cancellation.refunds ? 'Cancelar reserva' : 'Desmarcar mesmo assim',
      destructive: true,
    });
    if (!confirmado) return;

    try {
      await cancelBooking.mutateAsync(booking.id);
      router.replace('/(tabs)/bookings');
    } catch (caught) {
      setError(toUserMessage(caught));
    }
  }, [booking, cancelBooking, cancellation, router]);

  // Memoizado para não recriar o objeto a cada render e invalidar o callback.
  // Só existe depois que o parceiro confirma: é dele que vem o XP, e não faz
  // sentido compartilhar "cheguei" — compartilha-se "foi".
  const shareData = useMemo<AchievementShare | null>(
    () =>
      booking && reward
        ? {
            booking,
            xpEarned: reward.xpEarned,
            levelUp: reward.levelUp
              ? { to: reward.levelUp.to, bonusEarned: reward.levelUp.bonusEarned }
              : null,
            levelName: levelName(reward.levelUp?.to ?? booking.child.level),
          }
        : null,
    [booking, reward],
  );

  const handleShare = useCallback(async () => {
    if (!shareData) return;
    await shareAchievement(cardRef, shareData);
  }, [shareData]);

  if (isPending || !booking) {
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
      <HeaderBar onBack={() => router.replace('/(tabs)/bookings')} />

      <View style={styles.hero}>
        {done ? (
          <Animated.View entering={FadeIn.duration(400)} style={styles.confettiRow}>
            {CONFETTI.map((emoji, index) => (
              <Animated.Text
                key={emoji}
                entering={FadeInDown.delay(index * 70).duration(420)}
                style={styles.confetti}
              >
                {emoji}
              </Animated.Text>
            ))}
          </Animated.View>
        ) : null}

        <Animated.View entering={ZoomIn.duration(420)} style={styles.avatarWrapper}>
          <Avatar name={booking.child.name} uri={booking.child.photoUri} size={116} ring />
          {done ? (
            <View style={styles.checkBadge}>
              <Ionicons name="checkmark" size={20} color={colors.textOnPrimary} />
            </View>
          ) : null}
        </Animated.View>

        <Text variant="title" center style={styles.title}>
          {confirmed
            ? 'Presença confirmada!'
            : done
              ? 'Check-in realizado!'
              : 'Reserva confirmada!'}
        </Text>
        <Text variant="body" color={colors.textMuted} center>
          {confirmed
            ? `O professor confirmou que ${firstName} chegou 🎉`
            : done
              ? `Mostre o código para o professor confirmar.`
              : `Faça o check-in quando ${firstName} chegar no local.`}
        </Text>
      </View>

      <Card bordered elevation="none" style={styles.detailsCard}>
        <View style={styles.detailRow}>
          <View style={styles.detailIcon}>
            <Ionicons name="football-outline" size={18} color={colors.primary} />
          </View>
          <View style={styles.flex}>
            <Text variant="bodyStrong" numberOfLines={1}>
              {booking.activity.title}
            </Text>
            {/*
              O nome do local leva ao local. É aqui, na reserva já feita, que a
              pergunta "como eu chego lá?" acontece de verdade — antes de
              reservar ainda se está escolhendo, depois de reservar se está
              indo. Até agora este nome era texto morto.
            */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Ver ${booking.activity.partner.name}: endereço, telefone e mapa`}
              onPress={() => router.push(`/partner/${booking.activity.partner.id}`)}
              hitSlop={hitSlop}
              style={styles.localLink}
            >
              <Text variant="caption" color={colors.primary} numberOfLines={1}>
                {booking.activity.partner.name}
              </Text>
              <Ionicons name="chevron-forward" size={13} color={colors.primary} />
            </Pressable>
          </View>
        </View>
        <Text variant="label" color={colors.textMuted}>
          {formatSessionTime(booking.scheduledAt)}
        </Text>
      </Card>

      {done && ticket ? (
        <View style={styles.ticket}>
          <HintBubble
            visible={hint.visible}
            onDismiss={hint.dismiss}
            text="Mostre este código ao professor ou à recepção. É a leitura dele que confirma que o seu pequeno chegou."
          />
          <CheckInTicketCard ticket={ticket} />
        </View>
      ) : null}

      {confirmed ? (
        <Animated.View entering={FadeInDown.duration(420)}>
          <Card background={palette.tealSoft} elevation="none" style={styles.confirmedCard}>
            <Ionicons name="shield-checkmark" size={22} color={colors.success} />
            <View style={styles.flex}>
              <Text variant="bodyStrong" color={colors.text}>
                {booking.activity.partner.name} confirmou a presença.
              </Text>
              {reward ? (
                <Text variant="caption" color={colors.textMuted}>
                  +{reward.xpEarned} XP na jornada de {firstName}.
                </Text>
              ) : null}
            </View>
          </Card>
        </Animated.View>
      ) : null}

      {reward?.levelUp ? (
        <Card background={palette.yellowSoft} elevation="none" style={styles.levelUpCard}>
          <Text style={styles.levelUpEmoji}>🎖️</Text>
          <View style={styles.flex}>
            <Text variant="bodyStrong" color={colors.text}>
              Subiu para o nível {reward.levelUp.to}!
            </Text>
            <Text variant="caption" color={colors.textMuted}>
              {reward.levelUp.bonusEarned === 1
                ? 'Você ganhou 1 moeda bônus, válida por 30 dias.'
                : `Você ganhou ${reward.levelUp.bonusEarned} moedas bônus, válidas por 30 dias.`}
            </Text>
          </View>
        </Card>
      ) : null}

      {done ? null : (
        <ProximityCard
          proximity={proximity}
          window={window}
          partnerName={booking.activity.partner.name}
          busy={locationStatus === 'asking'}
          onEnable={() => void requestLocation()}
          onRefresh={() => void refreshLocation()}
        />
      )}

      {error ? (
        <Text variant="caption" color={colors.danger} center style={styles.error}>
          {error}
        </Text>
      ) : null}

      <View style={styles.actions}>
        {confirmed ? (
          <>
            {/* Confirmada a presença, sobram duas decisões — e "mais tarde" é
                uma delas de verdade: a aba Reservas guarda o pedido de
                avaliação, então adiar não perde nada. */}
            <Button
              title="Avaliar a aula"
              onPress={() =>
                router.push({ pathname: '/booking/[id]/review', params: { id: booking.id } })
              }
            />
            <Button
              title="Avaliar mais tarde"
              variant="secondary"
              onPress={() => router.replace('/(tabs)/bookings')}
            />
            {/* Só depois da confirmação: antes dela não há conquista, e um
                botão que não faz nada ao ser tocado é pior do que nenhum. */}
            {shareData ? (
              <Button
                title="Compartilhar conquista"
                variant="ghost"
                size="md"
                onPress={() => void handleShare()}
              />
            ) : null}
          </>
        ) : done ? (
          <>
            {/* Entrou, e o professor ainda não confirmou. O código é a única
                coisa que importa aqui — e ele vale 30 minutos, enquanto a
                janela de check-in vai até 90 depois da aula. Sem esta saída,
                quem chega cedo e espera fica com um código morto na mão. */}
            {ticketExpirado ? (
              <Button
                title="Gerar novo código"
                loading={checkIn.isPending}
                onPress={() => void handleCheckIn()}
              />
            ) : null}
            <Button
              title="Ver minhas reservas"
              variant="secondary"
              onPress={() => router.replace('/(tabs)/bookings')}
            />
            <Text variant="caption" color={colors.textFaint} center>
              A avaliação abre depois que o professor confirmar a presença.
            </Text>
          </>
        ) : (
          <>
            <Button
              title="Fazer check-in"
              loading={checkIn.isPending}
              disabled={!gate.allowed}
              onPress={() => void handleCheckIn()}
            />
            <Button
              title="Ver minhas reservas"
              variant="secondary"
              onPress={() => router.replace('/(tabs)/bookings')}
            />

            {cancellation?.allowed ? (
              <>
                <Button
                  title="Cancelar reserva"
                  variant="ghost"
                  size="md"
                  loading={cancelBooking.isPending}
                  onPress={() => void handleCancel()}
                />
                <Text variant="caption" color={colors.textFaint} center>
                  {formatDeadline(booking.scheduledAt)}.
                </Text>
              </>
            ) : cancellation && !cancellation.allowed ? (
              <Text variant="caption" color={colors.textFaint} center>
                {cancellationMessage(cancellation)}
              </Text>
            ) : null}
          </>
        )}
      </View>

      {shareData ? (
        // Renderizado fora da área visível: existe só para virar imagem.
        <View style={styles.offscreen} pointerEvents="none">
          <AchievementCard ref={cardRef} data={shareData} />
        </View>
      ) : null}

      {done && !confirmed ? (
        <Card background={palette.purpleTint} elevation="none" style={styles.mascotCard}>
          <Text style={styles.mascot}>👾</Text>
          <View style={styles.flex}>
            <Text variant="bodyStrong" color={colors.primary}>
              Falta só o professor confirmar
            </Text>
            <Text variant="caption" color={colors.textMuted}>
              Assim que ele ler o código, {result?.xpOnConfirm ?? 100} XP entram na jornada de{' '}
              {firstName}.
            </Text>
          </View>
        </Card>
      ) : null}
    </Screen>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    scroll: { paddingBottom: spacing.xxl },
    hero: { alignItems: 'center', gap: spacing.sm, marginTop: spacing.base },
    confettiRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.xs },
    confetti: { fontSize: 20 },
    avatarWrapper: { marginBottom: spacing.md },
    checkBadge: {
      position: 'absolute',
      right: -2,
      bottom: -2,
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.success,
      borderWidth: 4,
      borderColor: colors.background,
    },
    title: { marginTop: spacing.xs },
    detailsCard: { gap: spacing.md, marginTop: spacing.xxl },
    detailRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    detailIcon: {
      width: 38,
      height: 38,
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primaryTint,
    },
    error: { marginTop: spacing.md },
    actions: { gap: spacing.md, marginTop: spacing.xl },
    levelUpCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      marginTop: spacing.xl,
    },
    levelUpEmoji: { fontSize: 30 },
    ticket: { marginTop: spacing.xl, gap: spacing.base },
    offscreen: { position: 'absolute', left: -9999, top: 0 },
    confirmedCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      marginTop: spacing.base,
    },
    mascotCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      marginTop: spacing.xl,
    },
    mascot: { fontSize: 30 },
    flex: { flex: 1 },
    localLink: { flexDirection: 'row', alignItems: 'center', gap: spacing.xxs },
  });
