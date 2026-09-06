import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useDeferredValue, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { ActivityListItem } from '@/features/activities';
import { BlobBackdrop } from '@/components/brand';
import { Chip, Divider, Input, Screen, Text } from '@/components/ui';
import { CategoryIcon } from '@/components/CategoryIcon';
import { useActivities, useCategories } from '@/hooks/queries';
import { useLocationStore } from '@/stores/location-store';
import { RADIUS_OPTIONS_KM, type RadiusKm } from '@/lib/geo';
import { categoryTone, spacing, useTheme } from '@/theme';
import type { Activity, ActivityCategoryId } from '@/types/domain';

/** Tela 6 — Explorar atividades. */
export default function ExploreScreen() {
  const { colors, isDark } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ category?: string }>();

  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<ActivityCategoryId | 'all'>(
    (params.category as ActivityCategoryId | undefined) ?? 'all',
  );

  const locationStatus = useLocationStore((state) => state.status);
  const coords = useLocationStore((state) => state.proof?.origin ?? null);
  const nearbyOnly = useLocationStore((state) => state.nearbyOnly);
  const radiusKm = useLocationStore((state) => state.radiusKm);
  const setNearbyOnly = useLocationStore((state) => state.setNearbyOnly);
  const setRadiusKm = useLocationStore((state) => state.setRadiusKm);
  const requestLocation = useLocationStore((state) => state.request);

  const nearbyActive = nearbyOnly && coords !== null;
  const locating = locationStatus === 'asking';

  // O prompt do sistema só aparece a partir daqui — de um toque, com o rótulo
  // "Perto de mim" na tela dizendo para quê.
  const toggleNearby = useCallback(() => {
    if (nearbyOnly) {
      setNearbyOnly(false);
      return;
    }
    if (coords) {
      setNearbyOnly(true);
      return;
    }
    void requestLocation().then((granted) => setNearbyOnly(granted));
  }, [coords, nearbyOnly, requestLocation, setNearbyOnly]);

  // Digitar não deve travar a lista: a busca usa o valor "atrasado".
  const deferredQuery = useDeferredValue(query);
  const filters = useMemo(
    () => ({
      query: deferredQuery,
      category,
      ...(coords ? { origin: coords } : {}),
      ...(nearbyActive ? { radiusKm, sort: 'distance' as const } : {}),
    }),
    [category, coords, deferredQuery, nearbyActive, radiusKm],
  );

  const { data: categories = [] } = useCategories();
  const { data: activities = [], isPending } = useActivities(filters);

  return (
    <Screen padded={false} edges={['top']}>
      <BlobBackdrop height={150} />

      <View style={styles.header}>
        <Text variant="display">Explorar</Text>
        <Input
          icon="search-outline"
          placeholder="Buscar atividade ou bairro..."
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
          returnKeyType="search"
          containerStyle={styles.search}
        />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipsScroll}
        contentContainerStyle={styles.nearbyRow}
      >
        <Chip
          label={locating ? 'Localizando…' : 'Perto de mim'}
          selected={nearbyActive}
          onPress={locating ? undefined : toggleNearby}
          left={
            locating ? (
              <ActivityIndicator size="small" color={colors.textMuted} />
            ) : (
              <Ionicons
                name={nearbyActive ? 'navigate' : 'navigate-outline'}
                size={14}
                color={nearbyActive ? colors.primary : colors.textMuted}
              />
            )
          }
        />
        {nearbyActive
          ? RADIUS_OPTIONS_KM.map((option: RadiusKm) => (
              <Chip
                key={option}
                label={`${option} km`}
                selected={radiusKm === option}
                onPress={() => setRadiusKm(option)}
              />
            ))
          : null}
      </ScrollView>

      {locationStatus === 'denied' || locationStatus === 'unavailable' ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Abrir os ajustes de localização"
          onPress={() => void Linking.openSettings()}
          style={styles.locationNote}
        >
          <Text variant="caption" color={colors.textMuted}>
            {locationStatus === 'denied'
              ? 'Sem acesso à localização, não dá para ordenar por distância. '
              : 'Não conseguimos ler sua localização agora. '}
            <Text variant="caption" color={colors.primary}>
              Abrir ajustes
            </Text>
          </Text>
        </Pressable>
      ) : null}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipsScroll}
        contentContainerStyle={styles.chips}
      >
        <Chip label="Todos" selected={category === 'all'} onPress={() => setCategory('all')} />
        {categories.map((item) => (
          <Chip
            key={item.id}
            label={item.label}
            selected={category === item.id}
            onPress={() => setCategory(item.id)}
            left={<CategoryIcon category={item.id} size={16} />}
            tint={categoryTone(item.id, isDark)}
          />
        ))}
      </ScrollView>

      <FlatList
        data={activities}
        keyExtractor={keyExtractor}
        renderItem={({ item }) => (
          <ActivityListItem
            activity={item}
            onPress={() => router.push({ pathname: '/activity/[id]', params: { id: item.id } })}
          />
        )}
        ItemSeparatorComponent={Divider}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={6}
        maxToRenderPerBatch={8}
        windowSize={9}
        removeClippedSubviews
        ListEmptyComponent={
          <Text variant="body" color={colors.textFaint} center style={styles.empty}>
            {isPending
              ? 'Carregando atividades…'
              : nearbyActive
                ? `Nada a menos de ${radiusKm} km. Aumente o raio ou desligue o "Perto de mim".`
                : 'Nada encontrado por aqui. Tente outra busca ou modalidade.'}
          </Text>
        }
      />
    </Screen>
  );
}

const keyExtractor = (activity: Activity) => activity.id;

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, gap: spacing.base },
  search: { marginBottom: spacing.xs },
  // Sem isto a faixa de filtros é espremida pela lista: num flex em coluna, a
  // ScrollView horizontal encolhe até sobrar só uma tira do chip.
  chipsScroll: { flexGrow: 0, flexShrink: 0 },
  chips: { paddingHorizontal: spacing.xl, gap: spacing.sm, paddingBottom: spacing.md },
  nearbyRow: { gap: spacing.sm, paddingHorizontal: spacing.xl, paddingBottom: spacing.md },
  locationNote: { paddingHorizontal: spacing.xl, paddingBottom: spacing.md },
  list: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl },
  empty: { marginTop: spacing.xxxl },
});
