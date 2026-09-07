import { useState } from 'react';

import { api, type AgendaRow, type RosterRow } from '@/api';
import { Card, Erro, EtiquetaVaga, Vazio, useDados } from '@/components/ui';
import { diaLongo, hora, mesmoDia } from '@/format';

/**
 * A tela do dia.
 *
 * É a única que fica aberta enquanto a aula acontece, então ela responde a uma
 * pergunta só: **quem vem agora, e quem já chegou**. Publicar vaga e conferir
 * repasse são outras telas de propósito — misturá-las aqui encheria de botão
 * a tela que alguém usa com uma criança na frente esperando.
 */
export function Agenda() {
  const [dia, setDia] = useState(() => new Date());
  const [aberta, setAberta] = useState<string | null>(null);

  const inicio = new Date(dia);
  inicio.setHours(0, 0, 0, 0);
  const fim = new Date(inicio);
  fim.setDate(fim.getDate() + 1);
  const chave = inicio.toISOString();

  const { dado: turmas, carregando, erro, recarregar } = useDados(
    () => api.agenda(inicio, fim),
    [chave],
  );

  const anda = (dias: number) => {
    const proximo = new Date(dia);
    proximo.setDate(proximo.getDate() + dias);
    setDia(proximo);
    setAberta(null);
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Hoje no seu espaço</h1>
          <p className="page-sub">{diaLongo(dia)}</p>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => anda(-1)}>
            ← Dia anterior
          </button>
          {!mesmoDia(new Date().toISOString(), dia) && (
            <button className="btn btn-ghost btn-sm" onClick={() => setDia(new Date())}>
              Hoje
            </button>
          )}
          <button className="btn btn-ghost btn-sm" onClick={() => anda(1)}>
            Próximo dia →
          </button>
        </div>
      </div>

      {erro && <Erro>{erro}</Erro>}
      {carregando && !turmas && (
        <Card>
          <p className="muted">Carregando a agenda…</p>
        </Card>
      )}

      {turmas && turmas.length === 0 && (
        <Card>
          <Vazio marca="🗓️">
            <h3>Nenhuma turma neste dia</h3>
            <p className="muted" style={{ marginTop: 6 }}>
              Publique horários em <strong>Turmas e vagas</strong> para as famílias reservarem.
            </p>
          </Vazio>
        </Card>
      )}

      <div className="stack">
        {turmas?.map((turma) => (
          <CartaoTurma
            key={turma.sessionId}
            turma={turma}
            aberta={aberta === turma.sessionId}
            aoAbrir={() => setAberta(aberta === turma.sessionId ? null : turma.sessionId)}
            aoConfirmar={recarregar}
          />
        ))}
      </div>
    </>
  );
}

function CartaoTurma({
  turma,
  aberta,
  aoAbrir,
  aoConfirmar,
}: {
  turma: AgendaRow;
  aberta: boolean;
  aoAbrir: () => void;
  aoConfirmar: () => void;
}) {
  const reservadas = turma.slotsTaken;
  const faltamConfirmar = turma.checkedIn - turma.confirmed;

  return (
    <section className="card">
      <div className="card-pad">
        <div className="turma-head">
          <div className="turma-id">
            <div className="row" style={{ gap: 10, marginBottom: 2, flexWrap: 'wrap' }}>
              <h3>{turma.activityTitle}</h3>
              <EtiquetaVaga kind={turma.kind} />
            </div>
            <p className="faint">
              {hora(turma.startsAt)} · {turma.enrolled} matriculados ·{' '}
              {turma.slotsOpen} vagas abertas para o Kidoo · {turma.coinCost} coins
            </p>
          </div>

          <div className="turma-nums">
            <Contador rotulo="Reservaram" valor={reservadas} />
            <Contador rotulo="Chegaram" valor={turma.checkedIn} />
            <Contador
              rotulo="Confirmados"
              valor={turma.confirmed}
              // Quem fez check-in mas ninguém confirmou é o que gera repasse
              // pendente: é a única contagem que pede ação agora.
              alerta={faltamConfirmar > 0}
            />
          </div>

          <button className="btn btn-ghost btn-sm" onClick={aoAbrir} aria-expanded={aberta}>
            {aberta ? 'Fechar lista' : 'Ver lista'}
          </button>
        </div>
      </div>

      {aberta && <Lista sessionId={turma.sessionId} aoConfirmar={aoConfirmar} />}
    </section>
  );
}

