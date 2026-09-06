import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * Cliente Supabase.
 *
 * A configuração vem de `EXPO_PUBLIC_SUPABASE_URL` e `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
 * Ambas são públicas por natureza — a anon key vai embutida em qualquer app que
 * fale com o Supabase, e é a RLS que protege os dados, não o segredo da chave.
 * A `service_role` NUNCA entra aqui: ela ignora RLS por design e no bundle
 * daria a qualquer pessoa acesso irrestrito ao banco.
 */
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/** Há configuração suficiente para falar com o Supabase? */
export const isSupabaseConfigured = Boolean(url && anonKey);

const isNative = Platform.OS === 'ios' || Platform.OS === 'android';

/**
 * Onde a sessão do supabase-js é guardada.
 *
 * No aparelho, Keychain/Keystore — o mesmo critério de `@/lib/secure-storage`.
 * No navegador, **nada é persistido**: o refresh token do Supabase é uma
 * credencial de longa duração e localStorage o expõe a XSS. O preço é ter de
 * entrar de novo ao recarregar a página, e é um preço que vale a pena.
 */
const secureStorage = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

let client: SupabaseClient | null = null;

/**
 * Instância única. Criar dois clientes duplicaria o timer de refresh e cada um
 * invalidaria o token do outro.
 */
export function supabase(): SupabaseClient {
  if (client) return client;
  if (!url || !anonKey) {
    throw new Error(
      'Supabase não configurado: defina EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_ANON_KEY.',
    );
  }

  client = createClient(url, anonKey, {
    auth: {
      persistSession: isNative,
      autoRefreshToken: true,
      ...(isNative ? { storage: secureStorage } : {}),
      // O app não usa links mágicos; ler a URL só abriria espaço para um token
      // vindo de fora da nossa navegação.
      detectSessionInUrl: false,
    },
  });

  return client;
}
