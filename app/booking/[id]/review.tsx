import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native';

import { HeaderBar } from '@/components/navigation';
import { Button, Card, Input, Screen, Text } from '@/components/ui';
import { useBooking, useSubmitReview } from '@/hooks/queries';
import { toUserMessage } from '@/services';
import { minTouchTarget, spacing, useStyles, useTheme, type ThemeColors } from '@/theme';

const LABELS: Record<number, string> = {
  1: 'Não gostamos',
  2: 'Poderia ser melhor',
  3: 'Foi ok',
  4: 'Gostamos bastante',
  5: 'Foi ótimo!',
};

const MAX_COMMENT = 500;

/** Avaliação do estabelecimento, depois da aula. */
export default function ReviewScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const { id } = useLocalSearchParams<{ id: string }>();

  const { data: booking, isPending } = useBooking(id ?? '');
  const submit = useSubmitReview();

  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(async () => {
    if (!booking || rating === 0) return;
    setError(null);
    try {
      await submit.mutateAsync({ bookingId: booking.id, rating, comment });
      router.back();
    } catch (caught) {
      setError(toUserMessage(caught));
    }
  }, [booking, comment, rating, router, submit]);

  if (isPending || !booking) {
    return (
      <Screen>
        <HeaderBar />
        <Text variant="body" color={colors.textFaint}>
          Carregando…
        </Text>
      </Screen>
    );
  }

  const alreadyReviewed = booking.reviewId !== null;

  return (
    <Screen scroll contentContainerStyle={styles.scroll}>
      <HeaderBar />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Text variant="title" center style={styles.title}>
          Como foi a aula?
        </Text>
        <Text variant="body" color={colors.textMuted} center>
          Sua avaliação ajuda outras famílias a escolherem.
        </Text>

        <Card bordered elevation="none" style={styles.activityCard}>
          <Text variant="bodyStrong" numberOfLines={1}>
            {booking.activity.title}
          </Text>
          <Text variant="caption" color={colors.textMuted} numberOfLines={1}>
            {booking.activity.partner.name} • {booking.activity.partner.neighborhood}
          </Text>
        </Card>

        {alreadyReviewed ? (
          <Card bordered elevation="none" style={styles.doneCard}>
            <Ionicons name="checkmark-circle" size={22} color={colors.success} />
            <Text variant="label" color={colors.textMuted} style={styles.flex}>
              Você já avaliou esta aula. Obrigado!
            </Text>
          </Card>
        ) : (
          <>
            <View style={styles.stars} accessibilityRole="radiogroup">
              {[1, 2, 3, 4, 5].map((value) => (
                <Pressable
                  key={value}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: rating === value }}
                  accessibilityLabel={`${value} ${value === 1 ? 'estrela' : 'estrelas'}`}
                  hitSlop={6}
                  onPress={() => setRating(value)}
                  style={styles.star}
                >
                  <Ionicons
                    name={value <= rating ? 'star' : 'star-outline'}
                    size={40}
                    color={value <= rating ? colors.accentYellow : colors.textFaint}
                  />
                </Pressable>
              ))}
            </View>

            <Text variant="label" color={colors.textMuted} center style={styles.ratingLabel}>
              {rating === 0 ? 'Toque nas estrelas para dar sua nota' : LABELS[rating]}
            </Text>

            <Input
              label="Comentário (opcional)"
              placeholder="Conte como foi a experiência do seu pequeno…"
              value={comment}
              onChangeText={(text) => setComment(text.slice(0, MAX_COMMENT))}
              multiline
              numberOfLines={4}
              hint={`${comment.length}/${MAX_COMMENT} · seu comentário aparece com o seu primeiro nome`}
              containerStyle={styles.commentField}
            />

            {error ? (
              <Text variant="caption" color={colors.danger} center>
                {error}
              </Text>
            ) : null}

            <Button
              title="Enviar avaliação"
              loading={submit.isPending}
              disabled={rating === 0}
              onPress={() => void handleSubmit()}
              style={styles.cta}
            />
          </>
        )}
      </KeyboardAvoidingView>
    </Screen>
  );
}

const makeStyles = (_colors: ThemeColors) =>
  StyleSheet.create({
    scroll: { paddingBottom: spacing.xxl },
    title: { marginTop: spacing.base },
    activityCard: { gap: spacing.xxs, marginTop: spacing.xl },
    doneCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      marginTop: spacing.xl,
    },
    stars: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: spacing.sm,
      marginTop: spacing.xxl,
    },
    star: {
      minWidth: minTouchTarget,
      minHeight: minTouchTarget,
      alignItems: 'center',
      justifyContent: 'center',
    },
    ratingLabel: { marginTop: spacing.sm, minHeight: 20 },
    commentField: { marginTop: spacing.xl },
    cta: { marginTop: spacing.xl },
    flex: { flex: 1 },
  });
