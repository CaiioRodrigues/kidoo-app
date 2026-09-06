import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { KidooLogo, Sparkles } from '@/components/brand';
import { Text } from '@/components/ui';
import { useAuthStore } from '@/stores/auth-store';
import { spacing, useStyles, type ThemeColors, type ThemePalette } from '@/theme';

/**
 * Tempo da abertura da marca.
 *
 * A animação da logo e a tagline entram em cascata até ~750 ms; em 1,2 s a
 * tela saía quase junto com o fim da entrada, e a marca mal era lida. Segurar
 * até 3,2 s dá tempo de ver a frase inteira antes do corte.
 */
const BRAND_HOLD_MS = 3200;

/**
 * Tela 1 — Splash / Abertura.
 * A splash nativa cobre o carregamento de fontes e sessão; esta tela é a
 * continuação animada da marca e decide para onde o usuário vai.
 */
export default function SplashRoute() {
  const styles = useStyles(makeStyles);
  const status = useAuthStore((state) => state.status);
  const [holdFinished, setHoldFinished] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setHoldFinished(true), BRAND_HOLD_MS);
    return () => clearTimeout(timer);
  }, []);

  if (holdFinished) {
    return status === 'authenticated' ? (
      <Redirect href="/(tabs)/home" />
    ) : (
      <Redirect href="/(auth)/welcome" />
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.blob, styles.blobTop]} />
      <View style={[styles.blob, styles.blobBottom]} />

      <Animated.View entering={FadeIn.duration(500)} style={styles.center}>
        <Sparkles style={styles.sparkles} />
        <KidooLogo size={54} onDark />
        <Animated.View entering={FadeInDown.delay(250).duration(500)}>
          <Text variant="label" color="rgba(255,255,255,0.9)" center style={styles.tagline}>
            DESCUBRA. BRINQUE. MOVIMENTE-SE.
          </Text>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const makeStyles = (colors: ThemeColors, palette: ThemePalette) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    center: { alignItems: 'center', gap: spacing.md },
    sparkles: { marginBottom: spacing.xs },
    tagline: { letterSpacing: 2, marginTop: spacing.xs },
    blob: { position: 'absolute', borderRadius: 999, opacity: 0.35 },
    blobTop: {
      width: 260,
      height: 260,
      top: -90,
      right: -70,
      backgroundColor: palette.purpleDark,
    },
    blobBottom: {
      width: 320,
      height: 320,
      bottom: -120,
      left: -110,
      backgroundColor: palette.purpleDark,
    },
  });
