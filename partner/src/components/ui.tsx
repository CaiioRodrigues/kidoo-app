import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';

import logo from '@/assets/logo.webp';
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

/**
 * A marca, com o papel de quem está vendo embaixo.
 *
 * Era um quadrado roxo com um "K" desenhado em CSS — um substituto que existia
 * porque o logotipo não existia em arquivo. Agora existe, e é ele que aparece
 * no app, no material impresso e aqui: três lugares com a mesma marca em vez
 * de três aproximações dela.
 *
 * `alt` traz só "Kidoo": o papel logo abaixo é texto de verdade, e repeti-lo
 * na imagem faria o leitor de tela anunciar a mesma coisa duas vezes.
 */
export function Marca({
  papel = 'Painel do parceiro',
  style,
}: {
  papel?: string;
  style?: CSSProperties;
}) {
  return (
    <div className="brand" style={style}>
      <img className="brand-logo" src={logo} alt="Kidoo" width={273} height={112} />
      {/* Sem papel, sem linha: no rodapé a frase logo abaixo já diz o que o
          Kidoo é, e repetir "Para estabelecimentos" ali seria dizer duas vezes. */}
      {papel ? <span className="brand-role">{papel}</span> : null}
    </div>
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