function Contador({
  rotulo,
  valor,
  alerta = false,
}: {
  rotulo: string;
  valor: number;
  alerta?: boolean;
}) {
  return (
    <div style={{ textAlign: 'center', minWidth: 78 }}>
      <div
        className="mono"
        style={{ fontSize: 21, fontWeight: 700, color: alerta ? 'var(--warning)' : undefined }}
      >
        {valor}
      </div>
      <div className="faint" style={{ fontSize: 12 }}>
        {rotulo}
      </div>
    </div>
  );
}

function Lista({ sessionId, aoConfirmar }: { sessionId: string; aoConfirmar: () => void }) {
  const { dado: lista, carregando, erro, recarregar } = useDados(
    () => api.listaDaTurma(sessionId),
    [sessionId],
  );

  const atualizar = () => {
    recarregar();
    aoConfirmar();
  };

  return (
    <div style={{ borderTop: '1px solid var(--border)', padding: '14px 6px 6px' }}>
      {erro && (
        <div style={{ padding: '0 14px 12px' }}>
          <Erro>{erro}</Erro>
        </div>
      )}
      {carregando && !lista && <p className="muted" style={{ padding: '0 14px 12px' }}>Carregando…</p>}

      {lista && lista.length === 0 && (
        <p className="muted" style={{ padding: '0 14px 14px' }}>
          Ninguém reservou esta turma pelo Kidoo ainda.
        </p>
      )}

      {lista && lista.length > 0 && (
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th>Criança</th>
                <th>Situação</th>
                <th style={{ width: 300 }}>Confirmar presença</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((linha) => (
                <LinhaCrianca key={linha.bookingId} linha={linha} aoConfirmar={atualizar} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="faint" style={{ padding: '10px 14px 4px' }}>
        Mostramos só o primeiro nome e a idade — é o que você precisa para receber a criança na
        porta. O cadastro completo fica com a família.
      </p>
    </div>
  );
}

function LinhaCrianca({ linha, aoConfirmar }: { linha: RosterRow; aoConfirmar: () => void }) {
  const [codigo, setCodigo] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const confirmar = async () => {
    setEnviando(true);
    setErro(null);
    try {
      await api.confirmarPresenca(linha.bookingId, codigo);
      setCodigo('');
      aoConfirmar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível confirmar.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <tr>
      <td>
        <strong>{linha.firstName}</strong>{' '}
        <span className="faint">
          {linha.age} {linha.age === 1 ? 'ano' : 'anos'}
        </span>
      </td>
      <td>
        {linha.partnerConfirmedAt ? (
          <span className="badge badge-ok">Presença confirmada</span>
        ) : linha.hasCode ? (
          <span className="badge badge-espera">Fez check-in · aguardando código</span>
        ) : (
          <span className="badge badge-neutro">Reservou · ainda não chegou</span>
        )}
      </td>
      <td>
        {linha.partnerConfirmedAt ? (
          <span className="faint">Nada a fazer.</span>
        ) : !linha.hasCode ? (
          <span className="faint">A família gera o código no app ao chegar.</span>
        ) : (
          <>
            <div className="row" style={{ gap: 8 }}>
              <input
                className="input mono"
                style={{ width: 120, letterSpacing: '0.12em' }}
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                aria-label={`Código de ${linha.firstName}`}
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && codigo.length === 6) void confirmar();
                }}
              />
              <button
                className="btn btn-sm"
                disabled={codigo.length !== 6 || enviando}
                onClick={() => void confirmar()}
              >
                {enviando ? 'Confirmando…' : 'Confirmar'}
              </button>
            </div>
            {erro && (
              <p className="faint" style={{ color: 'var(--danger)', marginTop: 5 }}>
                {erro}
              </p>
            )}
          </>
        )}
      </td>
    </tr>
  );
}
