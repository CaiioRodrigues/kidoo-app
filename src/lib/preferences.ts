import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * Preferências não sensíveis: tema, tutorial visto, dicas já dispensadas.
 *
 * No aparelho reaproveitamos o expo-secure-store por já ser dependência do
 * projeto: evita somar AsyncStorage só para guardar uma string. Não é dado
 * secreto — apenas não vale uma segunda biblioteca de storage por causa dele.
 */
const isNative = Platform.OS === 'ios' || Platform.OS === 'android';

export const PreferenceKeys = {
  themeMode: 'kidoo.pref.themeMode',
  tutorialSeen: 'kidoo.pref.tutorialSeen',
  /** Dica contextual da tela de check-in, mostrada uma vez. */
  hintCheckIn: 'kidoo.pref.hint.checkIn',
} as const;

type PreferenceKey = (typeof PreferenceKeys)[keyof typeof PreferenceKeys];

/**
 * Espelho em memória do que já foi lido ou escrito nesta execução.
 *
 * É o que garante que "já vi o tutorial" continue valendo quando a tela
 * remonta, mesmo que a gravação no disco falhe. Sem isso, uma falha silenciosa
 * do armazenamento reapresenta o tutorial a cada remontagem — e como ninguém vê
 * o erro, o sintoma parece aleatório.
 */
const cache = new Map<PreferenceKey, string | null>();

function readFromStorage(key: PreferenceKey): Promise<string | null> {
  if (isNative) return SecureStore.getItemAsync(key);
  // No navegador não há SecureStore. localStorage não serve para segredo, mas
  // preferência não é segredo — e sem ele o tutorial reaparecia a cada carga.
  return Promise.resolve(globalThis.localStorage?.getItem(key) ?? null);
}

function writeToStorage(key: PreferenceKey, value: string): Promise<void> {
  if (isNative) return SecureStore.setItemAsync(key, value);
  globalThis.localStorage?.setItem(key, value);
  return Promise.resolve();
}

export async function readPreference(key: PreferenceKey): Promise<string | null> {
  const cached = cache.get(key);
  if (cached !== undefined) return cached;

  try {
    const value = await readFromStorage(key);
    cache.set(key, value);
    return value;
  } catch {
    // Não guarda em cache: a próxima leitura tenta de novo.
    return null;
  }
}

export async function writePreference(key: PreferenceKey, value: string): Promise<void> {
  // O cache é atualizado antes de tocar no disco, e de propósito: a decisão do
  // usuário vale para esta execução mesmo que a gravação falhe.
  cache.set(key, value);
  try {
    await writeToStorage(key, value);
  } catch {
    // Preferência é conveniência: falhar em salvar não pode quebrar a tela.
  }
}
