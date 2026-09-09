import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { BlobBackdrop } from '@/components/brand';
import { Button, Screen, Text } from '@/components/ui';
import { lerErroDoLink, lerSessaoDoLink } from '@/lib/confirmacao';
import { useAuthStore } from '@/stores/auth-store';
import { spacing, useStyles, useTheme, type ThemeColors } from '@/theme';

/**
 * A volta do link de confirmação.
 *
 * O Supabase abre esta rota com a sessão no fim da URL, depois do `#`. A tela
 * existe porque o momento é frágil dos dois lados: quem clica está a um passo
 * de usar o app pela primeira vez, e quem clicou tarde demais precisa saber que
 * o link venceu — sem isso, "confirmei e não entrou" não tem explicação
 * nenhuma.
 *
 * Ela não pede senha. O clique no link já é a prova de que a pessoa tem acesso
 * àquela caixa de entrada, e pedir a senha logo depois de tê-la escolhido é
 * pedir duas vezes a mesma coisa.
 */
export default function ConfirmadoScreen() {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const router = useRouter();
  const url = Linking.useURL();
  const confirmar = useAuthStore((state) => state.confirmByLink);

  /*
    O que o link diz é derivado dele, não guardado em estado.

    `useURL` devolve `null` até o sistema entregar o endereço, e esperar é o
    certo: decidir "sem sessão" nesse instante mostraria erro para quem clicou
    num link perfeitamente válido. Só o desfecho da troca de tokens — que é
    assíncrona — precisa de estado.
  */
  // `useMemo` para o objeto sobreviver ao render seguinte: sem ele o efeito
  // abaixo veria uma sessão "nova" a cada desenho e tentaria trocar os tokens
  // em laço.
  const sessao = useMemo(() => (url ? lerSessaoDoLink(url) : null), [url]);
  const erroDoLink = url
    ? (lerErroDoLink(url) ??
      (sessao ? null : 'Não encontrei a confirmação neste link. Peça um novo e tente de novo.'))
    : null;

  const [erroDaTroca, setErroDaTroca] = useState<string | null>(null);
  const erro = erroDoLink ?? erroDaTroca;

  useEffect(() => {
    if (!sessao) return;

    let vivo = true;
    void confirmar(sessao)
      .then(() => {
        if (vivo) router.replace('/(tabs)/home');
      })
      .catch(() => {
        if (vivo) setErroDaTroca('Este link não vale mais. Peça um novo e tente de novo.');
      });
    return () => {
      vivo = false;
    };
  }, [sessao, confirmar, router]);

  return (
    <Screen contentContainerStyle={styles.tela}>
      <BlobBackdrop />
      {erro ? (
        <View style={styles.centro}>
          <Ionicons name="mail-unread-outline" size={40} color={colors.warning} />
          <Text variant="title" center>
            Confirmação não concluída
          </Text>
          <Text variant="body" color={colors.textMuted} center>
            {erro}
          </Text>
          <Button
            title="Voltar para o início"
            onPress={() => router.replace('/(auth)/welcome')}
          />
        </View>
      ) : (
        <View style={styles.centro}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text variant="body" color={colors.textMuted} center>
            Confirmando seu e-mail…
          </Text>
        </View>
      )}
    </Screen>
  );
}

const makeStyles = (_colors: ThemeColors) =>
  StyleSheet.create({
    tela: { flex: 1, justifyContent: 'center', padding: spacing.xl },
    centro: { alignItems: 'center', gap: spacing.base },
  });
