import { QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { createQueryClient } from '@/lib/query-client';
import { useAuthStore } from '@/stores/auth-store';
import { ThemeProvider, appFonts, useSystemUiSync, useTheme } from '@/theme';

// Mantém a splash nativa até fontes e sessão estarem prontas: sem "flash" de
// layout com fonte de sistema nem tela de login piscando para quem já entrou.
void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  // O provider precisa envolver quem usa useTheme, por isso a árvore de
  // providers fica aqui e o conteúdo temático vive em <ThemedApp />.
  return (
    <ThemeProvider>
      <ThemedApp />
    </ThemeProvider>
  );
}

function ThemedApp() {
  const { colors, isDark } = useTheme();
  useSystemUiSync();
  // Inicialização preguiçosa: um único QueryClient por montagem do app.
  const [queryClient] = useState(createQueryClient);
  const [fontsLoaded, fontError] = useFonts(appFonts);
  const restore = useAuthStore((state) => state.restore);
  const authStatus = useAuthStore((state) => state.status);

  useEffect(() => {
    void restore();
  }, [restore]);

  const fontsSettled = fontsLoaded || Boolean(fontError);
  const authSettled = authStatus !== 'idle' && authStatus !== 'restoring';
  const ready = fontsSettled && authSettled;

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={[styles.root, { backgroundColor: colors.background }]}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <StatusBar style={isDark ? 'light' : 'dark'} />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.background },
              animation: 'slide_from_right',
            }}
          >
            <Stack.Screen name="index" options={{ animation: 'fade' }} />
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(onboarding)" />
            <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
            <Stack.Screen
              name="activity/[id]"
              options={{ presentation: 'card', animation: 'slide_from_bottom' }}
            />
            <Stack.Screen name="booking/confirm" options={{ presentation: 'modal' }} />
            <Stack.Screen
              name="booking/[id]/check-in"
              options={{ animation: 'fade', gestureEnabled: false }}
            />
            <Stack.Screen name="booking/[id]/review" options={{ presentation: 'modal' }} />
          </Stack>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = { root: { flex: 1 } } as const;
