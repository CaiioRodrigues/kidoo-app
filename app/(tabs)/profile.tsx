import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Avatar, Button, Card, Divider, Screen, Text, ThemePicker } from '@/components/ui';
import { BlobBackdrop } from '@/components/brand';
import { useTutorialStore } from '@/stores/tutorial-store';
import { confirmAction } from '@/lib/confirm';
import { formatAge, formatDaysUntil } from '@/lib/format';
import { daysUntilReset } from '@/lib/subscription';
import { useChildren, useSubscription, useUpdateChildPhoto } from '@/hooks/queries';
import { useAuthStore } from '@/stores/auth-store';
import { backendName, toUserMessage } from '@/services';
import * as ImagePicker from 'expo-image-picker';
import { spacing, useTheme } from '@/theme';

export default function ProfileScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const session = useAuthStore((state) => state.session);
  const signOut = useAuthStore((state) => state.signOut);
  const { data: children = [] } = useChildren();
  const { data: subscription } = useSubscription();
  const [signingOut, setSigningOut] = useState(false);
  const restartTutorial = useTutorialStore((state) => state.restart);
  const updatePhoto = useUpdateChildPhoto();
  const [trocandoFoto, setTrocandoFoto] = useState<string | null>(null);
  const [erroFoto, setErroFoto] = useState<string | null>(null);

  const escolherFoto = useCallback(
    async (childId: string) => {
      setErroFoto(null);
      const permissao = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissao.granted) {
        setErroFoto('Precisamos da permissão de fotos para trocar a imagem.');
        return;
      }
      const escolha = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        // O recorte quadrado e a compressão acontecem aqui, antes de subir: é
        // o avatar de 40 px, e mandar 8 MB do celular para o bucket seria
        // gastar dado da família para nada.
        quality: 0.7,
      });
      const uri = escolha.canceled ? null : escolha.assets[0]?.uri;
      if (!uri) return;

      setTrocandoFoto(childId);
      try {
        await updatePhoto.mutateAsync({ childId, photoUri: uri });
      } catch (caught) {
        setErroFoto(toUserMessage(caught));
      } finally {
        setTrocandoFoto(null);
      }
    },
    [updatePhoto],
  );

  const removerFoto = useCallback(
    async (childId: string, nome: string) => {
      const ok = await confirmAction({
        title: 'Remover a foto?',
        message: `A foto de ${nome} sai do app e do servidor. Dá para colocar outra depois.`,
        confirmLabel: 'Remover',
        destructive: true,
      });
      if (!ok) return;
      setErroFoto(null);
      setTrocandoFoto(childId);
      try {
        await updatePhoto.mutateAsync({ childId, photoUri: null });
      } catch (caught) {
        setErroFoto(toUserMessage(caught));
      } finally {
        setTrocandoFoto(null);
      }
    },
    [updatePhoto],
  );

  const handleReplayTutorial = useCallback(() => {
    restartTutorial();
    // `navigate`, e não `push`: empilhar as abas monta uma segunda Home, e o
    // tutorial aparecia duplicado, um por cima do outro.
    router.navigate('/(tabs)/home');
  }, [restartTutorial, router]);

  const handleSignOut = useCallback(async () => {
    const confirmado = await confirmAction({
      title: 'Sair da conta',
      message: 'Você precisará entrar novamente para acessar o Kidoo.',
      confirmLabel: 'Sair',
      destructive: true,
    });
    if (!confirmado) return;

    setSigningOut(true);
    try {
      await signOut();
    } finally {
      setSigningOut(false);
      router.replace('/(auth)/welcome');
    }
  }, [router, signOut]);

  return (
    <Screen scroll contentContainerStyle={styles.scroll}>
      <BlobBackdrop height={150} style={styles.backdrop} />

      <View style={styles.header}>
        <Avatar name={session?.guardian.name ?? 'Visitante'} size={64} ring />
        <View style={styles.headerInfo}>
          <Text variant="heading" numberOfLines={1}>
            {session?.guardian.name ?? 'Visitante'}
          </Text>
          <Text variant="caption" color={colors.textMuted} numberOfLines={1}>
            {session?.guardian.email ?? 'Entre para salvar suas preferências'}
          </Text>
        </View>
      </View>

      {subscription ? (
        <Card bordered elevation="none" style={styles.card}>
          <Text variant="label" color={colors.textMuted}>
            Seu plano
          </Text>
          <Text variant="subheading" style={styles.capitalize}>
            {subscription.planId}
          </Text>
          <Text variant="caption" color={colors.textMuted}>
            {subscription.coinsRemaining} de {subscription.coinsPerWeek} coins nesta semana · volta
            ao cheio {formatDaysUntil(daysUntilReset(subscription))}
          </Text>
        </Card>
      ) : null}

      <Text variant="subheading" style={styles.sectionTitle}>
        Crianças
      </Text>
      <Card bordered elevation="none" padded={false}>
        {children.length === 0 ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/(onboarding)/child')}
            style={styles.row}
          >
            <Ionicons name="add-circle-outline" size={22} color={colors.primary} />
            <Text variant="body" color={colors.primary} style={styles.flex}>
              Cadastrar criança
            </Text>
          </Pressable>
        ) : (
          children.map((child, index) => (
            <View key={child.id}>
              {index > 0 ? <Divider /> : null}
              <View style={styles.row}>
                {/* O avatar é o botão. Até aqui a foto era escolhida uma vez
                    no cadastro e nunca mais — não havia tela nenhuma para
                    trocar, e "a criança cresceu" não é caso raro. */}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    child.photoUri
                      ? `Trocar a foto de ${child.name}`
                      : `Adicionar foto de ${child.name}`
                  }
                  disabled={trocandoFoto === child.id}
                  onPress={() => void escolherFoto(child.id)}
                  style={styles.avatarBotao}
                >
                  <Avatar name={child.name} uri={child.photoUri} size={40} />
                  <View style={styles.lapis}>
                    <Ionicons
                      name={trocandoFoto === child.id ? 'hourglass-outline' : 'camera'}
                      size={10}
                      color={colors.textOnPrimary}
                    />
                  </View>
                </Pressable>
                <View style={styles.flex}>
                  <Text variant="bodyStrong" numberOfLines={1}>
                    {child.name}
                  </Text>
                  <Text variant="caption" color={colors.textMuted}>
                    {formatAge(child.birthDate)} • nível {child.level}
                  </Text>
                </View>
                {child.photoUri ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Remover a foto de ${child.name}`}
                    onPress={() => void removerFoto(child.id, child.name)}
                    hitSlop={8}
                  >
                    <Text variant="caption" color={colors.textFaint}>
                      Remover
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          ))
        )}
        {erroFoto ? (
          <Text variant="caption" color={colors.danger}>
            {erroFoto}
          </Text>
        ) : null}
      </Card>

      <Text variant="subheading" style={styles.sectionTitle}>
        Aparência
      </Text>
      <Card bordered elevation="none" style={styles.card}>
        <Text variant="label" color={colors.textMuted}>
          Tema do app
        </Text>
        <ThemePicker />
      </Card>

      <Text variant="subheading" style={styles.sectionTitle}>
        Ajuda
      </Text>
      <Card bordered elevation="none" padded={false}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Ver o tutorial novamente"
          onPress={handleReplayTutorial}
          style={styles.row}
        >
          <Ionicons name="sparkles-outline" size={22} color={colors.primary} />
          <View style={styles.flex}>
            <Text variant="body" color={colors.primary}>
              Ver o tutorial novamente
            </Text>
            <Text variant="caption" color={colors.textMuted}>
              O Kiddo reapresenta o app em quatro passos.
            </Text>
          </View>
        </Pressable>
      </Card>

      <Text variant="subheading" style={styles.sectionTitle}>
        Privacidade
      </Text>
      <Card bordered elevation="none" style={styles.card}>
        <Text variant="caption" color={colors.textMuted}>
          Coletamos apenas o necessário para sugerir atividades adequadas à idade. Você pode pedir a
          exclusão dos dados do seu filho a qualquer momento, conforme a LGPD.
        </Text>
      </Card>

      {session ? (
        <Button
          title="Sair da conta"
          variant="secondary"
          loading={signingOut}
          onPress={() => void handleSignOut()}
          style={styles.signOut}
        />
      ) : (
        <Button
          title="Entrar"
          onPress={() => router.push('/(auth)/welcome')}
          style={styles.signOut}
        />
      )}

      {/* Quem testa precisa saber se o que está vendo é dado real. Sem esta
          linha, catálogo de demonstração e catálogo de verdade são iguais na
          tela — e um bug de backend passa por bug de conteúdo. */}
      <Text variant="caption" color={colors.textFaint} style={styles.backend}>
        {backendName === 'supabase'
          ? 'Conectado ao servidor Kidoo.'
          : 'Modo demonstração: as atividades e reservas não são reais.'}
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  backdrop: { left: -spacing.xl, right: -spacing.xl },
  scroll: { paddingBottom: spacing.xxl },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.base,
    paddingTop: spacing.base,
  },
  headerInfo: { flex: 1, gap: spacing.xxs },
  sectionTitle: { marginTop: spacing.xl, marginBottom: spacing.md },
  card: { gap: spacing.xs, marginTop: spacing.xl },
  capitalize: { textTransform: 'capitalize' },
  // A câmera fica a cavalo no canto do avatar: é o que diz "isto se toca"
  // sem precisar de um botão separado ocupando a linha.
  avatarBotao: { position: 'relative' },
  lapis: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6A3FC6',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.base,
  },
  flex: { flex: 1 },
  signOut: { marginTop: spacing.xxl },
  backend: { marginTop: spacing.lg, textAlign: 'center' },
});
