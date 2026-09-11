import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { BlobBackdrop } from '@/components/brand';
import { Button, Input, Screen, Text } from '@/components/ui';
import { lerErroDoLink, lerSessaoDoLink } from '@/lib/confirmacao';
import { fieldErrors, newPasswordSchema } from '@/lib/validation';
import { toUserMessage } from '@/services';
import { useAuthStore } from '@/stores/auth-store';
import { blobRadius, spacing, useStyles, useTheme, type ThemeColors } from '@/theme';

/**
 * A volta do link de redefinição de senha.
 *
 * O link traz uma sessão no fim da URL, igual ao de confirmação — o que muda é
 * o destino. Confirmar termina na Home; redefinir tem de parar aqui e pedir a
 * senha nova, senão a pessoa entra com a senha antiga ainda valendo e o
 * problema que a trouxe continua de pé.
 *
 * A sessão é trocada primeiro, e só depois a senha: é ela que autoriza o
 * `updateUser`. O clique no link é a prova de acesso à caixa de entrada, que é
 * a mesma prova que a confirmação de e-mail usa.
 */
export default function NovaSenhaScreen() {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const router = useRouter();
  const url = Linking.useURL();
  const confirmar = useAuthStore((state) => state.confirmByLink);
  const trocarSenha = useAuthStore((state) => state.updatePassword);

  // Mesmo cuidado da tela de confirmação: o objeto precisa sobreviver ao
  // render seguinte, senão o efeito abaixo o vê "novo" a cada desenho e troca
  // os tokens em laço.
  const sessao = useMemo(() => (url ? lerSessaoDoLink(url) : null), [url]);
  const PEDIR_OUTRO = 'Peça outro e use dentro de uma hora.';
  const erroDoLink = url
    ? (lerErroDoLink(url, PEDIR_OUTRO) ??
      (sessao ? null : `Não encontrei a redefinição neste link. ${PEDIR_OUTRO}`))
    : null;

  const [entrando, setEntrando] = useState(true);
  const [erroDaTroca, setErroDaTroca] = useState<string | null>(null);

  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState(false);
  const [erroAoSalvar, setErroAoSalvar] = useState<string | null>(null);

  useEffect(() => {
    if (!sessao) return;

    let vivo = true;
    void confirmar(sessao)
      .then(() => {
        if (vivo) setEntrando(false);
      })
      .catch((caught: unknown) => {
        if (vivo) {
          setErroDaTroca(toUserMessage(caught));
          setEntrando(false);
        }
      });
    return () => {
      vivo = false;
    };
  }, [confirmar, sessao]);

  const salvar = useCallback(async () => {
    const parsed = newPasswordSchema.safeParse({ password, confirmation });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    setErroAoSalvar(null);
    setSalvando(true);
    try {
      await trocarSenha(parsed.data.password);
      // `replace`, e não `push`: voltar para uma tela de redefinição com um
      // link já gasto só produziria um erro sem saída.
      router.replace('/(tabs)/home');
    } catch (caught) {
      setErroAoSalvar(toUserMessage(caught));
    } finally {
      setSalvando(false);
    }
  }, [confirmation, password, router, trocarSenha]);

  const erro = erroDoLink ?? erroDaTroca;

  if (erro) {
    return (
      <Screen scroll contentContainerStyle={styles.scroll}>
        <BlobBackdrop />
        <View style={styles.hero}>
          <View style={[styles.mark, styles.markErro]}>
            <Ionicons name="alert-circle-outline" size={38} color={colors.danger} />
          </View>
          <Text variant="title" center>
            Este link não vale mais
          </Text>
          <Text variant="body" color={colors.textMuted} center>
            {erro}
          </Text>
        </View>
        <View style={styles.actions}>
          <Button
            title="Pedir um link novo"
            onPress={() => router.replace('/(auth)/forgot-password')}
          />
        </View>
      </Screen>
    );
  }

  // Enquanto o link não chega e enquanto a sessão é trocada, a tela espera. Ler
  // "sem sessão" nesse instante mostraria erro para quem clicou num link bom.
  if (!url || entrando) {
    return (
      <Screen contentContainerStyle={styles.centro}>
        <ActivityIndicator color={colors.primary} />
        <Text variant="body" color={colors.textMuted} center>
          Abrindo o link…
        </Text>
      </Screen>
    );
  }

  return (
    <Screen scroll contentContainerStyle={styles.scroll}>
      <BlobBackdrop />

      <View style={styles.hero}>
        <View style={styles.mark}>
          <Ionicons name="lock-closed-outline" size={38} color={colors.primary} />
        </View>
        <Text variant="title" center>
          Escolha a senha nova
        </Text>
        <Text variant="body" color={colors.textMuted} center>
          A anterior deixa de valer assim que você salvar.
        </Text>
      </View>

      <View style={styles.form}>
        <Input
          label="Nova senha"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="new-password"
          error={errors.password}
        />
        <Input
          label="Repita a senha"
          value={confirmation}
          onChangeText={setConfirmation}
          secureTextEntry
          autoComplete="new-password"
          error={errors.confirmation}
          onSubmitEditing={() => void salvar()}
          returnKeyType="done"
        />

        {erroAoSalvar ? (
          <Text variant="caption" color={colors.danger} center>
            {erroAoSalvar}
          </Text>
        ) : null}

        <Button title="Salvar e entrar" loading={salvando} onPress={() => void salvar()} />
      </View>
    </Screen>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    scroll: { paddingBottom: spacing.xxl },
    centro: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
    hero: { alignItems: 'center', gap: spacing.sm, marginTop: spacing.xxl },
    mark: {
      width: 84,
      height: 84,
      backgroundColor: colors.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.sm,
      ...blobRadius.card,
    },
    markErro: { backgroundColor: colors.dangerSoft },
    form: { gap: spacing.md, marginTop: spacing.xl },
    actions: { gap: spacing.md, marginTop: spacing.xl },
  });
