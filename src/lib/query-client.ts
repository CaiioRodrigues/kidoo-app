import { QueryClient } from '@tanstack/react-query';

/**
 * O cliente em uso. Guardado aqui porque quem precisa esvaziar o cache é a
 * store de sessão, que vive fora da árvore do React e não alcança o provider.
 */
let cliente: QueryClient | null = null;

/**
 * Defaults pensados para mobile: catálogo muda pouco, então cache generoso
 * evita refetch a cada foco de tela (bateria e dados do usuário).
 */
export function createQueryClient(): QueryClient {
  cliente = new QueryClient({
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
  return cliente;
}

/**
 * Esvazia o cache. Chamado ao entrar e ao sair de uma conta.
 *
 * O cache é por aparelho, não por pessoa: as chaves são `['children']`,
 * `['bookings']`, `['journey', id]` — nenhuma carrega quem está logado. Sem
 * esvaziar, quem entrasse depois veria, por um instante, o nome e a jornada
 * da criança de quem saiu, até a primeira resposta do servidor chegar. Num
 * celular de família isso é aceitável; num aparelho compartilhado, não é.
 */
export function clearQueryCache(): void {
  cliente?.clear();
}
