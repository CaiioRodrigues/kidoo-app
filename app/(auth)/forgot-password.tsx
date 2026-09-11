import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { BlobBackdrop } from '@/components/brand';
import { HeaderBar } from '@/components/navigation';
import { Button, Card, Input, Screen, Text } from '@/components/ui';
import { fieldErrors, passwordResetRequestSchema } from '@/lib/validation';
import { toUserMessage } from '@/services';
import { useAuthStore } from '@/stores/auth-store';
import { blobRadius, spacing, useStyles, useTheme, type ThemeColors } from '@/theme';

/**
 * Esqueci minha senha.
 *
 * Não existia caminho nenhum: quem esquecia a senha ficava trancado para fora
 * do Kidoo para sempre, sem nada na tela sugerindo saída. Era o defeito mais
 * grave do app, e o mais barato de consertar depois que o envio de e-mail
 * passou a funcionar.
 */
export default function ForgotPasswordScreen() {
  const { colors, palette } = useTheme();
  const styles = useStyles(makeStyles);
  const router = useRouter();
  // Quem veio de "Entrar" com o e-mail já digitado não digita de novo.
  const { email: emailInicial } = useLocalSearchParams<{ email?: string }>();

  const [email, setEmail] = useState(emailInicial ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const enviar = useCallback(async () => {
    const parsed = passwordResetRequestSchema.safeParse({ email: email.trim() });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    setErro(null);
    setEnviando(true);
    try {
      await useAuthStore.getState().requestPasswordReset(parsed.data.email);
      setEnviado(true);
    } catch (caught) {
      setErro(toUserMessage(caught));
    } finally {
      setEnviando(false);
    }
  }, [email]);

  /*
    A mesma tela para e-mail com conta e sem conta.

    Dizer "não encontramos este e-mail" seria simpático e seria um vazamento:
    quem quisesse saber quais endereços têm conta no Kidoo — e portanto quais
    famílias são clientes — bastaria digitar uma lista aqui. Pelo mesmo motivo
    o adapter engole o erro do servidor. A frase é escrita no condicional de
    propósito: ela é verdadeira nos dois casos.
  */
  if (enviado) {
    return (
      <Screen scroll contentContainerStyle={styles.scroll}>
        <BlobBackdrop />
        <HeaderBar />
        <View style={styles.hero}>
          <View style={styles.mark}>
            <Ionicons name="mail-outline" size={38} color={colors.primary} />
          </View>
          <Text variant="title" center>
            Confira seu e-mail
          </Text>
          <Text variant="body" color={colors.textMuted} center>
            Se <Text variant="bodyStrong">{email.trim()}</Text> tiver conta no Kidoo, o link para
            criar uma senha nova já está a caminho.
          </Text>
        </View>

        <Card background={palette.purpleTint} elevation="none" style={styles.why}>
          <Ionicons name="time-outline" size={20} color={colors.primary} />
          <Text variant="caption" color={colors.textMuted} style={styles.flex}>
            O link vale por uma hora e só pode ser usado uma vez. Não achou? Procure na caixa de
            spam antes de pedir outro.
          </Text>
        </Card>

        <View style={styles.actions}>
          <Button title="Voltar para entrar" onPress={() => router.replace('/(auth)/sign-in')} />
          <Button
            title="Mandar de novo"
            variant="secondary"
            onPress={() => {
              setEnviado(false);
              setErro(null);
            }}
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen scroll contentContainerStyle={styles.scroll}>
      <BlobBackdrop />
      <HeaderBar />

      <View style={styles.hero}>
        <View style={styles.mark}>
          <Ionicons name="key-outline" size={38} color={colors.primary} />
        </View>
        <Text variant="title" center>
          Esqueceu a senha?
        </Text>
        <Text variant="body" color={colors.textMuted} center>
          Informe o e-mail da conta e mandamos um link para você escolher outra.
        </Text>
      </View>

      <View style={styles.form}>
        <Input
          label="E-mail"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          error={errors.email}
          onSubmitEditing={() => void enviar()}
          returnKeyType="send"
        />

        {erro ? (
          <Text variant="caption" color={colors.danger} center>
            {erro}
          </Text>
        ) : null}

        <Button title="Mandar o link" loading={enviando} onPress={() => void enviar()} />
        <Button
          title="Lembrei, quero entrar"
          variant="ghost"
          onPress={() => router.replace('/(auth)/sign-in')}
        />
      </View>
    </Screen>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    scroll: { paddingBottom: spacing.xxl },
    hero: { alignItems: 'center', gap: spacing.sm, marginTop: spacing.xl },
    mark: {
      width: 84,
      height: 84,
      backgroundColor: colors.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.sm,
      ...blobRadius.card,
    },
    why: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.md,
      marginTop: spacing.xl,
    },
    flex: { flex: 1 },
    form: { gap: spacing.md, marginTop: spacing.xl },
    actions: { gap: spacing.md, marginTop: spacing.xl },
  });
