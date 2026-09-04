import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native';

import { HeaderBar } from '@/components/navigation';
import { Button, Input, Screen, Text } from '@/components/ui';
import { fieldErrors, signUpSchema } from '@/lib/validation';
import { toUserMessage } from '@/services';
import { useAuthStore } from '@/stores/auth-store';
import { colors, radius, spacing } from '@/theme';

export default function SignUpScreen() {
  const router = useRouter();
  const signUp = useAuthStore((state) => state.signUp);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = useCallback(async () => {
    setFormError(null);
    const parsed = signUpSchema.safeParse({ name, email, password, acceptedTerms });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }

    setErrors({});
    setSubmitting(true);
    try {
      await signUp(parsed.data);
      // Conta criada: segue direto para o cadastro da criança.
      router.replace('/(onboarding)/child');
    } catch (error) {
      setFormError(toUserMessage(error));
    } finally {
      setSubmitting(false);
    }
  }, [acceptedTerms, email, name, password, router, signUp]);

  return (
    <Screen scroll contentContainerStyle={styles.scroll}>
      <HeaderBar />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.intro}>
          <Text variant="title">Criar conta</Text>
          <Text variant="body" color={colors.textMuted}>
            Em poucos passos você começa a explorar atividades perto de casa.
          </Text>
        </View>

        <View style={styles.form}>
          <Input
            label="Seu nome"
            icon="person-outline"
            placeholder="Como podemos te chamar?"
            value={name}
            onChangeText={setName}
            error={errors.name}
            autoComplete="name"
            textContentType="name"
          />
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
          />
          <Input
            label="Senha"
            icon="lock-closed-outline"
            placeholder="Mínimo de 8 caracteres"
            hint="Use letras e números. Evite senhas repetidas de outros apps."
            value={password}
            onChangeText={setPassword}
            error={errors.password}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="new-password"
            textContentType="newPassword"
          />

          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: acceptedTerms }}
            accessibilityLabel="Aceitar termos de uso e política de privacidade"
            onPress={() => setAcceptedTerms((value) => !value)}
            style={styles.terms}
          >
            <View style={[styles.checkbox, acceptedTerms && styles.checkboxChecked]}>
              {acceptedTerms ? (
                <Ionicons name="checkmark" size={14} color={colors.textOnPrimary} />
              ) : null}
            </View>
            <Text variant="caption" color={colors.textMuted} style={styles.termsText}>
              Li e aceito os Termos de Uso e a Política de Privacidade, incluindo o tratamento dos
              dados do meu filho conforme a LGPD.
            </Text>
          </Pressable>

          {errors.acceptedTerms ? (
            <Text variant="caption" color={colors.danger}>
              {errors.acceptedTerms}
            </Text>
          ) : null}
          {formError ? (
            <Text variant="caption" color={colors.danger}>
              {formError}
            </Text>
          ) : null}
        </View>

        <View style={styles.actions}>
          <Button title="Criar conta" loading={submitting} onPress={() => void handleSubmit()} />
          <Button
            title="Já tenho conta"
            variant="ghost"
            size="md"
            onPress={() => router.replace('/(auth)/sign-in')}
          />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.xxl },
  intro: { gap: spacing.sm, paddingTop: spacing.base },
  form: { gap: spacing.base, marginTop: spacing.xxl },
  terms: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, marginTop: spacing.xs },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkboxChecked: { backgroundColor: colors.primary, borderColor: colors.primary },
  termsText: { flex: 1 },
  actions: { gap: spacing.sm, marginTop: spacing.xxl },
});
