import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import { Badge, ComingSoon, Divider, Screen, Text } from '@/components/ui';
import { formatSessionTime } from '@/lib/format';
import { useBookings } from '@/hooks/queries';
import { radius, spacing, useStyles, useTheme, type ThemeColors } from '@/theme';
import type { BookingDetails, BookingStatus } from '@/types/domain';

const BLURHASH = 'L5H2EC=PM+yV0g-mq.wG9c010J}I';

const STATUS: Record<BookingStatus, { label: string; tone: 'brand' | 'success' | 'neutral' }> = {
  confirmed: { label: 'Confirmada', tone: 'brand' },
  checked_in: { label: 'Check-in feito', tone: 'success' },
  completed: { label: 'Concluída', tone: 'neutral' },
  cancelled: { label: 'Cancelada', tone: 'neutral' },
};

/** Tela 8 (lista) — Reservas do responsável. */
export default function BookingsScreen() {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const router = useRouter();
  const { data: bookings = [], isPending, refetch, isRefetching } = useBookings();

  if (!isPending && bookings.length === 0) {
    return (
      <Screen>
        <ComingSoon
          icon="calendar-outline"
          title="Nenhuma reserva ainda"
          description="Quando você reservar uma atividade, ela aparece aqui com o check-in do dia e o histórico das aulas."
        />
      </Screen>
    );
  }

  return (
    <Screen padded={false} edges={['top']}>
      <Text variant="title" style={styles.pageTitle}>
        Reservas
      </Text>

      <FlatList
        data={bookings}
        keyExtractor={keyExtractor}
        renderItem={({ item }) => (
          <BookingRow
            booking={item}
            onPress={() =>
              router.push({ pathname: '/booking/[id]/check-in', params: { id: item.id } })
            }
          />
        )}
        ItemSeparatorComponent={Divider}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        onRefresh={() => void refetch()}
        refreshing={isRefetching}
        initialNumToRender={6}
        maxToRenderPerBatch={8}
        windowSize={9}
        removeClippedSubviews
        ListEmptyComponent={
          <Text variant="body" color={colors.textFaint} center style={styles.empty}>
            Carregando reservas…
          </Text>
        }
      />
    </Screen>
  );
}

function BookingRow({ booking, onPress }: { booking: BookingDetails; onPress: () => void }) {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const status = STATUS[booking.status];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${booking.activity.title}, ${status.label}`}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <Image
        source={{ uri: booking.activity.imageUrl }}
        style={styles.thumb}
        contentFit="cover"
        placeholder={{ blurhash: BLURHASH }}
        transition={160}
        cachePolicy="memory-disk"
        recyclingKey={booking.id}
        accessibilityIgnoresInvertColors
      />

      <View style={styles.info}>
        <Text variant="bodyStrong" numberOfLines={1}>
          {booking.activity.title}
        </Text>
        <Text variant="caption" color={colors.textMuted} numberOfLines={1}>
          {booking.child.name.split(' ')[0]} • {booking.activity.partner.name}
        </Text>
        <Text variant="caption" color={colors.textFaint}>
          {formatSessionTime(booking.scheduledAt)}
        </Text>
        <Badge label={status.label} tone={status.tone} />
      </View>

      <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
    </Pressable>
  );
}

const keyExtractor = (booking: BookingDetails) => booking.id;

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    pageTitle: { paddingHorizontal: spacing.xl, marginTop: spacing.md, marginBottom: spacing.sm },
    list: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.md,
    },
    pressed: { opacity: 0.7 },
    thumb: {
      width: 74,
      height: 74,
      borderRadius: radius.lg,
      backgroundColor: colors.backgroundMuted,
    },
    info: { flex: 1, gap: spacing.xxs },
    empty: { marginTop: spacing.xxxl },
  });
