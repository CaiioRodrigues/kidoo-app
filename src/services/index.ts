import { mockApi } from './mock';
import { isSupabaseConfigured } from './supabase/client';
import { supabaseApi } from './supabase';
import type { KidooApi } from './types';

/**
 * Ponto único de troca de backend.
 *
 * A escolha é por configuração, não por build: com `EXPO_PUBLIC_SUPABASE_URL` e
 * `EXPO_PUBLIC_SUPABASE_ANON_KEY` definidos, o app fala com o Supabase; sem
 * elas, com o backend em memória.
 *
 * O mock continua sendo o padrão de propósito. É ele que mantém o app
 * navegável para quem clona o repositório e para as revisões visuais — e é o
 * contrato que o adapter real tem de satisfazer, não um rascunho a descartar.
 */
export const api: KidooApi = isSupabaseConfigured ? supabaseApi : mockApi;

/** Qual backend respondeu — usado só para deixar isso explícito na tela de perfil. */
export const backendName = isSupabaseConfigured ? 'supabase' : 'mock';

export { ApiError, toUserMessage } from './errors';
export type { ActivityFilters, KidooApi } from './types';
