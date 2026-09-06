import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { Avatar, Button, Card, Divider, Screen, Text, ThemePicker } from '@/components/ui';
import { BlobBackdrop } from '@/components/brand';
import { formatAge, formatDaysUntil } from '@/lib/format';
import { daysUntilReset } from '@/lib/subscription';
import { useChildren, useSubscription } from '@/hooks/queries';
import { useAuthStore } from '@/stores/auth-store';
import { spacing, useTheme } from '@/theme';

export default function ProfileScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const session = useAuthStore((state) => state.session);
  const signOut = useAuthStore((state) => state.signOut);
  const { data: children = [] } = useChildren();
  const { data: subscription } = useSubscription();
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = useCallback(() => {
    Alert.alert('Sair da conta', 'Você precisará entrar novamente para acessar o Kidoo.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Sair',
        style: 'destructive',
        onPress: () => {
          setSigningOut(true);
          void signOut().finally(() => {
            setSigningOut(false);
            router.replace('/(auth)/welcome');
          });
        },
      },
    ]);
  }, [router, signOut]);

  return (
    <Screen scroll contentContainerStyle={styles.scroll}>
      <BlobBackdrop height={150} style={styles.backdrop} />

      <View style={styles.header}>
        <Avatar name={session?.guardian.name ?? 'Visitante'} size={64} ring />
        <View style={styles.headerInfo}>
          <Text variant="heading" numberOfLines={1}>
            {session?.guardian.name ?? 'Visitante'}
          </Text>
          <Text variant="caption" color={colors.textMuted} numberOfLines={1}>
            {session?.guardian.email ?? 'Entre para salvar suas preferências'}
          </Text>
        </View>
      </View>

      {subscription ? (
        <Card bordered elevation="none" style={styles.card}>
          <Text variant="label" color={colors.textMuted}>
            Seu plano
          </Text>
          <Text variant="subheading" style={styles.capitalize}>
            {subscription.planId}
          </Text>
          <Text variant="caption" color={colors.textMuted}>
            {subscription.coinsRemaining} de {subscription.coinsPerWeek} coins nesta semana · volta
            ao cheio {formatDaysUntil(daysUntilReset(subscription))}
          </Text>
        </Card>
      ) : null}

      <Text variant="subheading" style={styles.sectionTitle}>
        Crianças
      </Text>
      <Card bordered elevation="none" padded={false}>
        {children.length === 0 ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/(onboarding)/child')}
            style={styles.row}
          >
            <Ionicons name="add-circle-outline" size={22} color={colors.primary} />
            <Text variant="body" color={colors.primary} style={styles.flex}>
              Cadastrar criança
            </Text>
          </Pressable>
        ) : (
          children.map((child, index) => (
            <View key={child.id}>
              {index > 0 ? <Divider /> : null}
              <View style={styles.row}>
                <Avatar name={child.name} uri={child.photoUri} size={40} />
                <View style={styles.flex}>
                  <Text variant="bodyStrong" numberOfLines={1}>
                    {child.name}
                  </Text>
                  <Text variant="caption" color={colors.textMuted}>
                    {formatAge(child.birthDate)} • nível {child.level}
                  </Text>
                </View>
              </View>
            </View>
          ))
        )}
      </Card>

      <Text variant="subheading" style={styles.sectionTitle}>
        Aparência
      </Text>
      <Card bordered elevation="none" style={styles.card}>
        <Text variant="label" color={colors.textMuted}>
          Tema do app
        </Text>
        <ThemePicker />
      </Card>

      <Text variant="subheading" style={styles.sectionTitle}>
        Privacidade
      </Text>
      <Card bordered elevation="none" style={styles.card}>
        <Text variant="caption" color={colors.textMuted}>
          Coletamos apenas o necessário para sugerir atividades adequadas à idade. Você pode pedir a
          exclusão dos dados do seu filho a qualquer momento, conforme a LGPD.
        </Text>
      </Card>

      {session ? (
        <Button
          title="Sair da conta"
          variant="secondary"
          loading={signingOut}
          onPress={handleSignOut}
          style={styles.signOut}
        />
      ) : (
        <Button
          title="Entrar"
          onPress={() => router.push('/(auth)/welcome')}
          style={styles.signOut}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  backdrop: { left: -spacing.xl, right: -spacing.xl },
  scroll: { paddingBottom: spacing.xxl },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.base,
    paddingTop: spacing.base,
  },
  headerInfo: { flex: 1, gap: spacing.xxs },
  sectionTitle: { marginTop: spacing.xl, marginBottom: spacing.md },
  card: { gap: spacing.xs, marginTop: spacing.xl },
  capitalize: { textTransform: 'capitalize' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.base,
  },
  flex: { flex: 1 },
  signOut: { marginTop: spacing.xxl },
});
