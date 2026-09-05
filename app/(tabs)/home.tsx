import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ActivityCard } from '@/features/activities';
import { Avatar, Button, Card, Chip, Input, ProgressBar, Screen, Text } from '@/components/ui';
import { useCategories, useChildren, useRecommended, useSubscription } from '@/hooks/queries';
import { useAuthStore } from '@/stores/auth-store';
import { useOnboardingStore } from '@/stores/onboarding-store';
import { radius, spacing, useStyles, useTheme, type ThemeColors } from '@/theme';
import { daysUntilReset } from '@/lib/subscription';
import { formatDaysUntil } from '@/lib/format';
import type { Activity } from '@/types/domain';

const XP_PER_LEVEL = 1000;

/** Tela 5 — Home. */
export default function HomeScreen() {
  const { colors, palette } = useTheme();
  const styles = useStyles(makeStyles);
  const router = useRouter();
  const guardian = useAuthStore((state) => state.session?.guardian ?? null);
  const activeChildId = useOnboardingStore((state) => state.activeChildId);

  const { data: children = [] } = useChildren();
  const { data: categories = [] } = useCategories();
  const { data: subscription } = useSubscription();

  const activeChild = useMemo(
    () => children.find((child) => child.id === activeChildId) ?? children[0] ?? null,
    [activeChildId, children],
  );

  const { data: recommended = [], isPending } = useRecommended(activeChild?.id ?? null);

  const firstName = guardian?.name.split(' ')[0];
  const childName = activeChild?.name.split(' ')[0];
  const authenticated = useAuthStore((state) => state.status === 'authenticated');

  return (
    <Screen scroll padded={false} edges={['top']} contentContainerStyle={styles.scroll}>
      <View style={styles.header}>
        <View style={styles.greeting}>
          <Text variant="heading" numberOfLines={1}>
            {firstName ? `Olá, ${firstName}! 👋` : 'Olá! 👋'}
          </Text>
          <Text variant="body" color={colors.textMuted} numberOfLines={1}>
            {childName
              ? `Como vamos movimentar o ${childName} hoje?`
              : 'Vamos encontrar a atividade certa?'}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Abrir perfil"
          onPress={() => router.push('/(tabs)/profile')}
        >
          <Avatar name={guardian?.name ?? 'Kidoo'} size={44} ring />
        </Pressable>
      </View>

      <View style={styles.filters}>
        {activeChild ? (
          <Chip
            label={`${childName} • ${activeChild.level > 0 ? `nível ${activeChild.level}` : ''}`.trim()}
            left={<Avatar name={activeChild.name} uri={activeChild.photoUri} size={22} />}
            right={<Ionicons name="chevron-down" size={14} color={colors.textFaint} />}
            tone="muted"
          />
        ) : null}
        <Chip
          label={guardian?.city ?? 'Belo Horizonte'}
          left={<Ionicons name="location-outline" size={14} color={colors.primary} />}
          right={<Ionicons name="chevron-down" size={14} color={colors.textFaint} />}
          tone="muted"
        />
      </View>

      <View style={styles.searchWrapper}>
        <Input
          icon="search-outline"
          placeholder="Buscar atividades..."
          onPressField={() => router.push('/(tabs)/explore')}
          value=""
        />
      </View>

      {activeChild ? null : (
        <Card style={styles.setupCard} background={palette.purpleTint} elevation="none">
          <Text style={styles.setupEmoji}>{authenticated ? '🧒' : '✨'}</Text>
          <View style={styles.flex}>
            <Text variant="bodyStrong">
              {authenticated ? 'Cadastre o seu pequeno' : 'Crie sua conta para reservar'}
            </Text>
            <Text variant="caption" color={colors.textMuted}>
              {authenticated
                ? 'Assim as recomendações ficam na idade certa e você já pode reservar.'
                : 'Você pode explorar à vontade. Para reservar uma aula, é rapidinho criar a conta.'}
            </Text>
          </View>
          <Button
            title={authenticated ? 'Cadastrar' : 'Criar conta'}
            size="sm"
            fullWidth={false}
            onPress={() => router.push(authenticated ? '/(onboarding)/child' : '/(auth)/sign-up')}
          />
        </Card>
      )}

      <SectionHeader
        title={childName ? `Recomendados para ${childName}` : 'Recomendados para você'}
        actionLabel="Ver todos"
        onAction={() => router.push('/(tabs)/explore')}
      />

      {isPending ? (
        <Text variant="caption" color={colors.textFaint} style={styles.sidePadding}>
          Buscando as melhores atividades…
        </Text>
      ) : (
        <FlatList
          horizontal
          data={recommended}
          keyExtractor={keyExtractor}
          renderItem={({ item }) => (
            <ActivityCard
              activity={item}
              onPress={() => router.push({ pathname: '/activity/[id]', params: { id: item.id } })}
            />
          )}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.carousel}
          ItemSeparatorComponent={CarouselSeparator}
          // Carrossel curto: janela pequena mantém memória baixa sem “buraco” visual.
          initialNumToRender={3}
          maxToRenderPerBatch={3}
          windowSize={5}
          removeClippedSubviews
        />
      )}

      <SectionHeader title="Explore por modalidade" />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categories}
      >
        {categories.slice(0, 6).map((category) => (
          <Pressable
            key={category.id}
            accessibilityRole="button"
            accessibilityLabel={category.label}
            onPress={() =>
              router.push({ pathname: '/(tabs)/explore', params: { category: category.id } })
            }
            style={({ pressed }) => [styles.categoryTile, pressed && styles.pressed]}
          >
            <Text style={styles.categoryEmoji}>{category.emoji}</Text>
            <Text variant="caption" color={colors.text}>
              {category.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {activeChild ? (
        <>
          <SectionHeader
            title="Minha jornada"
            actionLabel="Ver jornada"
            onAction={() => router.push('/(tabs)/journey')}
          />
          <Card style={styles.journeyCard} background={palette.purpleTint} elevation="none">
            <Avatar name={activeChild.name} uri={activeChild.photoUri} size={52} ring />
            <View style={styles.journeyInfo}>
              <Text variant="bodyStrong">{activeChild.xp} XP</Text>
              <Text variant="caption" color={colors.textMuted}>
                {activeChild.achievements} conquistas • nível {activeChild.level}
              </Text>
              <ProgressBar
                value={activeChild.xp % XP_PER_LEVEL}
                max={XP_PER_LEVEL}
                label="Progresso para o próximo nível"
              />
            </View>
          </Card>
        </>
      ) : null}

      {subscription ? (
        <Card style={styles.coinsCard} background={palette.yellowSoft} elevation="none">
          <Text style={styles.coinEmoji}>🪙</Text>
          <View style={styles.flex}>
            <Text variant="label" color={colors.text}>
              {subscription.coinsRemaining} de {subscription.coinsPerWeek} coins nesta semana
            </Text>
            <Text variant="caption" color={colors.textMuted}>
              A cota volta ao cheio {formatDaysUntil(daysUntilReset(subscription))}.
            </Text>
            <ProgressBar
              value={subscription.coinsRemaining}
              max={subscription.coinsPerWeek}
              color={colors.accentYellow}
              height={6}
              label="Coins restantes na semana"
            />
          </View>
        </Card>
      ) : null}
    </Screen>
  );
}

function SectionHeader({
  title,
  actionLabel,
  onAction,
}: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.sectionHeader}>
      <Text variant="subheading" numberOfLines={1} style={styles.flex}>
        {title}
      </Text>
      {actionLabel && onAction ? (
        <Pressable accessibilityRole="button" onPress={onAction}>
          <Text variant="label" color={colors.primary}>
            {actionLabel}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const keyExtractor = (activity: Activity) => activity.id;
const CarouselSeparator = () => <View style={{ width: spacing.md }} />;

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    scroll: { paddingBottom: spacing.xxl },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.base,
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.md,
    },
    greeting: { flex: 1, gap: spacing.xxs },
    filters: {
      flexDirection: 'row',
      gap: spacing.sm,
      paddingHorizontal: spacing.xl,
      marginTop: spacing.base,
    },
    searchWrapper: { paddingHorizontal: spacing.xl, marginTop: spacing.base },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingHorizontal: spacing.xl,
      marginTop: spacing.xl,
      marginBottom: spacing.md,
    },
    sidePadding: { paddingHorizontal: spacing.xl },
    carousel: { paddingHorizontal: spacing.xl },
    categories: { paddingHorizontal: spacing.xl, gap: spacing.md },
    categoryTile: {
      width: 76,
      height: 76,
      borderRadius: radius.lg,
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      backgroundColor: colors.backgroundMuted,
    },
    categoryEmoji: { fontSize: 24, lineHeight: 30 },
    pressed: { opacity: 0.7 },
    setupCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      marginHorizontal: spacing.xl,
      marginTop: spacing.lg,
    },
    setupEmoji: { fontSize: 26 },
    journeyCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.base,
      marginHorizontal: spacing.xl,
    },
    journeyInfo: { flex: 1, gap: spacing.xs },
    coinsCard: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.md,
      marginHorizontal: spacing.xl,
      marginTop: spacing.base,
    },
    coinEmoji: { fontSize: 20 },
    flex: { flex: 1 },
  });
