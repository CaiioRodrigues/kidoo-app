import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { CategoryIcon } from '@/components/CategoryIcon';
import { HeaderBar } from '@/components/navigation';
import { Badge, Button, Card, CoinBadge, Divider, Screen, Text } from '@/components/ui';
import { RatingSummaryCard, ReviewCard, StarRating } from '@/features/reviews';
import { formatPlace, formatSessionTime } from '@/lib/format';
import { useActivity, useReviews } from '@/hooks/queries';
import { categoryTone, radius, spacing, useStyles, useTheme, type ThemeColors } from '@/theme';

const BLURHASH = 'L5H2EC=PM+yV0g-mq.wG9c010J}I';

/** Tela 7 — Detalhes da atividade (reserva chega na próxima fase). */
export default function ActivityDetailScreen() {
  const { colors, isDark } = useTheme();
  const styles = useStyles(makeStyles);
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: activity, isPending, isError } = useActivity(id ?? '');
  const { data: reviewData, isPending: reviewsPending } = useReviews(id ?? '');
  const [tab, setTab] = useState<'sobre' | 'avaliacoes'>('sobre');

  if (isPending) {
    return (
      <Screen>
        <HeaderBar />
        <Text variant="body" color={colors.textFaint}>
          Carregando atividade…
        </Text>
      </Screen>
    );
  }

  if (isError || !activity) {
    return (
      <Screen>
        <HeaderBar />
        <Text variant="body" color={colors.textMuted}>
          Não encontramos esta atividade. Ela pode ter saído do ar.
        </Text>
      </Screen>
    );
  }

  const tone = categoryTone(activity.category, isDark);

  return (
    <Screen scroll padded={false} edges={['top', 'bottom']} contentContainerStyle={styles.scroll}>
      <View style={styles.headerOverlay}>
        <HeaderBar />
      </View>

      <Image
        source={{ uri: activity.imageUrl }}
        style={styles.hero}
        contentFit="cover"
        placeholder={{ blurhash: BLURHASH }}
        transition={200}
        cachePolicy="memory-disk"
        accessibilityIgnoresInvertColors
      />

      <View style={styles.content}>
        {/* Medalhão da modalidade a cavalo na emenda entre a foto e a ficha:
            é o que diz "isto é natação" antes de qualquer texto ser lido. */}
        <View style={[styles.medallion, { backgroundColor: tone.soft }]}>
          <CategoryIcon category={activity.category} size={34} />
        </View>

        {activity.partner.verified ? (
          <Badge
            label="Parceiro verificado"
            tone="success"
            left={<Ionicons name="shield-checkmark" size={13} color={colors.success} />}
          />
        ) : null}

        <Text variant="title">{activity.title}</Text>

        <View style={styles.metaRow}>
          <StarRating rating={activity.rating} size={15} />
          <Text variant="label" color={colors.textMuted}>
            {activity.rating.toFixed(1).replace('.', ',')} ({activity.reviewCount} avaliações)
          </Text>
        </View>

        <View style={styles.metaRow}>
          <Ionicons name="business-outline" size={15} color={colors.textFaint} />
          <Text variant="label" color={colors.textMuted} style={styles.flex}>
            {activity.partner.name}
          </Text>
        </View>

        <View style={styles.metaRow}>
          <Ionicons name="location-outline" size={15} color={colors.textFaint} />
          <Text variant="label" color={colors.textMuted} style={styles.flex}>
            {formatPlace(
              `${activity.partner.neighborhood}, ${activity.partner.city}`,
              activity.distanceKm,
            )}
          </Text>
        </View>

        <View style={styles.tags}>
          <Badge label={`${activity.minAge}-${activity.maxAge} anos`} tone="brand" />
          {activity.tags.map((tag) => (
            <Badge key={tag} label={tag} tone="neutral" />
          ))}
        </View>

        <View style={styles.tabs}>
          {(['sobre', 'avaliacoes'] as const).map((value) => (
            <Pressable
              key={value}
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === value }}
              onPress={() => setTab(value)}
              style={[styles.tab, tab === value && { borderBottomColor: tone.solid }]}
            >
              <Text variant="label" color={tab === value ? tone.solid : colors.textMuted}>
                {value === 'sobre' ? 'Sobre' : 'Avaliações'}
              </Text>
            </Pressable>
          ))}
        </View>

        {tab === 'sobre' ? (
          <>
            <Text variant="body" color={colors.textMuted} style={styles.description}>
              {activity.description}
            </Text>

            <Card bordered elevation="none" style={styles.sessionCard}>
              <Ionicons name="time-outline" size={18} color={colors.primary} />
              <Text variant="label" color={colors.text} style={styles.flex}>
                Próxima turma: {formatSessionTime(activity.nextSessionAt)}
              </Text>
            </Card>
          </>
        ) : (
          <View style={styles.reviews}>
            {reviewsPending ? (
              <Text variant="caption" color={colors.textFaint}>
                Carregando avaliações…
              </Text>
            ) : reviewData ? (
              <>
                <RatingSummaryCard summary={reviewData.summary} />
                {reviewData.reviews.length === 0 ? (
                  <Text variant="caption" color={colors.textFaint}>
                    Esta atividade ainda não tem comentários.
                  </Text>
                ) : (
                  reviewData.reviews.map((review, index) => (
                    <View key={review.id}>
                      {index > 0 ? <Divider /> : null}
                      <ReviewCard review={review} />
                    </View>
                  ))
                )}
              </>
            ) : null}
          </View>
        )}

        <View style={styles.footer}>
          <CoinBadge amount={activity.coinCost} />
          <Button
            title="Reservar"
            fullWidth={false}
            size="md"
            onPress={() =>
              router.push({
                pathname: '/booking/confirm',
                params: { activityId: activity.id },
              })
            }
            style={styles.reserve}
          />
        </View>
      </View>
    </Screen>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    scroll: { paddingBottom: spacing.xxl },
    headerOverlay: {
      position: 'absolute',
      top: 0,
      left: spacing.base,
      right: spacing.base,
      zIndex: 2,
    },
    hero: { width: '100%', height: 260, backgroundColor: colors.backgroundMuted },
    content: {
      marginTop: -spacing.xl,
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.xl,
      gap: spacing.sm,
      backgroundColor: colors.background,
      // Cantos desiguais: a ficha "desliza" por baixo da foto em vez de
      // encaixar num retângulo simétrico.
      borderTopLeftRadius: 44,
      borderTopRightRadius: radius.lg,
    },
    medallion: {
      position: 'absolute',
      top: -30,
      right: spacing.xl,
      width: 60,
      height: 60,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 30,
      borderBottomRightRadius: 12,
      borderWidth: 3,
      borderColor: colors.background,
    },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
    description: { marginTop: spacing.sm },
    tabs: {
      flexDirection: 'row',
      gap: spacing.xl,
      marginTop: spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    tab: { paddingBottom: spacing.md, borderBottomWidth: 2, borderBottomColor: 'transparent' },
    reviews: { marginTop: spacing.lg, gap: spacing.md },
    sessionCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      marginTop: spacing.base,
    },
    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.base,
      marginTop: spacing.xl,
    },
    reserve: { paddingHorizontal: spacing.xxl },
    flex: { flex: 1 },
  });
