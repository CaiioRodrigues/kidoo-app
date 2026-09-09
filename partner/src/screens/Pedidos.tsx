import { useState } from 'react';

import { api, type PedidoNaFila } from '@/api';
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
  const { dado: pedidos, carregando, erro, recarregar } = useDados(
    () => api.pedidosPendentes(),
    [],
  );

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
          <CartaoPedido key={p.id} pedido={p} aoDecidir={recarregar} />
        ))}
      </div>
    </>
  );
}

function CartaoPedido({ pedido, aoDecidir }: { pedido: PedidoNaFila; aoDecidir: () => void }) {
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
          {pedido.categories.join(', ')} · de {pedido.minAge} a {pedido.maxAge} anos · pedido em{' '}
          {new Date(pedido.createdAt).toLocaleDateString('pt-BR')}
        </p>

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
