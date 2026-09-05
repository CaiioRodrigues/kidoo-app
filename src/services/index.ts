import { mockApi } from './mock';
import type { KidooApi } from './types';

/**
 * Ponto único de troca de backend. Quando a API real existir, crie
 * `src/services/http/index.ts` implementando `KidooApi` e selecione aqui por env.
 */
export const api: KidooApi = mockApi;

export { ApiError, toUserMessage } from './errors';
export type { ActivityFilters, KidooApi } from './types';
