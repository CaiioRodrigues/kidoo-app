import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { Alert, Linking, Platform, Pressable, StyleSheet, View } from 'react-native';

import { ActivityListItem } from '@/features/activities';
import { CategoryIcon } from '@/components/CategoryIcon';
import { HeaderBar } from '@/components/navigation';
import { Badge, Card, Divider, Screen, Text } from '@/components/ui';
import { enderecoVisivel, linkDoMapa, linkDoTelefone, type Sistema } from '@/lib/local';
import { formatSessionTime } from '@/lib/format';
import { useBookings, usePartner } from '@/hooks/queries';
import { radius, spacing, useStyles, useTheme, type ThemeColors } from '@/theme';
import type { BookingDetails } from '@/types/domain';

/** `Platform.OS` cobre mais casos do que os três que o link conhece. */
const SISTEMA: Sistema =
  Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web';

/**
 * Tela do estabelecimento.
 *
 * O lugar da aula era um nome sem página: a família sabia para onde mandava o
 * filho e não tinha no app o endereço, o telefone, nem o que mais aquele lugar
 * oferece. Descobria por fora — e quem descobre por fora do app às vezes não
 * volta para dentro dele.
 *
 * Chega-se aqui tocando no nome do local, de dois lugares: da atividade, antes
 * de reservar, e da reserva já feita, que é onde a pergunta "como eu chego lá?"
 * realmente acontece.
 */
