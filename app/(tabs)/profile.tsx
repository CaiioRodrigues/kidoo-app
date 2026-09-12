import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { Avatar, Button, Card, Divider, Screen, Text, ThemePicker } from '@/components/ui';
import { BlobBackdrop } from '@/components/brand';
import { useOnboardingStore } from '@/stores/onboarding-store';
import { useTutorialStore } from '@/stores/tutorial-store';
import { confirmAction } from '@/lib/confirm';
import { escolherImagem } from '@/lib/foto';
import { formatAge, formatDaysUntil } from '@/lib/format';
import { daysUntilReset } from '@/lib/subscription';
import { useChildren, useSubscription, useUpdateChildPhoto } from '@/hooks/queries';
import { useAuthStore } from '@/stores/auth-store';
import { backendName, toUserMessage } from '@/services';
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
  const resetRascunho = useOnboardingStore((state) => state.reset);
  const updatePhoto = useUpdateChildPhoto();
  const [trocandoFoto, setTrocandoFoto] = useState<string | null>(null);
  const [trocandoMinhaFoto, setTrocandoMinhaFoto] = useState(false);
  const [erroFoto, setErroFoto] = useState<string | null>(null);
  const trocarFoto = useAuthStore((state) => state.trocarFoto);

  const escolherFoto = useCallback(
    async (childId: string) => {
      setErroFoto(null);
      const escolha = await escolherImagem();
      if (escolha.estado === 'negado') {
        setErroFoto('Precisamos da permissão de fotos para trocar a imagem.');
        return;
      }
      if (escolha.estado === 'cancelado') return;

      setTrocandoFoto(childId);
      try {
        await updatePhoto.mutateAsync({ childId, photoUri: escolha.uri });
      } catch (caught) {
        setErroFoto(toUserMessage(caught));
      } finally {
        setTrocandoFoto(null);
      }
    },
    [updatePhoto],
  );

  /*
    A foto do responsável.

    Usa o mesmo seletor e o mesmo estado de erro da foto da criança, e não um
    par separado: é a mesma tela, e dois avisos de erro em lugares diferentes
    para a mesma operação seria ruído. O que muda é só onde o resultado é
    guardado — a criança vai para o React Query, o responsável para a sessão,
    que é de onde este cabeçalho lê.
  */
  const trocarFotoDoResponsavel = useCallback(async () => {
    setErroFoto(null);
    const escolha = await escolherImagem();
    if (escolha.estado === 'negado') {
      setErroFoto('Precisamos da permissão de fotos para trocar a imagem.');
      return;
    }
    if (escolha.estado === 'cancelado') return;

    setTrocandoMinhaFoto(true);
    try {
      await trocarFoto(escolha.uri);
    } catch (caught) {
      setErroFoto(toUserMessage(caught));
    } finally {
      setTrocandoMinhaFoto(false);
    }
  }, [trocarFoto]);

  const removerFotoDoResponsavel = useCallback(async () => {
    const ok = await confirmAction({
      title: 'Remover a sua foto?',
      message: 'Ela sai do app e do servidor. Dá para colocar outra depois.',
      confirmLabel: 'Remover',
      destructive: true,
    });
    if (!ok) return;
    setErroFoto(null);
    setTrocandoMinhaFoto(true);
    try {
      await trocarFoto(null);
    } catch (caught) {
      setErroFoto(toUserMessage(caught));
    } finally {
      setTrocandoMinhaFoto(false);
    }
  }, [trocarFoto]);

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

  /**
   * O rascunho é limpo antes de abrir o formulário.
   *
   * Ele vive em memória e sobrevive a um cadastro abandonado no meio. Sem esta
   * limpeza, quem desistisse na tela de interesses e voltasse depois para
   * cadastrar outro filho encontraria o formulário preenchido com o nome e a
   * data de nascimento do anterior — e é o tipo de campo que se confirma sem
   * reler.
   */
  const adicionarCrianca = useCallback(() => {
    resetRascunho();
    router.push('/(onboarding)/child');
  }, [resetRascunho, router]);

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
        {/*
          O avatar do responsável também é botão — mas só para quem tem conta.
          Visitante não tem onde guardar foto nenhuma, e oferecer o toque a ele
          seria abrir um seletor de imagens que termina num erro de sessão.
        */}
        {session ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              session.guardian.photoUri ? 'Trocar a sua foto' : 'Adicionar a sua foto'
            }
            disabled={trocandoMinhaFoto}
            onPress={() => void trocarFotoDoResponsavel()}
            style={styles.avatarBotao}
          >
            <Avatar name={session.guardian.name} uri={session.guardian.photoUri} size={64} ring />
            <View style={styles.lapis}>
              <Ionicons
                name={trocandoMinhaFoto ? 'hourglass-outline' : 'camera'}
                size={12}
                color={colors.textOnPrimary}
              />
            </View>
          </Pressable>
        ) : (
          <Avatar name="Visitante" size={64} ring />
        )}
        <View style={styles.headerInfo}>
          <Text variant="heading" numberOfLines={1}>
            {session?.guardian.name ?? 'Visitante'}
          </Text>
          <Text variant="caption" color={colors.textMuted} numberOfLines={1}>
            {session?.guardian.email ?? 'Entre para salvar suas preferências'}
          </Text>
          {session?.guardian.photoUri ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Remover a sua foto"
              onPress={() => void removerFotoDoResponsavel()}
              hitSlop={8}
              style={styles.removerMinhaFoto}
            >
              <Text variant="caption" color={colors.textFaint}>
                Remover foto
              </Text>
            </Pressable>
          ) : null}
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
        {children.length > 0 &&
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
          ))}

        {/* Sempre presente, e não só com a lista vazia.
            Até aqui "Cadastrar criança" aparecia apenas quando não havia
            nenhuma, então a família com dois filhos cadastrava o primeiro e
            não tinha por onde cadastrar o segundo — o banco sempre aceitou
            vários, era a tela que fechava a porta. */}
        {children.length > 0 ? <Divider /> : null}
        <Pressable accessibilityRole="button" onPress={adicionarCrianca} style={styles.row}>
          <Ionicons name="add-circle-outline" size={22} color={colors.primary} />
          <Text variant="body" color={colors.primary} style={styles.flex}>
            {children.length === 0 ? 'Cadastrar criança' : 'Adicionar outra criança'}
          </Text>
        </Pressable>

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

      {/* Só para quem tem conta: o aviso de vaga depende de uma família
          registrada, e para visitante a seção ficaria em "Verificando…" para
          sempre — o registro nem chega a ser tentado. */}
      {session ? (
        <>
          <Text variant="subheading" style={styles.sectionTitle}>
            Avisos
          </Text>
          <AvisosDeVaga />
        </>
      ) : null}

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

