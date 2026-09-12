import { useCallback, useEffect, useRef, useState } from 'react';

import { conquistasNovas, guardarVistas, lerVistas } from '@/lib/conquistas-vistas';
import { conquistasVistasKey, readPreference, writePreference } from '@/lib/preferences';
import type { Achievement } from '@/types/domain';

type Fila = {
  /** De quem é esta fila. Trocar de criança não pode mostrar a festa da outra. */
  para: string | null;
  itens: Achievement[];
};

/**
 * A fila de conquistas a comemorar.
 *
 * É fila, e não uma só: uma mesma confirmação pode destravar duas de uma vez —
 * a terceira aula de futebol é "Pequeno craque" e pode ser também a terceira
 * modalidade, que é "Explorador". Duas telas empilhadas seriam um piscar; em
 * fila, cada uma tem o seu momento.
 */
export function useConquistasNovas(childId: string | null, conquistas: Achievement[] | undefined) {
  const [fila, setFila] = useState<Fila>({ para: null, itens: [] });

  /**
   * Tudo que já entrou na fila nesta execução, marcado com a criança a que
   * pertence, e nunca esvaziado.
   *
   * O efeito roda de novo a cada refetch da jornada, e em desenvolvimento o
   * React o executa duas vezes de propósito. Sem esta trava, duas leituras
   * simultâneas veem a preferência antiga antes de qualquer gravação e a mesma
   * conquista entra duas vezes na fila.
   */
  const jaEnfileiradas = useRef(new Set<string>());

  useEffect(() => {
    if (!childId || !conquistas) return;
    let cancelado = false;

    void (async () => {
      const chave = conquistasVistasKey(childId);
      const vistas = lerVistas(await readPreference(chave));
      if (cancelado) return;

      const { comemorar, guardar } = conquistasNovas(conquistas, vistas);

      // Grava antes de mostrar, e não depois. Quem fecha o app no meio da
      // comemoração perde a comemoração — que é o modo de falhar escolhido:
      // melhor uma festa perdida que a mesma festa toda vez que abrir.
      await writePreference(chave, guardarVistas(guardar));
      if (cancelado) return;

      const ineditas = comemorar.filter((c) => !jaEnfileiradas.current.has(`${childId}:${c.id}`));
      if (ineditas.length === 0) return;
      for (const c of ineditas) jaEnfileiradas.current.add(`${childId}:${c.id}`);

      setFila((atual) =>
        atual.para === childId
          ? { para: childId, itens: [...atual.itens, ...ineditas] }
          : { para: childId, itens: ineditas },
      );
    })();

    return () => {
      cancelado = true;
    };
  }, [childId, conquistas]);

  const proxima = useCallback(
    () => setFila((atual) => ({ para: atual.para, itens: atual.itens.slice(1) })),
    [],
  );

  // Lida em vez de zerada num efeito: a fila da criança anterior simplesmente
  // não é dela, e não precisa de um render a mais para desaparecer.
  const atual = fila.para === childId ? (fila.itens[0] ?? null) : null;

  return { atual, proxima };
}
