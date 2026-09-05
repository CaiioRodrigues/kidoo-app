import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * Preferências não sensíveis (hoje só o tema).
 *
 * Reaproveitamos o expo-secure-store por já ser dependência do projeto: evita
 * somar AsyncStorage só para guardar uma string. Não é dado secreto — apenas
 * não vale a pena uma segunda biblioteca de storage por causa dele.
 */
const isNative = Platform.OS === 'ios' || Platform.OS === 'android';

export const PreferenceKeys = {
  themeMode: 'kidoo.pref.themeMode',
  tutorialSeen: 'kidoo.pref.tutorialSeen',
} as const;

type PreferenceKey = (typeof PreferenceKeys)[keyof typeof PreferenceKeys];

export async function readPreference(key: PreferenceKey): Promise<string | null> {
  if (!isNative) return null;
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

export async function writePreference(key: PreferenceKey, value: string): Promise<void> {
  if (!isNative) return;
  try {
    await SecureStore.setItemAsync(key, value);
  } catch {
    // Preferência é conveniência: falhar em salvar não pode quebrar a tela.
  }
}
