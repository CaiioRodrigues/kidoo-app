import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import * as SystemUI from 'expo-system-ui';
import { StyleSheet, useColorScheme } from 'react-native';

import { PreferenceKeys, readPreference, writePreference } from '@/lib/preferences';
import {
  darkColors,
  darkPalette,
  lightColors,
  lightPalette,
  type ThemeColors,
  type ThemePalette,
} from './palettes';

/** 'system' acompanha o aparelho; os outros dois são escolha explícita. */
export type ThemeMode = 'system' | 'light' | 'dark';

type ThemeContextValue = {
  colors: ThemeColors;
  palette: ThemePalette;
  isDark: boolean;
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function isThemeMode(value: string | null): value is ThemeMode {
  return value === 'system' || value === 'light' || value === 'dark';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('system');

  // Restaura a preferência salva. Até chegar, vale o tema do sistema — que já
  // é a escolha certa para a maioria, então não há "piscada" incômoda.
  useEffect(() => {
    let active = true;
    void readPreference(PreferenceKeys.themeMode).then((stored) => {
      if (active && isThemeMode(stored)) setModeState(stored);
    });
    return () => {
      active = false;
    };
  }, []);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    void writePreference(PreferenceKeys.themeMode, next);
  }, []);

  const isDark = mode === 'system' ? systemScheme === 'dark' : mode === 'dark';

  const value = useMemo<ThemeContextValue>(
    () => ({
      colors: isDark ? darkColors : lightColors,
      palette: isDark ? darkPalette : lightPalette,
      isDark,
      mode,
      setMode,
    }),
    [isDark, mode, setMode],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme precisa estar dentro de <ThemeProvider>.');
  }
  return context;
}

type StyleFactory<T> = (colors: ThemeColors, palette: ThemePalette) => T;

/**
 * Cria a folha de estilos a partir do tema ativo, recriando-a só quando o tema
 * muda. Sem isso, StyleSheet.create no topo do módulo congelaria as cores do
 * tema que estava ativo no primeiro import.
 */
export function useStyles<T extends StyleSheet.NamedStyles<T>>(factory: StyleFactory<T>): T {
  const { colors, palette } = useTheme();
  return useMemo(() => factory(colors, palette), [factory, colors, palette]);
}

/**
 * Pinta o fundo da própria janela com a cor do tema. Sem isso, o Android
 * mostra um flash branco atrás das telas ao navegar no tema escuro.
 */
export function useSystemUiSync(): void {
  const { colors } = useTheme();

  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(colors.background);
  }, [colors.background]);
}
