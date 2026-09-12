import type { Achievement } from '@/types/domain';

/**
 * Quais conquistas são novas — as que merecem comemoração.
 *
 * O problema que isto resolve: conquista **não tem memória**. Ela é derivada do
 * histórico de aulas (`buildAchievements`), e o `unlockedAt` que sai de lá é
 * sempre "agora", porque ninguém guardou o instante real. Perguntar ao servidor
 * "o que destravou agora?" exigiria reimplementar as regras em SQL, e aí a
 * primeira regra nova acrescentada no TypeScript apareceria na grade sem nunca
 * comemorar — a divergência que `achievements.ts` existe para evitar.
 *
 * Então a memória fica no aparelho: guardamos o que já foi comemorado e
 * comemoramos a diferença. O modo de falhar é perder uma comemoração (telefone
 * novo, app reinstalado), nunca comemorar errado nem duas vezes.
 */
export function conquistasNovas(
  conquistas: Achievement[],
  /** O que já foi comemorado. `null` quando esta criança nunca foi registrada. */
  jaVistas: string[] | null,
): { comemorar: Achievement[]; guardar: string[] } {
  const desbloqueadas = conquistas.filter((c) => c.unlockedAt !== null);
  const ids = desbloqueadas.map((c) => c.id);

  // Primeira vez que olhamos esta criança: ela pode já ter cinco conquistas de
  // antes da atualização, e disparar cinco telas de parabéns em sequência seria
  // uma emboscada. Registramos em silêncio; a próxima é que comemora.
  if (jaVistas === null) return { comemorar: [], guardar: ids };

  const vistas = new Set(jaVistas);
  return {
    comemorar: desbloqueadas.filter((c) => !vistas.has(c.id)),
    // União, e não só o que está desbloqueado agora: se uma regra mudar de
    // limiar e uma conquista "sumir", ela não pode voltar a comemorar depois.
    guardar: [...new Set([...jaVistas, ...ids])],
  };
}

/** Serializa para a preferência. Lista curta de ids — JSON basta. */
export function guardarVistas(ids: string[]): string {
  return JSON.stringify(ids);
}

/**
 * Lê o que foi guardado. `null` significa "não sabemos o que já foi
 * comemorado" e leva ao registro silencioso da primeira vez.
 *
 * Conteúdo corrompido cai no mesmo `null`, de propósito: é exatamente o caso em
 * que não sabemos. Devolver lista vazia aqui faria o app comemorar de uma vez
 * tudo o que a criança já tinha — o modo de falhar que este arquivo inteiro
 * existe para não ter.
 */
export function lerVistas(cru: string | null): string[] | null {
  if (cru === null) return null;
  try {
    const lido: unknown = JSON.parse(cru);
    if (!Array.isArray(lido)) return null;
    return lido.filter((item): item is string => typeof item === 'string');
  } catch {
    return null;
  }
}
