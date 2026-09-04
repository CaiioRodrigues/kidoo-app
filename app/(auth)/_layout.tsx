import { Redirect, Stack } from 'expo-router';

import { useAuthStore } from '@/stores/auth-store';
import { colors } from '@/theme';

export default function AuthLayout() {
  const status = useAuthStore((state) => state.status);

  // Quem já tem sessão válida nunca vê as telas de entrada.
  if (status === 'authenticated') return <Redirect href="/(tabs)/home" />;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    />
  );
}
