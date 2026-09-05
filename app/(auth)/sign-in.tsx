import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';

import { HeaderBar } from '@/components/navigation';
import { Button, Input, Screen, Text } from '@/components/ui';
import { fieldErrors, signInSchema } from '@/lib/validation';
import { toUserMessage } from '@/services';
import { useAuthStore } from '@/stores/auth-store';
import { spacing, useTheme } from '@/theme';

export default function SignInScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const signIn = useAuthStore((state) => state.signIn);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = useCallback(async () => {
    setFormError(null);
    const parsed = signInSchema.safeParse({ email, password });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }

    setErrors({});
    setSubmitting(true);
    try {
      await signIn(parsed.data);
      router.replace('/(tabs)/home');
    } catch (error) {
      setFormError(toUserMessage(error));
    } finally {
      setSubmitting(false);
    }
  }, [email, password, router, signIn]);

  return (
    <Screen scroll contentContainerStyle={styles.scroll}>
      <HeaderBar />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.content}>
          <View style={styles.intro}>
            <Text variant="title">Que bom te ver!</Text>
            <Text variant="body" color={colors.textMuted}>
              Entre para continuar acompanhando as aventuras do seu pequeno.
            </Text>
          </View>

          <View style={styles.form}>
            <Input
              label="E-mail"
              icon="mail-outline"
              placeholder="voce@email.com"
              value={email}
              onChangeText={setEmail}
              error={errors.email}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              textContentType="emailAddress"
              returnKeyType="next"
            />
            <Input
              label="Senha"
              icon="lock-closed-outline"
              placeholder="Sua senha"
              value={password}
              onChangeText={setPassword}
              error={errors.password}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="current-password"
              textContentType="password"
              returnKeyType="done"
              onSubmitEditing={() => void handleSubmit()}
            />

            {formError ? (
              <Text variant="caption" color={colors.danger}>
                {formError}
              </Text>
            ) : null}
          </View>

          <View style={styles.actions}>
            <Button title="Entrar" loading={submitting} onPress={() => void handleSubmit()} />
            <Button
              title="Ainda não tenho conta"
              variant="ghost"
              size="md"
              onPress={() => router.replace('/(auth)/sign-up')}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  // flexGrow mantém o `marginTop: 'auto'` do bloco de botões funcionando
  // quando sobra espaço, e libera a rolagem quando falta.
  scroll: { flexGrow: 1 },
  flex: { flex: 1 },
  content: { flex: 1, gap: spacing.xxl, paddingTop: spacing.base },
  intro: { gap: spacing.sm },
  form: { gap: spacing.base },
  actions: { marginTop: 'auto', gap: spacing.sm, paddingBottom: spacing.base },
});
