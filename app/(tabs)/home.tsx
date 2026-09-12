import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ActivityCard } from '@/features/activities';
import { BlobBackdrop, Guara } from '@/components/brand';
import { CategoryIcon } from '@/components/CategoryIcon';
import { TutorialOverlay, useTutorial } from '@/features/tutorial';
import {
  Avatar,
  Button,
  Card,
  Chip,
  CoinIcon,
  Input,
  ProgressBar,
  Screen,
  Text,
} from '@/components/ui';
import {
  useActivities,
  useCategories,
  useChildren,
  useRecommended,
  useSimularPagamento,
  useSubscription,
} from '@/hooks/queries';
import { useAuthStore } from '@/stores/auth-store';
import { useOnboardingStore } from '@/stores/onboarding-store';
import { blobRadius, categoryTone, spacing, useStyles, useTheme, type ThemeColors } from '@/theme';
import { EstadoDaAssinatura } from '@/features/subscription';
import { daysUntilReset } from '@/lib/subscription';
import { formatDaysUntil } from '@/lib/format';
import { comArtigo } from '@/lib/genero';
import type { Activity } from '@/types/domain';

const XP_PER_LEVEL = 1000;

/** Tela 5 — Home. */
export default function HomeScreen() {
  const { colors, palette, isDark } = useTheme();
  const styles = useStyles(makeStyles);
  const router = useRouter();
  const guardian = useAuthStore((state) => state.session?.guardian ?? null);
  const activeChildId = useOnboardingStore((state) => state.activeChildId);

  const { data: children = [] } = useChildren();
  const { data: categories = [] } = useCategories();
  const { data: subscription } = useSubscription();
  const simular = useSimularPagamento();

  const activeChild = useMemo(
    () => children.find((child) => child.id === activeChildId) ?? children[0] ?? null,
    [activeChildId, children],
  );

  // Sem criança ativa não há o que recomendar — e a query fica desabilitada,
  // com `isPending` preso em true. O visitante veria a seção vazia para sempre,
  // então nesse caso a vitrine mostra o catálogo.
  const { data: recommended = [], isLoading: loadingRecommended } = useRecommended(
    activeChild?.id ?? null,
  );
  const { data: catalog = [], isLoading: loadingCatalog } = useActivities(undefined, {
    enabled: !activeChild,
  });
  const highlights = activeChild ? recommended : catalog.slice(0, 6);
  const loadingHighlights = activeChild ? loadingRecommended : loadingCatalog;

  const firstName = guardian?.name.split(' ')[0];
  const childName = activeChild?.name.split(' ')[0];
  const authenticated = useAuthStore((state) => state.status === 'authenticated');
  // Só depois da vitrine carregar: ver o tutorial por cima de esqueletos
  // cinzentos é a pior primeira impressão que o app pode dar.
  const tutorial = useTutorial(!loadingHighlights);

  return (
    <Screen scroll padded={false} edges={['top']} contentContainerStyle={styles.scroll}>
      <BlobBackdrop height={200} />

      <View style={styles.header}>
        <View style={styles.greeting}>
          <Text variant="display" numberOfLines={1} style={styles.hello}>
            {firstName ? `Olá, ${firstName}!` : 'Olá!'}
          </Text>
          {/* Duas linhas: a frase carrega o nome da criança, e num aparelho de
              390px ela já era cortada em "movimentar a Alice h…" com uma só.
              Nome curto continua cabendo numa linha — o limite só entra em
              ação quando faz falta. */}
          <Text variant="body" color={colors.textMuted} numberOfLines={2}>
            {activeChild && childName
              ? `Como vamos movimentar ${comArtigo(childName, activeChild.gender)} hoje?`
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

      {/*
        No alto, acima das recomendações, e não junto do cartão de coins lá
        embaixo — que foi onde ficou na primeira versão, abaixo da dobra.

        Quem não pode reservar precisa saber ANTES de escolher a turma. Ao pé da
        página, a família rola pelos cartões, escolhe um horário, tenta, e leva
        a recusa como defeito — que é exatamente a experiência que este aviso
        existe para não acontecer.
      */}
      {subscription ? (
        <EstadoDaAssinatura
          subscription={subscription}
          style={styles.assinatura}
          aoSimular={() => simular.mutate()}
          simulando={simular.isPending}
        />
      ) : null}

      {activeChild ? null : (
        <Card style={styles.setupCard} background={palette.purpleTint} elevation="none">
          {/* Texto e botão empilhados: lado a lado, a descrição sobrava numa
              coluna de duas palavras por linha. */}
          <View style={styles.setupRow}>
            <Guara size={54} />
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
          </View>
          <Button
            title={authenticated ? 'Cadastrar criança' : 'Criar conta'}
            size="sm"
            onPress={() => router.push(authenticated ? '/(onboarding)/child' : '/(auth)/sign-up')}
          />
        </Card>
      )}

      <SectionHeader
        title={childName ? `Recomendados para ${childName}` : 'Recomendados para você'}
        actionLabel="Ver todos"
        onAction={() => router.push('/(tabs)/explore')}
      />

      {loadingHighlights ? (
        <Text variant="caption" color={colors.textFaint} style={styles.sidePadding}>
          Buscando as melhores atividades…
        </Text>
      ) : (
        <FlatList
          horizontal
          data={highlights}
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
            style={({ pressed }) => [
              styles.categoryTile,
              { backgroundColor: categoryTone(category.id, isDark).soft },
              pressed && styles.pressed,
            ]}
          >
            <CategoryIcon category={category.id} size={30} />
            <Text variant="caption" color={categoryTone(category.id, isDark).solid}>
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

      {subscription && subscription.status === 'ativa' ? (
        <Card style={styles.coinsCard} background={palette.yellowSoft} elevation="none">
          <CoinIcon size={22} />
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
      <TutorialOverlay visible={tutorial.visible} onFinish={tutorial.dismiss} />
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
    hello: { letterSpacing: -1 },
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
      width: 82,
      height: 82,
      ...blobRadius.tile,
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      backgroundColor: colors.backgroundMuted,
    },
    categoryEmoji: { fontSize: 24, lineHeight: 30 },
    pressed: { opacity: 0.7 },
    assinatura: { marginHorizontal: spacing.xl, marginTop: spacing.base },
    setupCard: {
      ...blobRadius.cardAlt,
      gap: spacing.md,
      marginHorizontal: spacing.xl,
      marginTop: spacing.lg,
    },
    setupRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    journeyCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.base,
      marginHorizontal: spacing.xl,
      ...blobRadius.card,
    },
    journeyInfo: { flex: 1, gap: spacing.xs },
    coinsCard: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.md,
      marginHorizontal: spacing.xl,
      marginTop: spacing.base,
    },
    flex: { flex: 1 },
  });
