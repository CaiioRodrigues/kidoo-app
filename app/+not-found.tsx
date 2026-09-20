import { Ionicons } from '@expo/vector-icons';
import { Link, Stack } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { spacing, useStyles, useTheme, type ThemeColors } from '@/theme';

export default function NotFoundScreen() {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  return (
    <>
      <Stack.Screen options={{ title: 'Ops!' }} />
      <View style={styles.container}>
        {/* Bússola da fonte de ícones, e não o emoji 🧭: ele é Emoji 11.0, e
            em Android 8 ou anterior a tela de "não existe" abria com um
            quadrado vazio — um erro em cima do outro. */}
        <Ionicons name="compass-outline" size={48} color={colors.primary} />
        <Text variant="heading" center>
          Essa tela não existe
        </Text>
        <Link href="/" style={styles.link}>
          <Text variant="bodyStrong" color={colors.primary}>
            Voltar para o início
          </Text>
        </Link>
      </View>
    </>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.md,
      padding: spacing.xl,
      backgroundColor: colors.background,
    },
    link: { marginTop: spacing.base },
  });
