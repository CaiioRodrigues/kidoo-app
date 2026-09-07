import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { BlobBackdrop } from '@/components/brand';
import { HeaderBar } from '@/components/navigation';
import { Button, Card, Screen, Text } from '@/components/ui';
import { toUserMessage } from '@/services';
import { useAuthStore } from '@/stores/auth-store';
import { blobRadius, spacing, useStyles, useTheme, type ThemeColors } from '@/theme';

/**
 * Confirme seu e-mail.
 *
 * Existe porque a confirmação é obrigatória antes de qualquer família real:
 * sem ela, qualquer pessoa cria conta com o e-mail de outra e passa a receber
 * o que for mandado para aquele endereço. O preço é este passo a mais, e a
 * tela existe para ele não parecer um erro — quem chegou aqui fez tudo certo.
 */
export default function ConfirmEmailScreen() {
  const { colors, palette } = useTheme();
  const styles = useStyles(makeStyles);
  const router = useRouter();
  const { email } = useLocalSearchParams<{ email?: string }>();
  const resend = useAuthStore((state) => state.resendConfirmation);

  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleResend = useCallback(async () => {
    if (!email) return;
    setSending(true);
    setError(null);
    try {
      await resend(email);
      setSent(true);
    } catch (caught) {
      setError(toUserMessage(caught));
    } finally {
      setSending(false);
    }
  }, [email, resend]);

  return (
    <Screen scroll contentContainerStyle={styles.scroll}>
      <BlobBackdrop />
      <HeaderBar />

      <View style={styles.hero}>
        <View style={styles.mark}>
          <Ionicons name="mail-outline" size={38} color={colors.primary} />
        </View>
        <Text variant="title" center>
          Confirme seu e-mail
        </Text>
        <Text variant="body" color={colors.textMuted} center>
          {email
            ? `Enviamos um link para ${email}. Abra a mensagem e toque no link para ativar a conta.`
            : 'Enviamos um link para o seu e-mail. Abra a mensagem e toque no link para ativar a conta.'}
        </Text>
      </View>

      {/* O motivo dito em voz alta: quem entende por que existe o passo tem
          menos chance de achar que o app quebrou e desinstalar. */}
      <Card background={palette.purpleTint} elevation="none" style={styles.why}>
        <Ionicons name="shield-checkmark-outline" size={20} color={colors.primary} />
        <Text variant="caption" color={colors.textMuted} style={styles.flex}>
          É o que garante que ninguém crie uma conta com o seu e-mail. Vale
          principalmente aqui, onde a conta guarda dados do seu filho.
        </Text>
      </Card>

      <View style={styles.actions}>
        <Button
          title="Já confirmei, entrar"
          onPress={() => router.replace('/(auth)/sign-in')}
        />
        <Button
          title={sent ? 'E-mail reenviado' : 'Reenviar e-mail'}
          variant="secondary"
          loading={sending}
          disabled={sent || !email}
          onPress={() => void handleResend()}
        />
        {error ? (
          <Text variant="caption" color={colors.danger} center>
            {error}
          </Text>
        ) : (
          <Text variant="caption" color={colors.textFaint} center>
            Não achou? Procure na caixa de spam — o link vale por 24 horas.
          </Text>
        )}
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
    actions: { gap: spacing.md, marginTop: spacing.xl },
  });
