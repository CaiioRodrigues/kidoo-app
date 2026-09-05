import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Share, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, ZoomIn } from 'react-native-reanimated';

import { HeaderBar } from '@/components/navigation';
import { Avatar, Button, Card, Screen, Text } from '@/components/ui';
import { CheckInTicketCard } from '@/features/check-in';
import { formatSessionTime } from '@/lib/format';
import { logger } from '@/lib/logger';
import { toUserMessage } from '@/services';
import { useBooking, useCheckIn, useConfirmByPartner } from '@/hooks/queries';
import { radius, spacing, useStyles, useTheme, type ThemeColors } from '@/theme';

const CONFETTI = ['🎉', '⭐', '🎈', '✨', '🎊', '💜'];

/** Tela 9 — Check-in realizado. */
export default function CheckInScreen() {
  const { colors, palette } = useTheme();
  const styles = useStyles(makeStyles);
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: booking, isPending } = useBooking(id ?? '');
  const checkIn = useCheckIn();
  const [error, setError] = useState<string | null>(null);

  const result = checkIn.data ?? null;
  const confirmPartner = useConfirmByPartner();
  const done = booking?.status === 'checked_in' || booking?.status === 'completed';
  const confirmed = booking?.status === 'completed' && booking.partnerConfirmedAt !== null;
  const ticket = result?.ticket ?? booking?.checkIn ?? null;
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

  const handleShare = useCallback(async () => {
    if (!booking) return;
    try {
      // Compartilha só o nome da atividade — nada que identifique a criança.
      await Share.share({
        message: `${firstName} participou de ${booking.activity.title} no Kidoo! 🎉`,
      });
    } catch (caught) {
      logger.warn('Compartilhamento cancelado ou indisponível', caught);
    }
  }, [booking, firstName]);

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
          {done ? 'Check-in realizado!' : 'Reserva confirmada!'}
        </Text>
        <Text variant="body" color={colors.textMuted} center>
          {done
            ? `${firstName} começou a atividade 🎉`
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
            <Text variant="caption" color={colors.textMuted} numberOfLines={1}>
              {booking.activity.partner.name}
            </Text>
          </View>
        </View>
        <Text variant="label" color={colors.textMuted}>
          {formatSessionTime(booking.scheduledAt)}
        </Text>
      </Card>

      {done && ticket ? (
        <View style={styles.ticket}>
          <CheckInTicketCard ticket={ticket} />
        </View>
      ) : null}

      {confirmed ? (
        <Card background={palette.tealSoft} elevation="none" style={styles.confirmedCard}>
          <Ionicons name="shield-checkmark" size={20} color={colors.success} />
          <Text variant="label" color={colors.text} style={styles.flex}>
            Presença confirmada pelo parceiro.
          </Text>
        </Card>
      ) : null}

      {error ? (
        <Text variant="caption" color={colors.danger} center style={styles.error}>
          {error}
        </Text>
      ) : null}

      <View style={styles.actions}>
        {done ? (
          <>
            <Button
              title="Ver detalhes"
              onPress={() =>
                router.push({
                  pathname: '/activity/[id]',
                  params: { id: booking.activity.id },
                })
              }
            />
            <Button
              title="Avaliar o estabelecimento"
              variant="secondary"
              onPress={() =>
                router.push({ pathname: '/booking/[id]/review', params: { id: booking.id } })
              }
            />
            <Button
              title="Compartilhar conquista"
              variant="ghost"
              size="md"
              onPress={() => void handleShare()}
            />

            {__DEV__ && ticket && !confirmed ? (
              // Só em desenvolvimento: sem o app do parceiro, é assim que dá
              // para exercitar a confirmação de ponta a ponta.
              <Button
                title="Simular leitura do parceiro"
                variant="ghost"
                size="sm"
                onPress={() =>
                  void confirmPartner.mutateAsync({
                    bookingId: booking.id,
                    code: ticket.code,
                  })
                }
              />
            ) : null}
          </>
        ) : (
          <>
            <Button
              title="Fazer check-in"
              loading={checkIn.isPending}
              onPress={() => void handleCheckIn()}
            />
            <Button
              title="Ver minhas reservas"
              variant="secondary"
              onPress={() => router.replace('/(tabs)/bookings')}
            />
          </>
        )}
      </View>

      {done && result?.levelUp ? (
        <Card background={palette.yellowSoft} elevation="none" style={styles.levelUpCard}>
          <Text style={styles.levelUpEmoji}>🎖️</Text>
          <View style={styles.flex}>
            <Text variant="bodyStrong" color={colors.text}>
              Subiu para o nível {result.levelUp.to}!
            </Text>
            <Text variant="caption" color={colors.textMuted}>
              {result.levelUp.bonusEarned === 1
                ? 'Você ganhou 1 moeda bônus, válida por 30 dias.'
                : `Você ganhou ${result.levelUp.bonusEarned} moedas bônus, válidas por 30 dias.`}
            </Text>
          </View>
        </Card>
      ) : null}

      {done ? (
        <Card background={palette.purpleTint} elevation="none" style={styles.mascotCard}>
          <Text style={styles.mascot}>👾</Text>
          <View style={styles.flex}>
            <Text variant="bodyStrong" color={colors.primary}>
              Boa aula, {firstName}!
            </Text>
            <Text variant="caption" color={colors.textMuted}>
              {result ? `Você ganhou ${result.xpEarned} XP.` : 'XP creditado.'} Continue assim!
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
    ticket: { marginTop: spacing.xl },
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
  });