export default function PartnerScreen() {
  const { colors, palette } = useTheme();
  const styles = useStyles(makeStyles);
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, isPending, isError } = usePartner(id ?? '');
  const { data: bookings = [] } = useBookings();

  const partner = data?.partner ?? null;

  /*
    As reservas desta família neste lugar.

    Sai da lista que a aba Reservas já carregou, e não de uma consulta por
    parceiro: a lista é curta por natureza (uma família, um punhado de aulas) e
    já está em cache, então filtrar aqui custa nada e evita um segundo estado
    de carregamento numa tela que já tem um.

    Mais recente primeiro: quem abre o local a partir de uma reserva quer ver
    aquela reserva, e ela é quase sempre a próxima.
  */
  const daFamilia = useMemo(
    () =>
      bookings
        .filter((booking) => booking.activity.partner.id === id && booking.status !== 'cancelled')
        .sort((a, b) => Date.parse(b.scheduledAt) - Date.parse(a.scheduledAt)),
    [bookings, id],
  );

  const abrirMapa = useCallback(async () => {
    if (!partner) return;
    // `openURL` recusa o que o aparelho não sabe abrir, e recusa com exceção.
    // Sem o aviso, o toque não faria absolutamente nada.
    try {
      await Linking.openURL(linkDoMapa(partner, SISTEMA));
    } catch {
      Alert.alert(
        'Não deu para abrir o mapa',
        'Nenhum aplicativo de mapas respondeu neste aparelho.',
      );
    }
  }, [partner]);

  const ligar = useCallback(async () => {
    if (!partner?.phone) return;
    try {
      await Linking.openURL(linkDoTelefone(partner.phone));
    } catch {
      Alert.alert('Não deu para ligar', `Disque ${partner.phone} no seu telefone.`);
    }
  }, [partner]);

  if (isPending) {
    return (
      <Screen>
        <HeaderBar />
        <Text variant="body" color={colors.textFaint}>
          Carregando o local…
        </Text>
      </Screen>
    );
  }

  if (isError || !partner || !data) {
    return (
      <Screen>
        <HeaderBar />
        <Text variant="subheading">Local não encontrado</Text>
        <Text variant="body" color={colors.textMuted}>
          Este estabelecimento não está mais disponível.
        </Text>
      </Screen>
    );
  }

  return (
    <Screen scroll contentContainerStyle={styles.scroll}>
      <HeaderBar />

      <View style={styles.titulo}>
        <Text variant="display">{partner.name}</Text>
        {/*
          O selo só vale para quem está no ar. "Parceiro verificado" num lugar
          que saiu é a frase mais enganosa que esta tela poderia ter: ela diz
          exatamente o contrário do que o cartão logo abaixo está avisando.
        */}
        {partner.verified && partner.active ? (
          <Badge label="Parceiro verificado" tone="teal" />
        ) : null}
      </View>

      {/*
        Quem chega aqui por uma reserva antiga tem de saber antes de sair de
        casa. A tela não some — o histórico é dela — mas para de parecer um
        lugar onde dá para marcar aula.
      */}
      {partner.active ? null : (
        <Card background={palette.yellowSoft} elevation="none" style={styles.fora}>
          <Ionicons name="information-circle-outline" size={20} color={colors.warning} />
          <Text variant="caption" color={colors.text} style={styles.foraTexto}>
            Este estabelecimento não faz mais parte do Kidoo. As aulas que você já marcou aqui
            continuam valendo — confirme com o local antes de ir.
          </Text>
        </Card>
      )}

      <Card bordered elevation="none" style={styles.cartao}>
        <View style={styles.linha}>
          <Ionicons name="location-outline" size={20} color={colors.primary} />
          <View style={styles.linhaTexto}>
            <Text variant="bodyStrong">{enderecoVisivel(partner)}</Text>
            {partner.address ? (
              <Text variant="caption" color={colors.textFaint}>
                {partner.neighborhood}, {partner.city}
              </Text>
            ) : (
              /*
                Dito, e não escondido. A ausência do endereço é do
                estabelecimento, não do app — e a família que não sabe disso
                fica procurando uma informação que ninguém escondeu dela.
              */
              <Text variant="caption" color={colors.textFaint}>
                Este local ainda não cadastrou o endereço. O mapa abre pela localização dele.
              </Text>
            )}
          </View>
        </View>

        {/* O botão do mapa não depende do endereço: quem posiciona o alfinete
            é a coordenada, que existe desde que o parceiro entrou. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Abrir ${partner.name} no mapa`}
          onPress={() => void abrirMapa()}
          style={({ pressed }) => [styles.acao, pressed && styles.pressionado]}
        >
          <Ionicons name="navigate" size={18} color={colors.primary} />
          <Text variant="label" color={colors.primary}>
            Abrir no mapa
          </Text>
        </Pressable>

        {partner.phone ? (
          <>
            <Divider />
            <View style={styles.linha}>
              <Ionicons name="call-outline" size={20} color={colors.primary} />
              <View style={styles.linhaTexto}>
                <Text variant="bodyStrong">{partner.phone}</Text>
                <Text variant="caption" color={colors.textFaint}>
                  Telefone do estabelecimento
                </Text>
              </View>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Ligar para ${partner.name}`}
              onPress={() => void ligar()}
              style={({ pressed }) => [styles.acao, pressed && styles.pressionado]}
            >
              <Ionicons name="call" size={18} color={colors.primary} />
              <Text variant="label" color={colors.primary}>
                Ligar
              </Text>
            </Pressable>
          </>
        ) : null}
      </Card>

      {daFamilia.length > 0 ? (
        <>
          <Text variant="subheading" style={styles.secao}>
            {daFamilia.length === 1 ? 'Sua reserva aqui' : 'Suas reservas aqui'}
          </Text>
          <Card bordered elevation="none" style={styles.lista}>
            {daFamilia.map((booking, i) => (
              <View key={booking.id}>
                {i > 0 ? <Divider /> : null}
                <ReservaDaqui
                  booking={booking}
                  onPress={() => router.push(`/booking/${booking.id}/check-in`)}
                />
              </View>
            ))}
          </Card>
        </>
      ) : null}

      {/* Para quem saiu, a lista de atividades não aparece: seria um catálogo
          de aulas que não dá para reservar, e cada toque terminaria numa
          recusa. O cartão de aviso acima já é a resposta. */}
      {partner.active ? (
        <>
          <Text variant="subheading" style={styles.secao}>
            {data.activities.length === 1 ? 'Atividade neste local' : 'Atividades neste local'}
          </Text>
          {data.activities.length === 0 ? (
            <Card bordered elevation="none">
              <Text variant="caption" color={colors.textMuted}>
                Este local não tem atividade publicada no momento.
              </Text>
            </Card>
          ) : (
            <View style={styles.atividades}>
              {data.activities.map((activity) => (
                <ActivityListItem
                  key={activity.id}
                  activity={activity}
                  onPress={() => router.push(`/activity/${activity.id}`)}
                />
              ))}
            </View>
          )}
        </>
      ) : null}
    </Screen>
  );
}

/** Uma reserva desta família neste lugar. */
function ReservaDaqui({ booking, onPress }: { booking: BookingDetails; onPress: () => void }) {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Abrir a reserva de ${booking.activity.title}`}
      onPress={onPress}
      style={({ pressed }) => [styles.reserva, pressed && styles.pressionado]}
    >
      <CategoryIcon category={booking.activity.category} size={24} />
      <View style={styles.linhaTexto}>
        <Text variant="bodyStrong" numberOfLines={1}>
          {booking.activity.title}
        </Text>
        <Text variant="caption" color={colors.textMuted}>
          {booking.child.name.split(' ')[0]} • {formatSessionTime(booking.scheduledAt)}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
    </Pressable>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    fora: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
    foraTexto: { flex: 1 },
    scroll: { paddingBottom: spacing.xxl, gap: spacing.md },
    titulo: { gap: spacing.sm, alignItems: 'flex-start', marginTop: spacing.sm },
    cartao: { gap: spacing.md },
    linha: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
    linhaTexto: { flex: 1, gap: spacing.xxs },
    acao: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.md,
      borderRadius: radius.md,
      backgroundColor: colors.primaryTint,
    },
    pressionado: { opacity: 0.6 },
    secao: { marginTop: spacing.lg },
    lista: { paddingVertical: spacing.xs },
    reserva: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.md,
    },
    atividades: { gap: spacing.sm },
  });
