import { demoApi } from './demo';
import { supabaseApi } from './supabase';
import type { PainelApi } from './types';
import { isConfigured } from '@/supabase';

/**
 * Ponto único de troca de backend, igual ao do app.
 *
 * Com `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` definidos, o painel fala
 * com o Supabase. Sem elas, roda a demonstração em memória — para o painel ser
 * clicável e revisável antes de existir um projeto.
 */
export const api: PainelApi = isConfigured ? supabaseApi : demoApi;

export const emDemonstracao = !isConfigured;

export { PainelError } from './types';
export type {
  ActivityRow,
  AgendaRow,
  PainelApi,
  Partner,
  RosterRow,
  StatementRow,
} from './types';
