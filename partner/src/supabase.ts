import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Cliente do painel.
 *
 * A configuração vem das mesmas variáveis do app (`VITE_` aqui, porque o Vite
 * só expõe as com esse prefixo). A anon key é pública por natureza — quem
 * protege os dados é a RLS. A `service_role` nunca entra num bundle de
 * navegador: ela ignora RLS e daria a qualquer visitante o banco inteiro.
 */
const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isConfigured = Boolean(url && anonKey);

let client: SupabaseClient | null = null;

export function supabase(): SupabaseClient {
  if (client) return client;
  if (!url || !anonKey) {
    throw new Error('Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.');
  }

  client = createClient(url, anonKey, {
    auth: {
      /**
       * `sessionStorage`, e não `localStorage`, de propósito.
       *
       * O painel roda num computador de recepção, que costuma ser compartilhado
       * e ficar ligado. Em `localStorage` a sessão sobrevive a fechar o
       * navegador: o próximo turno abriria o painel já logado como quem saiu.
       * Em `sessionStorage` ela morre com a aba — sobrevive ao F5, que é o que
       * dói no dia a dia, e não sobrevive ao fim do expediente.
       */
      storage: window.sessionStorage,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  });
  return client;
}
