import { useState } from 'react';

import { api, type AgendaRow, type Partner } from '@/api';
import { Card, Erro, EtiquetaVaga, Vazio, useDados } from '@/components/ui';
import { paraCampoLocal, quando } from '@/format';

/**
 * Turmas e vagas — o coração do modelo.
 *
 * O parceiro decide **quantos lugares de cada turma ele libera para o Kidoo**.
 * É a única coisa que ele controla, e é de propósito: o tipo da vaga (ociosa ou
 * cheia) é derivado da lotação, não escolhido, porque é ele quem define o
 * repasse — deixar essa escolha aqui seria deixar o fornecedor definir a
 * própria nota fiscal.
 */
export function Turmas({ parceiro }: { parceiro: Partner }) {
  const [criando, setCriando] = useState(false);

  const de = new Date();
  de.setHours(0, 0, 0, 0);
  const ate = new Date(de);
  ate.setDate(ate.getDate() + 21);

  const { dado: turmas, carregando, erro, recarregar } = useDados(
    () => api.agenda(de, ate),
    [de.toISOString()],
  );

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Turmas e vagas</h1>
          <p className="page-sub">
            Próximos 21 dias. Você escolhe quantos lugares de cada turma ficam disponíveis no Kidoo.
          </p>
        </div>
        <button className="btn" onClick={() => setCriando((v) => !v)}>
          {criando ? 'Cancelar' : '+ Publicar turma'}
        </button>
      </div>

      {criando && (
        <NovaTurma
          parceiro={parceiro}
          aoPublicar={() => {
            setCriando(false);
            recarregar();
          }}
        />
      )}

      {erro && <Erro>{erro}</Erro>}
      {carregando && !turmas && (
        <Card>
          <p className="muted">Carregando turmas…</p>
        </Card>
      )}

      {turmas && turmas.length === 0 && (
        <Card>
          <Vazio marca="🏟️">
            <h3>Nenhuma turma publicada</h3>
            <p className="muted" style={{ marginTop: 6 }}>
              Publique um horário que já acontece no seu espaço e diga quantos lugares sobram.
              Vaga que sobra hoje não rende nada.
            </p>
          </Vazio>
        </Card>
      )}

      {turmas && turmas.length > 0 && (
        <Card pad={false}>
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th style={{ paddingTop: 16 }}>Turma</th>
                  <th style={{ paddingTop: 16 }}>Lotação</th>
                  <th style={{ paddingTop: 16 }}>Tipo</th>
                  <th style={{ paddingTop: 16, width: 260 }}>Vagas no Kidoo</th>
                </tr>
              </thead>
              <tbody>
                {turmas.map((turma) => (
                  <LinhaTurma key={turma.sessionId} turma={turma} aoSalvar={recarregar} />
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <p className="faint" style={{ marginTop: 14, maxWidth: 680 }}>
        <strong>Como o tipo é decidido:</strong> uma turma que já tem matriculados suficientes
        acontece com ou sem o Kidoo — o lugar que sobra nela não custa nada a mais para você, e é
        classificado como <em>vaga ociosa</em>. Uma turma que só existe por causa do Kidoo é{' '}
        <em>vaga cheia</em> e vale o repasse integral. A classificação é automática, calculada a
        partir da lotação que você informa.
      </p>
    </>
  );
}

function LinhaTurma({ turma, aoSalvar }: { turma: AgendaRow; aoSalvar: () => void }) {
  const [vagas, setVagas] = useState(String(turma.slotsOpen));
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const mudou = Number(vagas) !== turma.slotsOpen;
  const livres = turma.capacity - turma.enrolled;

  const salvar = async () => {
    setSalvando(true);
    setErro(null);
    try {
      await api.definirVagas(turma.sessionId, Number(vagas));
      aoSalvar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível salvar.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <tr>
      <td>
        <strong>{turma.activityTitle}</strong>
        <div className="faint">{quando(turma.startsAt)}</div>
      </td>
      <td className="mono">
        {turma.enrolled}/{turma.capacity}
        <div className="faint">
          {livres === 0 ? 'sem lugar sobrando' : `${livres} ${livres === 1 ? 'lugar livre' : 'lugares livres'}`}
        </div>
      </td>
      <td>
        <EtiquetaVaga kind={turma.kind} />
      </td>
      <td>
        <div className="row" style={{ gap: 8 }}>
          <input
            className="input mono"
            style={{ width: 74 }}
            type="number"
            min={turma.slotsTaken}
            max={livres}
            aria-label={`Vagas abertas em ${turma.activityTitle}`}
            value={vagas}
            onChange={(e) => setVagas(e.target.value)}
          />
          <button className="btn btn-sm" disabled={!mudou || salvando} onClick={() => void salvar()}>
            {salvando ? 'Salvando…' : 'Salvar'}
          </button>
          {turma.slotsTaken > 0 && (
            <span className="faint">
              {turma.slotsTaken} {turma.slotsTaken === 1 ? 'reservada' : 'reservadas'}
            </span>
          )}
        </div>
        {erro && (
          <p className="faint" style={{ color: 'var(--danger)', marginTop: 5 }}>
            {erro}
          </p>
        )}
      </td>
    </tr>
  );
}

function NovaTurma({ parceiro, aoPublicar }: { parceiro: Partner; aoPublicar: () => void }) {
  const { dado: atividades } = useDados(() => api.minhasAtividades(parceiro.id), [parceiro.id]);

  const daquiUmDia = new Date();
  daquiUmDia.setDate(daquiUmDia.getDate() + 1);

  const [activityId, setActivityId] = useState('');
  const [startsAt, setStartsAt] = useState(paraCampoLocal(daquiUmDia));
  const [capacity, setCapacity] = useState('12');
  const [enrolled, setEnrolled] = useState('8');
  const [slotsOpen, setSlotsOpen] = useState('3');
  const [coinCost, setCoinCost] = useState('2');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const escolhida = activityId || atividades?.[0]?.id || '';

  const publicar = async () => {
    setEnviando(true);
    setErro(null);
    try {
      await api.publicarTurma({
        activityId: escolhida,
        startsAt,
        capacity: Number(capacity),
        enrolled: Number(enrolled),
        slotsOpen: Number(slotsOpen),
        coinCost: Number(coinCost),
      });
      aoPublicar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível publicar.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Card>
      <h3 style={{ marginBottom: 4 }}>Publicar turma</h3>
      <p className="faint" style={{ marginBottom: 16 }}>
        Informe a turma como ela é hoje: quantos lugares ela comporta e quantos alunos você já tem
        matriculados. As vagas que você abrir aqui vão para o app das famílias.
      </p>

      <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
        <div className="field" style={{ gridColumn: '1 / -1' }}>
          <label htmlFor="atividade">Atividade</label>
          <select
            id="atividade"
            className="input"
            value={escolhida}
            onChange={(e) => setActivityId(e.target.value)}
          >
            {atividades?.map((a) => (
              <option key={a.id} value={a.id}>
                {a.title}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="quando">Dia e hora</label>
          <input
            id="quando"
            className="input"
            type="datetime-local"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="capacidade">Lugares na turma</label>
          <input id="capacidade" className="input" type="number" min={1} value={capacity}
                 onChange={(e) => setCapacity(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="matriculados">Já matriculados</label>
          <input id="matriculados" className="input" type="number" min={0} value={enrolled}
                 onChange={(e) => setEnrolled(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="vagas">Vagas para o Kidoo</label>
          <input id="vagas" className="input" type="number" min={0} value={slotsOpen}
                 onChange={(e) => setSlotsOpen(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="coins">Custo em coins</label>
          <input id="coins" className="input" type="number" min={1} max={6} value={coinCost}
                 onChange={(e) => setCoinCost(e.target.value)} />
        </div>
      </div>

      {erro && (
        <div style={{ marginTop: 14 }}>
          <Erro>{erro}</Erro>
        </div>
      )}

      <div className="row" style={{ marginTop: 18 }}>
        <button className="btn" disabled={!escolhida || enviando} onClick={() => void publicar()}>
          {enviando ? 'Publicando…' : 'Publicar turma'}
        </button>
        <span className="faint">
          Matriculados + vagas não podem passar dos lugares da turma.
        </span>
      </div>
    </Card>
  );
}
