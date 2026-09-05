import { QueryClient } from '@tanstack/react-query';

/**
 * Defaults pensados para mobile: catálogo muda pouco, então cache generoso
 * evita refetch a cada foco de tela (bateria e dados do usuário).
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60 * 5,
        gcTime: 1000 * 60 * 30,
        retry: 2,
        retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: 0,
      },
    },
  });
}
