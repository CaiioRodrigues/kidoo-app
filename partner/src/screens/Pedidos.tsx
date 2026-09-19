import { useState } from 'react';

import { api, type Categoria, type PedidoNaFila } from '@/api';
import { Card, Erro, Vazio, useDados } from '@/components/ui';

/**
 * A fila de quem analisa.
 *
 * Só aparece para quem está em `kidoo_admins` — e essa lista não tem tela de
 * edição de propósito: quem entra nela decide quem vira "parceiro verificado"
 * e quem passa a receber repasse. Uma tela para editá-la seria uma tela para
 * escalar privilégio.
 */
export function Pedidos() {
  const {
    dado: pedidos,
    carregando,
    erro,
    recarregar,
  } = useDados(() => api.pedidosPendentes(), []);
  // Os nomes das modalidades. Sem eles a tela mostrava o id cru — "ginastica",
  // sem acento, que parece dado corrompido para quem está decidindo.
  const { dado: categorias } = useDados(() => api.categorias(), []);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Pedidos de cadastro</h1>
          <p className="page-sub">
            Estabelecimentos esperando análise. Aprovar cria o parceiro, o vínculo de dono, uma
            atividade por modalidade e o repasse padrão.
          </p>
        </div>
      </div>

      {erro && <Erro>{erro}</Erro>}
      {carregando && !pedidos && (
        <Card>
          <p className="muted">Carregando pedidos…</p>
        </Card>
      )}

      {pedidos && pedidos.length === 0 && (
        <Card>
          <Vazio marca="📋">
            <h3>Nenhum pedido esperando</h3>
            <p className="muted" style={{ marginTop: 6 }}>
              Quando um estabelecimento se cadastrar, ele aparece aqui.
            </p>
          </Vazio>
        </Card>
      )}

      <div className="stack">
        {pedidos?.map((p) => (
          <CartaoPedido
            key={p.id}
            pedido={p}
            categorias={categorias ?? []}
            aoDecidir={recarregar}
          />
        ))}
      </div>
    </>
  );
}

function CartaoPedido({
  pedido,
  categorias,
  aoDecidir,
}: {
  pedido: PedidoNaFila;
  categorias: Categoria[];
  aoDecidir: () => void;
}) {
  const [motivo, setMotivo] = useState('');
  const [recusando, setRecusando] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const decidir = async (fn: () => Promise<void>) => {
    setOcupado(true);
    setErro(null);
    try {
      await fn();
      aoDecidir();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível decidir agora.');
    } finally {
      setOcupado(false);
    }
  };

  return (
    <section className="card">
      <div className="card-pad">
        {/* A foto e os dados lado a lado, e a foto primeiro na ordem de
            leitura: o formulário diz o que o estabelecimento afirma ser, e a
            foto é a única parte do pedido que mostra onde a criança vai ficar.
            `flexWrap` porque numa janela estreita duas colunas de 260px não
            cabem — aí a foto sobe e o texto desce, em vez de espremer as duas. */}
        <div className="row" style={{ gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <FotoDoEspaco nome={pedido.name} url={pedido.photoUrl} />

          <div style={{ flex: '1 1 260px', minWidth: 0 }}>
            <div className="row" style={{ gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
              <h3>{pedido.name}</h3>
              <span className="badge badge-espera">esperando</span>
            </div>
            <p className="faint">
              {pedido.address} · {pedido.neighborhood}, {pedido.city}
            </p>
            <p className="faint" style={{ marginTop: 4 }}>
              {pedido.phone} · {pedido.email}
              {pedido.cnpj ? ` · CNPJ ${pedido.cnpj}` : ' · sem CNPJ informado'}
            </p>
            <p className="faint" style={{ marginTop: 4 }}>
              {/* Cai no id se a lista ainda não chegou: melhor "judo" do que um
                  traço no lugar da modalidade que ele quer oferecer. */}
              {pedido.categories
                .map((id) => categorias.find((c) => c.id === id)?.label ?? id)
                .join(', ')}{' '}
              · de {pedido.minAge} a {pedido.maxAge} anos · pedido em{' '}
              {new Date(pedido.createdAt).toLocaleDateString('pt-BR')}
            </p>
          </div>
        </div>

        {erro && (
          <div style={{ marginTop: 12 }}>
            <Erro>{erro}</Erro>
          </div>
        )}

        {recusando ? (
          <div style={{ marginTop: 14 }}>
            <div className="field">
              <label htmlFor={`motivo-${pedido.id}`}>Por que não dá para aprovar</label>
              <input
                id={`motivo-${pedido.id}`}
                className="input"
                maxLength={200}
                placeholder="O endereço não confere com o CNPJ."
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
              />
            </div>
            {/* O motivo é obrigatório no banco, e a tela diz por quê: sem ele o
                candidato reenvia exatamente o mesmo pedido. */}
            <p className="faint" style={{ marginTop: 6 }}>
              Este texto aparece para quem pediu, com o formulário já preenchido para corrigir.
            </p>
            <div className="row" style={{ gap: 10, marginTop: 12 }}>
              <button
                className="btn btn-perigo"
                disabled={motivo.trim().length < 5 || ocupado}
                onClick={() => void decidir(() => api.recusarPedido(pedido.id, motivo))}
              >
                {ocupado ? 'Enviando…' : 'Recusar com este motivo'}
              </button>
              <button className="btn btn-ghost" onClick={() => setRecusando(false)}>
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <div className="row" style={{ gap: 10, marginTop: 16 }}>
            <button
              className="btn"
              disabled={ocupado}
              onClick={() => void decidir(() => api.aprovarPedido(pedido.id))}
            >
              {ocupado ? 'Aprovando…' : 'Aprovar estabelecimento'}
            </button>
            <button className="btn btn-ghost" onClick={() => setRecusando(true)}>
              Recusar
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

/**
 * A foto do espaço, do tamanho de quem decide com ela.
 *
 * O link abre o original em outra aba porque 220px não bastam para julgar um
 * tatame, uma piscina ou uma sala — a miniatura diz se vale abrir, e o clique
 * abre. `rel="noopener noreferrer"` porque o destino é conteúdo enviado por
 * quem ainda não é parceiro: sem isso, a página aberta ganha referência à
 * aba do painel por `window.opener`.
 *
 * Sem foto, uma caixa que diz isso. Um buraco no lugar da imagem parece falha
 * de carregamento, e quem analisa ficaria recarregando à espera de algo que
 * nunca foi enviado.
 */
function FotoDoEspaco({ nome, url }: { nome: string; url: string | null }) {
  const caixa = {
    width: 220,
    height: 150,
    flex: 'none' as const,
    borderRadius: 10,
  };

  if (!url) {
    return (
      <div
        style={{
          ...caixa,
          border: '1.5px dashed var(--border)',
          display: 'grid',
          placeItems: 'center',
          textAlign: 'center',
          padding: 12,
        }}
      >
        <span className="faint" style={{ fontSize: 12 }}>
          Pedido enviado sem foto do espaço
        </span>
      </div>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      style={caixa}
      title="Abrir em tamanho real"
    >
      <img
        src={url}
        alt={`Espaço de ${nome}`}
        // Fundo e `objectFit`: a URL é assinada e expira em uma hora, então
        // uma aba deixada aberta a manhã inteira vai mesmo cair aqui — e o
        // que ela mostra é uma caixa cinza, não o texto alternativo esticando
        // a linha e empurrando os botões de decisão para fora do lugar.
        style={{ ...caixa, objectFit: 'cover', background: 'var(--card-muted)', display: 'block' }}
      />
    </a>
  );
}
