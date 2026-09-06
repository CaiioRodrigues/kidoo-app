import { api, type StatementRow } from '@/api';
import { Card, Erro, Vazio, useDados } from '@/components/ui';
import { mes, reais } from '@/format';

/**
 * Extrato de repasse.
 *
 * A tela existe para provar um número: quanto a vaga que antes ficava vazia
 * rendeu. Por isso separa ociosa de cheia em vez de somar tudo — a soma
 * esconderia justamente o que o parceiro precisa ver para abrir mais vagas.
 *
 * Só presença **confirmada por ele** entra aqui. "O app diz que veio" não paga.
 */
export function Repasse() {
  const { dado: linhas, carregando, erro } = useDados(() => api.extrato(6), []);

  const meses = agrupar(linhas ?? []);
  const totalGeral = (linhas ?? []).reduce((soma, l) => soma + l.totalCents, 0);
  const ociosaGeral = (linhas ?? [])
    .filter((l) => l.kind === 'ociosa')
    .reduce((soma, l) => soma + l.totalCents, 0);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Repasse</h1>
          <p className="page-sub">
            Últimos 6 meses. Conta só a presença que você confirmou pelo código.
          </p>
        </div>
      </div>

      {erro && <Erro>{erro}</Erro>}
      {carregando && !linhas && (
        <Card>
          <p className="muted">Carregando extrato…</p>
        </Card>
      )}

      {linhas && linhas.length === 0 && (
        <Card>
          <Vazio marca="📄">
            <h3>Nenhum repasse ainda</h3>
            <p className="muted" style={{ marginTop: 6 }}>
              Assim que você confirmar a primeira presença pelo código, ela aparece aqui.
            </p>
          </Vazio>
        </Card>
      )}

      {linhas && linhas.length > 0 && (
        <>
          <Card>
            <div className="row" style={{ gap: 34, flexWrap: 'wrap' }}>
              <Numero rotulo="Total no período" valor={reais(totalGeral)} destaque />
              <Numero rotulo="Vindo de vaga ociosa" valor={reais(ociosaGeral)} />
              <p className="faint" style={{ maxWidth: 300 }}>
                Receita de lugares que aconteceriam vazios de qualquer forma — antes do Kidoo, esse
                número era zero.
              </p>
            </div>
          </Card>

          <div className="stack" style={{ marginTop: 14 }}>
            {meses.map(([chave, doMes]) => (
              <Card key={chave} pad={false}>
                <div className="card-pad" style={{ paddingBottom: 6 }}>
                  <h3>{mes(chave)}</h3>
                </div>
                <div className="table-scroll">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Tipo de vaga</th>
                        <th>Presenças</th>
                        <th>Valor por presença</th>
                        <th>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {doMes.map((linha) => (
                        <tr key={linha.kind}>
                          <td>{linha.kind === 'ociosa' ? 'Vaga ociosa' : 'Vaga cheia'}</td>
                          <td className="mono">{linha.checkIns}</td>
                          <td className="mono">{reais(linha.rateCents)}</td>
                          <td className="mono">
                            <strong>{reais(linha.totalCents)}</strong>
                          </td>
                        </tr>
                      ))}
                      <tr>
                        <td colSpan={3} style={{ textAlign: 'right' }} className="muted">
                          Total do mês
                        </td>
                        <td className="mono">
                          <strong>
                            {reais(doMes.reduce((soma, l) => soma + l.totalCents, 0))}
                          </strong>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </>
  );
}

function Numero({
  rotulo,
  valor,
  destaque = false,
}: {
  rotulo: string;
  valor: string;
  destaque?: boolean;
}) {
  return (
    <div>
      <div className="faint" style={{ fontSize: 12 }}>
        {rotulo}
      </div>
      <div
        className="mono"
        style={{ fontSize: destaque ? 30 : 24, fontWeight: 700, color: destaque ? 'var(--purple)' : undefined }}
      >
        {valor}
      </div>
    </div>
  );
}

/** Agrupa por mês preservando a ordem que veio do banco (mais recente primeiro). */
function agrupar(linhas: StatementRow[]): [string, StatementRow[]][] {
  const mapa = new Map<string, StatementRow[]>();
  for (const linha of linhas) {
    const atual = mapa.get(linha.month) ?? [];
    atual.push(linha);
    mapa.set(linha.month, atual);
  }
  return [...mapa.entries()];
}
