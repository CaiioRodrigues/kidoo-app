import { useState } from 'react';

import { api, type ParceiroAdmin } from '@/api';
import { Card, Erro, Vazio, useDados } from '@/components/ui';

/**
 * Ligar e desligar estabelecimento. Só para quem analisa pedidos.
 *
 * Existe porque `partners` só sabia dizer se alguém é verificado, nunca se
 * ainda faz parte. Quem encerrava a parceria continuava no catálogo, com o
 * selo, recebendo reserva — e apagar não era saída: `bookings.activity_id` é
 * `on delete restrict`, e o banco recusa apagar quem já recebeu criança. Com
 * razão: o histórico da família não pode sumir porque a escolinha fechou.
 *
 * Então não se apaga, desliga-se. E o caminho é de mão dupla: parceiro que sai
 * e volta é comum, e recriá-lo perderia tudo o que já aconteceu.
 */
export function Parceiros() {
  const { dado: linhas, carregando, erro, recarregar } = useDados(() => api.parceirosAdmin(), []);
  const [mexendo, setMexendo] = useState<string | null>(null);
  const [falha, setFalha] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  async function alternar(parceiro: ParceiroAdmin) {
    const desligando = parceiro.active;
    if (desligando && parceiro.futureBookings > 0) {
      const quantas =
        parceiro.futureBookings === 1
          ? '1 aula já marcada'
          : `${parceiro.futureBookings} aulas já marcadas`;
      // O aviso é a razão de a contagem existir. Desligar não cancela nada, e
      // quem clica precisa saber disso ANTES — depois já são famílias que
      // apareceram na porta de um lugar que saiu.
      const segue = window.confirm(
        `${parceiro.name} tem ${quantas} para o futuro.\n\n` +
          'Desligar tira o estabelecimento do catálogo e impede reserva nova, ' +
          'mas NÃO cancela o que já está marcado nem devolve coins. ' +
          'Quem tem aula marcada continua com ela.\n\nDesligar mesmo assim?',
      );
      if (!segue) return;
    }

    setMexendo(parceiro.id);
    setFalha(null);
    setAviso(null);
    try {
      const { futureBookings } = await api.ligarParceiro(parceiro.id, !parceiro.active);
      setAviso(
        desligando
          ? `${parceiro.name} saiu do catálogo.` +
              (futureBookings > 0
                ? ` ${futureBookings} aula(s) marcada(s) continuam de pé — avise as famílias.`
                : ' Não havia aula marcada.')
          : `${parceiro.name} voltou ao catálogo.`,
      );
      await recarregar();
    } catch (caught) {
      setFalha(caught instanceof Error ? caught.message : 'Não foi possível mudar o estado.');
    } finally {
      setMexendo(null);
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Estabelecimentos</h1>
          <p className="page-sub">
            Desligar tira do catálogo e impede reserva nova. Não apaga nada: o histórico de quem já
            foi continua inteiro, e dá para religar.
          </p>
        </div>
      </div>

      {erro && <Erro>{erro}</Erro>}
      {falha && <Erro>{falha}</Erro>}
      {aviso && (
        <Card>
          <p className="muted">{aviso}</p>
        </Card>
      )}

      {carregando && !linhas && (
        <Card>
          <p className="muted">Carregando estabelecimentos…</p>
        </Card>
      )}

      {linhas && linhas.length === 0 && (
        <Card>
          <Vazio marca="🏫">
            <h3>Nenhum estabelecimento ainda</h3>
            <p className="muted" style={{ marginTop: 6 }}>
              Aprove um pedido na aba ao lado e ele aparece aqui.
            </p>
          </Vazio>
        </Card>
      )}

      {linhas && linhas.length > 0 && (
        <div className="stack">
          {linhas.map((p) => (
            <Card key={p.id}>
              <div className="row" style={{ gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 220 }}>
                  <h3 style={{ opacity: p.active ? 1 : 0.6 }}>
                    {p.name}
                    {!p.active && <span className="faint"> · fora do ar</span>}
                  </h3>
                  <p className="faint" style={{ marginTop: 4 }}>
                    {p.neighborhood}, {p.city} · {p.activities} atividade(s)
                    {p.futureBookings > 0 && ` · ${p.futureBookings} aula(s) marcada(s)`}
                  </p>
                </div>
                <button
                  className={p.active ? 'btn btn-ghost btn-sm' : 'btn btn-sm'}
                  disabled={mexendo === p.id}
                  onClick={() => void alternar(p)}
                >
                  {mexendo === p.id ? 'Aguarde…' : p.active ? 'Desligar' : 'Religar'}
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
