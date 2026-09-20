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
import { bairrosDoCatalogo, mesmoBairro } from '@/lib/bairros';
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

  /*
    Os bairros saem de uma segunda leitura do catálogo, com a modalidade e sem
    o texto digitado.

    Sem o texto porque a fileira tem de ficar parada: derivada da lista que
    está na tela, escolher "Buritis" apagaria todos os outros chips e não
    haveria como trocar de bairro sem limpar a busca à mão.

    COM a modalidade porque a promessa da fileira é que nenhum chip leva a
    lugar nenhum. Com "Judô" selecionado, um chip de um bairro que só tem
    natação devolveria tela vazia — e um atalho que devolve nada é pior que
    não existir.

    Hoje isso é uma leitura do catálogo inteiro, o que só é aceitável porque
    o catálogo é pequeno. Passando de algumas centenas de atividades, isto
    vira uma chamada própria que devolve só os pares bairro/quantidade.
  */
  const filtrosDoBairro = useMemo(() => ({ category }), [category]);
  const { data: catalogoDaModalidade = [] } = useActivities(filtrosDoBairro);
  const bairros = useMemo(() => bairrosDoCatalogo(catalogoDaModalidade), [catalogoDaModalidade]);

  // O prompt do sistema só aparece a partir daqui — de um toque, com o rótulo
  // "Perto de mim" na tela dizendo para quê.
  const toggleNearby = useCallback(() => {
    if (nearbyOnly) {
      setNearbyOnly(false);
      return;
    }
    // Bairro e "Perto de mim" respondem a MESMA pergunta — onde — por dois
    // caminhos. Somar os dois é como se chega a "Savassi a menos de 3 km de
    // onde eu estou": zero resultados, e a tela parecendo quebrada por ter
    // obedecido. Ligar a distância desfaz o bairro escolhido.
    //
    // Só o bairro. Uma busca digitada ("natação", "Arena") é outra pergunta e
    // continua valendo.
    setQuery((atual) => (bairros.some((b) => mesmoBairro(atual, b.nome)) ? '' : atual));
    if (coords) {
      setNearbyOnly(true);
      return;
    }
    void requestLocation().then((granted) => setNearbyOnly(granted));
  }, [bairros, coords, nearbyOnly, requestLocation, setNearbyOnly]);

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
        {/* Uma fileira, uma pergunta. Aqui é "onde": por distância, e então os
            raios; ou por bairro, e então os bairros. Os dois ao mesmo tempo
            fariam uma fileira longa de opções que se anulam. A modalidade tem
            a fileira dela, logo abaixo. */}
        {nearbyActive
          ? RADIUS_OPTIONS_KM.map((option: RadiusKm) => (
              <Chip
                key={option}
                label={`${option} km`}
                selected={radiusKm === option}
                onPress={() => setRadiusKm(option)}
              />
            ))
          : bairros.map((bairro) => {
              const escolhido = mesmoBairro(query, bairro.nome);
              return (
                <Chip
                  key={bairro.nome}
                  label={bairro.nome}
                  selected={escolhido}
                  // O chip escreve na busca em vez de virar um filtro à parte:
                  // é o campo que já sabia procurar bairro, e ninguém tinha
                  // descoberto. Assim o toque mostra onde aquilo foi parar, dá
                  // para editar e dá para apagar.
                  onPress={() => setQuery(escolhido ? '' : bairro.nome)}
                  left={
                    <Ionicons
                      name="location-outline"
                      size={14}
                      color={escolhido ? colors.primary : colors.textMuted}
                    />
                  }
                />
              );
            })}
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
