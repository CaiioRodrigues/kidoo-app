import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

import type { SlotKind } from '@app/types/domain';

export function Card({ children, pad = true }: { children: ReactNode; pad?: boolean }) {
  return <section className="card">{pad ? <div className="card-pad">{children}</div> : children}</section>;
}

export function Vazio({ marca, children }: { marca: string; children: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty-mark" aria-hidden="true">
        {marca}
      </div>
      {children}
    </div>
  );
}

/**
 * A etiqueta traz sempre o rótulo escrito, nunca só a cor: quem não distingue
 * verde de roxo precisa da mesma informação.
 */
export function EtiquetaVaga({ kind }: { kind: SlotKind }) {
  return (
    <span className={kind === 'ociosa' ? 'badge badge-ociosa' : 'badge badge-cheia'}>
      {kind === 'ociosa' ? 'Vaga ociosa' : 'Vaga cheia'}
    </span>
  );
}

export function Erro({ children }: { children: ReactNode }) {
  return (
    <div className="alert alert-erro" role="alert">
      {children}
    </div>
  );
}

/**
 * Carrega dados assíncronos.
 *
 * Guarda três estados de propósito — carregando, erro e dado — porque a tela
 * precisa distinguir "ainda não sei" de "sei que não há nada". Sem essa
 * distinção, uma agenda vazia e uma agenda que falhou de carregar ficam
 * idênticas, e o parceiro conclui que ninguém vem hoje.
 */
export function useDados<T>(
  carregar: () => Promise<T>,
  deps: unknown[],
): { dado: T | null; carregando: boolean; erro: string | null; recarregar: () => void } {
  const [dado, setDado] = useState<T | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [gatilho, setGatilho] = useState(0);
  const refCarregar = useRef(carregar);
  refCarregar.current = carregar;

  useEffect(() => {
    let vivo = true;
    setCarregando(true);
    setErro(null);
    refCarregar
      .current()
      .then((valor) => {
        // Uma resposta que chega depois da tela mudar não pode sobrescrever a
        // nova: sem esta guarda, trocar de dia rápido mostra o dia anterior.
        if (vivo) setDado(valor);
      })
      .catch((e: unknown) => {
        if (vivo) setErro(e instanceof Error ? e.message : 'Algo deu errado.');
      })
      .finally(() => {
        if (vivo) setCarregando(false);
      });
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, gatilho]);

  const recarregar = useCallback(() => setGatilho((n) => n + 1), []);
  return { dado, carregando, erro, recarregar };
}
