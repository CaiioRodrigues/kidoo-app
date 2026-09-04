import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * Armazenamento de credenciais.
 *
 * Nativo: Keychain (iOS) / EncryptedSharedPreferences via Keystore (Android),
 * com acesso restrito a quando o aparelho está desbloqueado.
 *
 * Web: não há equivalente seguro no browser, então NÃO persistimos nada —
 * a sessão vive só em memória. Guardar token em localStorage o expõe a XSS.
 */
const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

const isNative = Platform.OS === 'ios' || Platform.OS === 'android';

export const SecureKeys = {
  session: 'kidoo.session',
} as const;

export type SecureKey = (typeof SecureKeys)[keyof typeof SecureKeys];

export async function secureGet(key: SecureKey): Promise<string | null> {
  if (!isNative) return null;
  try {
    return await SecureStore.getItemAsync(key, OPTIONS);
  } catch {
    // Item corrompido ou keystore indisponível: trate como "sem sessão".
    return null;
  }
}

export async function secureSet(key: SecureKey, value: string): Promise<void> {
  if (!isNative) return;
  await SecureStore.setItemAsync(key, value, OPTIONS);
}

export async function secureDelete(key: SecureKey): Promise<void> {
  if (!isNative) return;
  try {
    await SecureStore.deleteItemAsync(key, OPTIONS);
  } catch {
    // Apagar algo que não existe não é erro.
  }
}
