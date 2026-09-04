import { Redirect, Stack } from 'expo-router';

import { useAuthStore } from '@/stores/auth-store';
import { colors } from '@/theme';

export default function OnboardingLayout() {
  const status = useAuthStore((state) => state.status);

  // Cadastro de criança exige responsável autenticado.
  if (status !== 'authenticated') return <Redirect href="/(auth)/welcome" />;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        animation: 'slide_from_right',
      }}
    />
  );
}