/**
 * Este aparelho recebe aviso de vaga?
 *
 * A tela existe porque a falha era invisível. O registro do aparelho roda de
 * propósito dentro de um `catch` que não trava o login — e por isso, quando ele
 * falhava, ninguém tinha como saber: nem a família, que pedia aviso e nunca
 * recebia, nem quem estava desenvolvendo. Descobrir exigia consultar o banco.
 *
 * Não é uma configuração: não há o que ligar ou desligar aqui além de tentar de
 * novo. É um espelho — diz o que está acontecendo e, quando dá, o que fazer.
 */
function AvisosDeVaga() {
  const { colors } = useTheme();
  const push = useAuthStore((state) => state.push);
  const registrar = useAuthStore((state) => state.registrarPush);

  const dados: Record<
    typeof push,
    { icone: keyof typeof Ionicons.glyphMap; cor: string; titulo: string; texto: string }
  > = {
    checando: {
      icone: 'ellipsis-horizontal',
      cor: colors.textMuted,
      titulo: 'Verificando…',
      texto: 'Conferindo se este aparelho pode receber avisos.',
    },
    ativo: {
      icone: 'notifications',
      cor: colors.success,
      titulo: 'Avisos ativados',
      texto: 'Quando abrir vaga numa turma que você acompanha, a gente avisa aqui.',
    },
    sem_permissao: {
      icone: 'notifications-off-outline',
      cor: colors.warning,
      titulo: 'Notificações desligadas',
      texto: 'Sem a permissão do aparelho não dá para avisar. Toque para abrir os ajustes.',
    },
    sem_suporte: {
      icone: 'phone-portrait-outline',
      cor: colors.textMuted,
      titulo: 'Avisos indisponíveis aqui',
      texto: 'Aviso de vaga só funciona no aplicativo instalado, num celular de verdade.',
    },
    falhou: {
      icone: 'refresh-outline',
      cor: colors.warning,
      titulo: 'Não foi possível ativar',
      texto: 'O aparelho não ficou registrado. Toque para tentar de novo.',
    },
  };

  const atual = dados[push];
  // Só onde há o que fazer: em "ativo" e "checando" o toque não levaria a nada,
  // e uma linha que parece botão e não faz nada é pior que uma linha comum.
  const acao =
    push === 'sem_permissao'
      ? () => void Linking.openSettings()
      : push === 'falhou'
        ? () => void registrar()
        : null;

  const conteudo = (
    <>
      <Ionicons name={atual.icone} size={22} color={atual.cor} />
      <View style={styles.flex}>
        <Text variant="body" color={acao ? colors.primary : colors.text}>
          {atual.titulo}
        </Text>
        <Text variant="caption" color={colors.textMuted}>
          {atual.texto}
        </Text>
      </View>
    </>
  );

  return (
    <Card bordered elevation="none" padded={false}>
      {acao ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={atual.titulo}
          onPress={acao}
          style={styles.row}
        >
          {conteudo}
        </Pressable>
      ) : (
        <View style={styles.row}>{conteudo}</View>
      )}
    </Card>
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
  removerMinhaFoto: { alignSelf: 'flex-start', marginTop: spacing.xxs },
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
