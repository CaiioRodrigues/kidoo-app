import { useState } from 'react';

import { api, type CapaNaFila } from '@/api';
import { Card, Erro, Vazio, useDados } from '@/components/ui';

/**
 * A fila de capas esperando análise.
 *
 * A capa vai para bucket público e aparece no cartão que toda família vê. Até
 * a 000028 o parceiro trocava e a imagem estava no ar no mesmo segundo, sem
 * ninguém olhar — num app para criança, era a única coisa que ia ao ar sem
 * revisão.
 *
 * Só aparece para quem está em `kidoo_admins`, como a fila de pedidos.
 */
export function Capas() {
  const { dado: capas, carregando, erro, recarregar } = useDados(() => api.capasPendentes(), []);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Capas em análise</h1>
          <p className="page-sub">
            Imagens que os estabelecimentos enviaram. Aprovar publica no catálogo; até lá, a
            família continua vendo a capa anterior.
          </p>
        </div>
      </div>

      {erro && <Erro>{erro}</Erro>}
      {carregando && !capas && (
        <Card>
          <p className="muted">Carregando capas…</p>
        </Card>
      )}

      {capas && capas.length === 0 && (
        <Card>
          <Vazio marca="🖼️">
            <h3>Nenhuma capa esperando</h3>
            <p className="muted" style={{ marginTop: 6 }}>
              Quando um estabelecimento trocar a imagem de uma turma, ela aparece aqui.
            </p>
          </Vazio>
        </Card>
      )}

      <div className="stack">
        {capas?.map((c) => (
          <CartaoDaCapa key={c.activityId} capa={c} aoDecidir={recarregar} />
        ))}
      </div>
    </>
  );
}

function CartaoDaCapa({ capa, aoDecidir }: { capa: CapaNaFila; aoDecidir: () => void }) {
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
          <h3>{capa.activity}</h3>
          <span className="badge badge-espera">esperando</span>
        </div>
        <p className="faint">
          {capa.partner} · enviada em {new Date(capa.sentAt).toLocaleDateString('pt-BR')}
        </p>

        {/* As duas lado a lado, e não só a nova: julgar uma capa sem ver a
            atual é julgar metade. O que se decide é se ela pode SUBSTITUIR
            aquela — uma imagem sem graça pode ser melhor que a de agora, e
            uma bonita pode não ter nada a ver com a turma. */}
        <div className="row" style={{ gap: 16, alignItems: 'flex-start', marginTop: 14, flexWrap: 'wrap' }}>
          <Lado titulo="No ar hoje" url={capa.currentUrl} vaziaDiz="Ainda sem capa" />
          <Lado titulo="Enviada" url={capa.pendingUrl} destaque />
        </div>

        {erro && (
          <div style={{ marginTop: 12 }}>
            <Erro>{erro}</Erro>
          </div>
        )}

        {recusando ? (
          <div style={{ marginTop: 14 }}>
            <div className="field">
              <label htmlFor={`motivo-capa-${capa.activityId}`}>Por que não dá para publicar</label>
              <input
                id={`motivo-capa-${capa.activityId}`}
                className="input"
                maxLength={200}
                placeholder="A imagem não mostra o espaço da turma."
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
              />
            </div>
            <p className="faint" style={{ marginTop: 6 }}>
              Este texto aparece no painel de quem enviou. Sem ele, a mesma imagem volta.
            </p>
            <div className="row" style={{ gap: 10, marginTop: 12 }}>
              <button
                className="btn btn-perigo"
                disabled={motivo.trim().length < 5 || ocupado}
                onClick={() => void decidir(() => api.recusarCapa(capa.activityId, motivo))}
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
              onClick={() => void decidir(() => api.aprovarCapa(capa.activityId))}
            >
              {ocupado ? 'Publicando…' : 'Publicar esta capa'}
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

function Lado({
  titulo,
  url,
  destaque,
  vaziaDiz,
}: {
  titulo: string;
  url: string | null;
  destaque?: boolean;
  vaziaDiz?: string;
}) {
  const caixa = { width: 220, height: 150, flex: 'none' as const, borderRadius: 10 };
  return (
    <div>
      <p className="faint" style={{ margin: '0 0 6px', fontSize: 12 }}>
        {titulo}
      </p>
      {url ? (
        <a href={url} target="_blank" rel="noopener noreferrer" title="Abrir em tamanho real">
          <img
            src={url}
            alt={titulo}
            style={{
              ...caixa,
              objectFit: 'cover',
              background: 'var(--card-muted)',
              display: 'block',
              // A enviada é a que está em julgamento: a borda diz qual é sem
              // precisar reler os rótulos a cada cartão.
              outline: destaque ? '2px solid var(--purple)' : 'none',
              outlineOffset: 2,
            }}
          />
        </a>
      ) : (
        <div
          style={{
            ...caixa,
            border: '1.5px dashed var(--border)',
            display: 'grid',
            placeItems: 'center',
          }}
        >
          <span className="faint" style={{ fontSize: 12 }}>
            {vaziaDiz}
          </span>
        </div>
      )}
    </div>
  );
}
