import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { KidooLogo, Sparkles } from '@/components/brand';
import { Button, Screen, Text } from '@/components/ui';
import { colors, palette, radius, spacing } from '@/theme';

const CATEGORY_TEASERS = ['⚽', '🏊', '🥋', '🩰'];

/** Tela 2 — Login / Cadastro. */
export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <Screen background={colors.background}>
      <View style={styles.container}>
        <Animated.View entering={FadeInDown.duration(420)} style={styles.brand}>
          <Sparkles style={styles.sparkles} />
          <KidooLogo size={52} />
          <Text variant="heading" center color={colors.text} style={styles.headline}>
            O mundo de atividades{'\n'}para o seu pequeno!
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(120).duration(420)} style={styles.teasers}>
          {CATEGORY_TEASERS.map((emoji) => (
            <View key={emoji} style={styles.teaser}>
              <Text style={styles.teaserEmoji}>{emoji}</Text>
            </View>
          ))}
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(220).duration(420)} style={styles.actions}>
          <Button title="Criar conta" onPress={() => router.push('/(auth)/sign-up')} />
          <Button
            title="Entrar"
            variant="secondary"
            onPress={() => router.push('/(auth)/sign-in')}
          />
          <Button
            title="Continuar como visitante"
            variant="ghost"
            size="md"
            haptic={false}
            onPress={() => router.replace('/(tabs)/home')}
          />
          <Text variant="caption" color={colors.textFaint} center style={styles.legal}>
            Ao continuar você concorda com os Termos de Uso e com a Política de Privacidade do
            Kidoo.
          </Text>
        </Animated.View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'space-between', paddingVertical: spacing.xxl },
  brand: { alignItems: 'center', gap: spacing.base, marginTop: spacing.xxl },
  sparkles: { marginBottom: spacing.xs },
  headline: { marginTop: spacing.sm },
  teasers: { flexDirection: 'row', justifyContent: 'center', gap: spacing.base },
  teaser: {
    width: 62,
    height: 62,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.purpleTint,
  },
  teaserEmoji: { fontSize: 28, lineHeight: 34 },
  actions: { gap: spacing.md },
  legal: { marginTop: spacing.sm, paddingHorizontal: spacing.base },
});
