import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { KidooLogo, Sparkles } from '@/components/brand';
import { CategoryIcon } from '@/components/CategoryIcon';
import { Button, Screen, Text } from '@/components/ui';
import { blobRadius, categoryTone, spacing, useStyles, useTheme, type ThemeColors } from '@/theme';
import type { ActivityCategoryId } from '@/types/domain';

/** Amostra das modalidades — o degrau de cada tile quebra a régua reta. */
const CATEGORY_TEASERS: { id: ActivityCategoryId; lift: number }[] = [
  { id: 'futebol', lift: 0 },
  { id: 'natacao', lift: -10 },
  { id: 'judo', lift: 6 },
  { id: 'danca', lift: -4 },
];

/** Tela 2 — Login / Cadastro. */
export default function WelcomeScreen() {
  const { colors, isDark } = useTheme();
  const styles = useStyles(makeStyles);
  const router = useRouter();

  return (
    <Screen background={colors.background} scroll contentContainerStyle={styles.scroll}>
      <View style={styles.container}>
        <Animated.View entering={FadeInDown.duration(420)} style={styles.brand}>
          <Sparkles style={styles.sparkles} />
          <KidooLogo size={52} />
          <Text variant="heading" center color={colors.text} style={styles.headline}>
            O mundo de atividades{'\n'}para o seu pequeno!
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(120).duration(420)} style={styles.teasers}>
          {CATEGORY_TEASERS.map((teaser, index) => (
            <View
              key={teaser.id}
              style={[
                styles.teaser,
                index % 2 === 0 ? blobRadius.tile : blobRadius.cardAlt,
                {
                  backgroundColor: categoryTone(teaser.id, isDark).soft,
                  transform: [{ translateY: teaser.lift }],
                },
              ]}
            >
              <CategoryIcon category={teaser.id} size={30} />
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

const makeStyles = (_colors: ThemeColors) =>
  StyleSheet.create({
    scroll: { flexGrow: 1 },
    container: { flex: 1, justifyContent: 'space-between', paddingVertical: spacing.xxl },
    brand: { alignItems: 'center', gap: spacing.base, marginTop: spacing.xxl },
    sparkles: { marginBottom: spacing.xs },
    headline: { marginTop: spacing.sm },
    teasers: { flexDirection: 'row', justifyContent: 'center', gap: spacing.base },
    teaser: {
      width: 62,
      height: 62,
      alignItems: 'center',
      justifyContent: 'center',
    },
    actions: { gap: spacing.md },
    legal: { marginTop: spacing.sm, paddingHorizontal: spacing.base },
  });
