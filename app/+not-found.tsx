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
        <Text style={styles.emoji}>🧭</Text>
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
    emoji: { fontSize: 48 },
    link: { marginTop: spacing.base },
  });
