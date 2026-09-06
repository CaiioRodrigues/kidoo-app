import { useLocalSearchParams, useRouter } from 'expo-router';
import { useDeferredValue, useMemo, useState } from 'react';
import { FlatList, ScrollView, StyleSheet, View } from 'react-native';

import { ActivityListItem } from '@/features/activities';
import { BlobBackdrop } from '@/components/brand';
import { Chip, Divider, Input, Screen, Text } from '@/components/ui';
import { CategoryIcon } from '@/components/CategoryIcon';
import { useActivities, useCategories } from '@/hooks/queries';
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

  // Digitar não deve travar a lista: a busca usa o valor "atrasado".
  const deferredQuery = useDeferredValue(query);
  const filters = useMemo(() => ({ query: deferredQuery, category }), [category, deferredQuery]);

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
  list: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl },
  empty: { marginTop: spacing.xxxl },
});
