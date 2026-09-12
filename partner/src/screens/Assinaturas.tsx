import { useState } from 'react';

import { api, type AssinaturaAdmin } from '@/api';
import { Card, Erro, Vazio, useDados } from '@/components/ui';

/**
 * A fila de assinaturas, e o portão.
 *
 * Existe porque chamar `subscribe_plan` ERA ter o plano: qualquer conta criada
 * saía com a cota cheia, para sempre, sem ninguém ter pago nada. Depois que a
 * falta passou a gerar repasse, isso deixou de ser um furo de acesso e virou um
 * furo de caixa — conta grátis, reserva, não aparece, e o Kidoo paga.
 *
 * Esta tela **não cobra nada**. Ela é a diferença entre "o sistema acha que
 * você assinou" e "alguém confirmou que você assinou", com o segundo sendo, por
 * enquanto, uma pessoa olhando o comprovante. Quando o gateway existir, o
 * webhook dele chama a mesma função que o botão daqui chama.
 */
export function Assinaturas() {
  const { dado: linhas, carregando, erro, recarregar } = useDados(() => api.assinaturasAdmin(), []);
  const [mexendo, setMexendo] = useState<string | null>(null);
  const [falha, setFalha] = useState<string | null>(null);

  async function mudar(a: AssinaturaAdmin, status: AssinaturaAdmin['status']) {
    setMexendo(a.guardianId);
    setFalha(null);
    try {
      await api.mudarAssinatura(a.guardianId, status);
      await recarregar();
    } catch (caught) {
      setFalha(caught instanceof Error ? caught.message : 'Não foi possível mudar a assinatura.');
    } finally {
      setMexendo(null);
    }
  }

  const esperando = (linhas ?? []).filter((a) => a.status === 'aguardando').length;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Assinaturas</h1>
          <p className="page-sub">
            Ativar libera os coins e permite reservar. Não cobra nada — a confirmação do pagamento é
            feita por você, fora daqui.
          </p>
        </div>
      </div>

      {erro && <Erro>{erro}</Erro>}
      {falha && <Erro>{falha}</Erro>}

      {carregando && !linhas && (
        <Card>
          <p className="muted">Carregando assinaturas…</p>
        </Card>
      )}

      {linhas && linhas.length === 0 && (
        <Card>
          <Vazio marca="🧾">
            <h3>Nenhuma assinatura ainda</h3>
            <p className="muted" style={{ marginTop: 6 }}>
              Assim que uma família escolher um plano no app, ela aparece aqui esperando.
            </p>
          </Vazio>
        </Card>
      )}

      {linhas && linhas.length > 0 && (
        <>
          {esperando > 0 && (
            <Card>
              <p className="muted">
                <strong>{esperando}</strong>{' '}
                {esperando === 1
                  ? 'família esperando confirmação'
                  : 'famílias esperando confirmação'}
                . Enquanto esperam, não conseguem reservar.
              </p>
            </Card>
          )}

          <div className="stack" style={{ marginTop: esperando > 0 ? 14 : 0 }}>
            {linhas.map((a) => (
              <Card key={a.guardianId}>
                <div className="row" style={{ gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 240 }}>
                    <h3>
                      {a.name} <Selo status={a.status} />
                    </h3>
                    {/* O e-mail é o que cruza com o comprovante: é o único
                        identificador que a família também conhece. */}
                    <p className="faint" style={{ marginTop: 4 }}>
                      {a.email} · plano {a.planId} · {a.coinsPerWeek} coins/semana
                    </p>
                  </div>
                  {a.status === 'ativa' ? (
                    <button
                      className="btn btn-ghost btn-sm"
                      disabled={mexendo === a.guardianId}
                      onClick={() => void mudar(a, 'aguardando')}
                    >
                      {mexendo === a.guardianId ? 'Aguarde…' : 'Suspender'}
                    </button>
                  ) : (
                    <button
                      className="btn btn-sm"
                      disabled={mexendo === a.guardianId}
                      onClick={() => void mudar(a, 'ativa')}
                    >
                      {mexendo === a.guardianId ? 'Aguarde…' : 'Ativar'}
                    </button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </>
  );
}

function Selo({ status }: { status: AssinaturaAdmin['status'] }) {
  if (status === 'ativa') return <span className="faint"> · ativa</span>;
  if (status === 'vencida') return <span className="faint"> · vencida</span>;
  return <span className="faint"> · aguardando</span>;
}
