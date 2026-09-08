import { useMemo, useRef, useState } from 'react';

import { api, type ActivityRow, type AgendaRow, type Partner, type ResultadoDaSerie } from '@/api';
import { Card, Erro, EtiquetaVaga, Vazio, useDados } from '@/components/ui';
import { paraCampoLocal, quando } from '@/format';
import { LIMITE_DA_SERIE, datasDaSerie, resumoDaSerie } from '@/recorrencia';

/**
 * Turmas e vagas — o coração do modelo.
 *
 * O parceiro decide **quantos lugares de cada turma ele libera para o Kidoo**.
 * É a única coisa que ele controla, e é de propósito: o tipo da vaga (ociosa ou
 * cheia) é derivado da lotação, não escolhido, porque é ele quem define o
 * repasse — deixar essa escolha aqui seria deixar o fornecedor definir a
 * própria nota fiscal.
 */
export function Turmas({ parceiros, varios }: { parceiros: Partner[]; varios: boolean }) {
  const [criando, setCriando] = useState(false);
  const [recado, setRecado] = useState<string | null>(null);

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
          parceiros={parceiros}
          varios={varios}
          aoPublicar={(mensagem) => {
            setCriando(false);
            setRecado(mensagem);
            recarregar();
          }}
        />
      )}

      {/*
        O aviso fica aqui, e não dentro do formulário, porque o formulário
        fecha ao publicar. Uma série pode terminar com um resultado que não é
        "deu certo" nem "deu erro" — pedi oito e entraram duas porque seis já
        estavam publicadas —, e esse é justamente o caso que precisa ser lido.
      */}
      {recado && (
        <div className="alert alert-ok" style={{ marginBottom: 14 }} role="status">
          {recado}
        </div>
      )}

      <CapasDasAtividades parceiros={parceiros} varios={varios} />

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
                  <LinhaTurma
                    key={turma.sessionId}
                    turma={turma}
                    varios={varios}
                    aoSalvar={recarregar}
                  />
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

function LinhaTurma({
  turma,
  varios,
  aoSalvar,
}: {
  turma: AgendaRow;
  varios: boolean;
  aoSalvar: () => void;
}) {
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
        {/* Duas turmas com o mesmo nome em lugares diferentes é o caso que
            fazia abrir vaga na errada — e errar assim não dá erro nenhum: a
            família fica esperando um aviso que nunca sai. */}
        {varios && <div className="faint">{turma.partnerName}</div>}
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

/** Domingo primeiro, como o calendário brasileiro. */
const DIAS_DA_SEMANA = [
  { valor: 0, curto: 'D', nome: 'domingo' },
  { valor: 1, curto: 'S', nome: 'segunda-feira' },
  { valor: 2, curto: 'T', nome: 'terça-feira' },
  { valor: 3, curto: 'Q', nome: 'quarta-feira' },
  { valor: 4, curto: 'Q', nome: 'quinta-feira' },
  { valor: 5, curto: 'S', nome: 'sexta-feira' },
  { valor: 6, curto: 'S', nome: 'sábado' },
];

/**
 * O que dizer depois de publicar uma série.
 *
 * "Publicado!" seria mentira nos dois casos que mais acontecem: republicar as
 * mesmas semanas (nada entra) e publicar de novo com uma semana a mais (entra
 * uma). Quem está no balcão precisa saber quantas turmas existem agora, não
 * quantas ele pediu.
 */
function recadoDaSerie(r: ResultadoDaSerie): string {
  const partes: string[] = [];

  if (r.publicadas === 0) partes.push('Nenhuma turma nova foi publicada.');
  else if (r.publicadas === 1) partes.push('1 turma publicada.');
  else partes.push(`${r.publicadas} turmas publicadas.`);

  if (r.jaExistiam > 0) {
    partes.push(
      r.jaExistiam === 1
        ? '1 data já estava na agenda e foi mantida como estava.'
        : `${r.jaExistiam} datas já estavam na agenda e foram mantidas como estavam.`,
    );
  }
  if (r.noPassado > 0) {
    partes.push(
      r.noPassado === 1 ? '1 data já passou e ficou de fora.' : `${r.noPassado} datas já passaram e ficaram de fora.`,
    );
  }

  return partes.join(' ');
}

/** As atividades agrupadas por estabelecimento, em ordem de nome. */
function porParceiro(atividades: ActivityRow[]): [string, ActivityRow[]][] {
  const grupos = new Map<string, ActivityRow[]>();
  for (const a of atividades) {
    const atual = grupos.get(a.partnerName);
    if (atual) atual.push(a);
    else grupos.set(a.partnerName, [a]);
  }
  return [...grupos.entries()].sort((a, b) => a[0].localeCompare(b[0], 'pt-BR'));
}

function NovaTurma({
  parceiros,
  varios,
  aoPublicar,
}: {
  parceiros: Partner[];
  varios: boolean;
  aoPublicar: (mensagem: string) => void;
}) {
  const ids = parceiros.map((p) => p.id);
  const { dado: atividades } = useDados(() => api.minhasAtividades(ids), [ids.join(',')]);

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

  const [repete, setRepete] = useState(false);
  const [diasDaSemana, setDiasDaSemana] = useState<number[]>([]);
  const [semanas, setSemanas] = useState('8');

  const escolhida = activityId || atividades?.[0]?.id || '';

  // A hora da série sai do mesmo campo de sempre: "toda terça às 18h" é a hora
  // que ele já digitou ali. Um segundo campo de hora seria uma chance a mais de
  // publicar oito turmas no horário errado.
  const horaDaSerie = startsAt.slice(11, 16);

  const datas = useMemo(
    () => (repete ? datasDaSerie({ diasDaSemana, hora: horaDaSerie, semanas: Number(semanas) }) : []),
    [repete, diasDaSemana, horaDaSerie, semanas],
  );
  const passaDoTeto = datas.length > LIMITE_DA_SERIE;

  const alternarDia = (valor: number) => {
    setDiasDaSemana((atual) =>
      atual.includes(valor) ? atual.filter((d) => d !== valor) : [...atual, valor].sort(),
    );
  };

  const ligarRepeticao = (ligado: boolean) => {
    setRepete(ligado);
    // Começa marcado no dia da semana que ele já escolheu no campo de data:
    // é quase sempre um dos dias da série, e evita abrir a seção vazia.
    if (ligado && diasDaSemana.length === 0) {
      const escolhido = new Date(startsAt);
      if (!Number.isNaN(escolhido.getTime())) setDiasDaSemana([escolhido.getDay()]);
    }
  };

  const publicar = async () => {
    setEnviando(true);
    setErro(null);
    try {
      const comum = {
        activityId: escolhida,
        capacity: Number(capacity),
        enrolled: Number(enrolled),
        slotsOpen: Number(slotsOpen),
        coinCost: Number(coinCost),
      };
      if (repete) {
        aoPublicar(recadoDaSerie(await api.publicarSerie({ ...comum, quando: datas })));
      } else {
        await api.publicarTurma({ ...comum, startsAt });
        aoPublicar('Turma publicada.');
      }
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
            {/* Com mais de um estabelecimento, a lista vai agrupada: duas
                atividades de mesmo nome em lugares diferentes são
                indistinguíveis numa lista plana, e publicar no lugar errado
                não dá erro. */}
            {varios
              ? porParceiro(atividades ?? []).map(([nome, doLugar]) => (
                  <optgroup key={nome} label={nome}>
                    {doLugar.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.title}
                      </option>
                    ))}
                  </optgroup>
                ))
              : atividades?.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.title}
                  </option>
                ))}
          </select>
        </div>

        {/*
          Ocupa duas colunas porque `datetime-local` desenha data E hora dentro
          do campo: numa coluna de 160px o navegador corta a data pela esquerda,
          e o parceiro publica oito semanas sem conseguir ler o dia.

          O rótulo não muda quando a série está ligada. Chamar de "primeiro dia"
          seria mentira: com a série, o que vale deste campo é a HORA — os dias
          são os marcados abaixo, e a primeira aula pode ser antes ou depois
          desta data.
        */}
        <div className="field" style={{ gridColumn: 'span 2' }}>
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

      {/*
        A repetição é o que faz o painel servir a um parceiro de verdade: ele
        não tem "uma turma", tem terça e quinta às 18h o ano inteiro. Publicar
        uma a uma é o motivo pelo qual a agenda ficaria vazia depois da primeira
        semana.
      */}
      <div style={{ borderTop: '1px solid var(--border)', marginTop: 18, paddingTop: 16 }}>
        <label className="row" style={{ gap: 9, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={repete}
            onChange={(e) => ligarRepeticao(e.target.checked)}
            style={{ width: 17, height: 17 }}
          />
          <strong style={{ fontSize: 14 }}>Esta turma se repete toda semana</strong>
        </label>

        {repete && (
          <div style={{ marginTop: 14, display: 'grid', gap: 14 }}>
            <div className="field">
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>
                Em quais dias, sempre às {horaDaSerie || '--:--'}
              </span>
              <div className="dias">
                {DIAS_DA_SEMANA.map((dia) => (
                  <button
                    key={dia.valor}
                    type="button"
                    className="dia-chip"
                    aria-pressed={diasDaSemana.includes(dia.valor)}
                    aria-label={dia.nome}
                    onClick={() => alternarDia(dia.valor)}
                  >
                    {dia.curto}
                  </button>
                ))}
              </div>
            </div>

            <div className="field" style={{ maxWidth: 220 }}>
              <label htmlFor="semanas">Por quantas semanas</label>
              <select
                id="semanas"
                className="input"
                value={semanas}
                onChange={(e) => setSemanas(e.target.value)}
              >
                <option value="2">2 semanas</option>
                <option value="4">4 semanas</option>
                <option value="8">8 semanas</option>
                <option value="12">12 semanas</option>
              </select>
            </div>

            {datas.length > 0 && (
              <p className="faint" style={{ margin: 0 }}>
                {datas.length === 1 ? '1 turma' : `${datas.length} turmas`}: {resumoDaSerie(datas)}
              </p>
            )}
            {passaDoTeto && (
              <p style={{ margin: 0, fontSize: 13, color: 'var(--danger)' }}>
                São {datas.length} turmas de uma vez, e o limite é {LIMITE_DA_SERIE}. Reduza os dias
                ou as semanas.
              </p>
            )}
            {diasDaSemana.length > 0 && datas.length === 0 && (
              <p style={{ margin: 0, fontSize: 13, color: 'var(--danger)' }}>
                Nenhuma data futura com esses dias e esse horário.
              </p>
            )}
          </div>
        )}
      </div>

      {erro && (
        <div style={{ marginTop: 14 }}>
          <Erro>{erro}</Erro>
        </div>
      )}

      <div className="row" style={{ marginTop: 18 }}>
        <button
          className="btn"
          disabled={!escolhida || enviando || (repete && (datas.length === 0 || passaDoTeto))}
          onClick={() => void publicar()}
        >
          {enviando
            ? 'Publicando…'
            : repete && datas.length > 1
              ? `Publicar ${datas.length} turmas`
              : 'Publicar turma'}
        </button>
        <span className="faint">
          Matriculados + vagas não podem passar dos lugares da turma.
        </span>
      </div>
    </Card>
  );
}

/**
 * As capas das atividades.
 *
 * Ficou numa seção própria, e não dentro do formulário de publicar turma, por
 * um motivo que só apareceu ao ver a tela pronta: capa é propriedade da
 * ATIVIDADE, não daquela publicação. Escondida atrás do "+ Publicar turma",
 * ela só existiria para quem estivesse criando uma turma nova — e quem já
 * publicou tudo nunca mais acharia.
 *
 * Até aqui era uma foto de banco de imagens escolhida por modalidade, igual
 * para toda escolinha de futebol do país, e não havia tela nenhuma para
 * trocar. A decisão de reservar acontece olhando esse cartão, e a foto da
 * quadra do parceiro vende melhor que qualquer foto genérica.
 */
function CapasDasAtividades({ parceiros, varios }: { parceiros: Partner[]; varios: boolean }) {
  const ids = parceiros.map((p) => p.id);
  const { dado: atividades, recarregar } = useDados(
    () => api.minhasAtividades(ids),
    [ids.join(',')],
  );

  if (!atividades || atividades.length === 0) return null;

  return (
    <Card>
      <h3 style={{ marginBottom: 4 }}>Suas atividades no app</h3>
      <p className="faint" style={{ marginBottom: 16 }}>
        Esta é a imagem que a família vê antes de decidir. Sem uma foto sua, o app usa uma
        genérica da modalidade.
      </p>
      {varios ? (
        porParceiro(atividades).map(([nome, doLugar]) => (
          <div key={nome} style={{ marginBottom: 18 }}>
            <p className="faint" style={{ fontWeight: 700, marginBottom: 10 }}>{nome}</p>
            <div style={{ display: 'grid', gap: 16 }}>
              {doLugar.map((a) => (
                <CapaDaAtividade key={a.id} atividade={a} aoTrocar={recarregar} />
              ))}
            </div>
          </div>
        ))
      ) : (
        <div style={{ display: 'grid', gap: 16 }}>
          {atividades.map((a) => (
            <CapaDaAtividade key={a.id} atividade={a} aoTrocar={recarregar} />
          ))}
        </div>
      )}
    </Card>
  );
}

/** Uma linha: miniatura, nome e o botão de trocar. */
/**
 * A capa que a família vê no catálogo.
 *
 * Até aqui era uma foto de banco de imagens escolhida por modalidade — igual
 * para toda escolinha de futebol — e não havia tela nenhuma para trocar. Mas a
 * decisão de reservar acontece olhando esse cartão, e a foto da quadra do
 * parceiro vende melhor que qualquer foto genérica.
 */
function CapaDaAtividade({
  atividade,
  aoTrocar,
}: {
  atividade: ActivityRow | null;
  aoTrocar: () => void;
}) {
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const entrada = useRef<HTMLInputElement>(null);

  if (!atividade) return null;

  const escolher = async (arquivo: File | undefined) => {
    if (!arquivo) return;
    setErro(null);

    // O bucket recusa acima de 5 MB, e recusa depois do upload inteiro subir.
    // Barrar aqui poupa a espera e explica o motivo antes de gastar os dados
    // de quem está num 4G de escolinha.
    if (arquivo.size > 5 * 1024 * 1024) {
      setErro('A imagem passa de 5 MB. Escolha uma menor.');
      return;
    }

    setEnviando(true);
    try {
      await api.trocarImagem(atividade.id, arquivo);
      aoTrocar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível trocar a imagem.');
    } finally {
      setEnviando(false);
      // Limpa a seleção: sem isto, escolher o MESMO arquivo de novo não dispara
      // o `change` e o botão parece morto.
      if (entrada.current) entrada.current.value = '';
    }
  };

  return (
    <div className="row" style={{ gap: 12, alignItems: 'center' }}>
        {atividade.imageUrl ? (
          <img
            src={atividade.imageUrl}
            alt={`Capa de ${atividade.title}`}
            // `flex: none` e fundo: sem isto, uma imagem que não carrega
            // (rede caiu, URL velha) desenha o texto alternativo e estica a
            // linha inteira, empurrando o botão para fora do lugar.
            style={{
              width: 72,
              height: 54,
              flex: 'none',
              objectFit: 'cover',
              borderRadius: 8,
              background: 'var(--card-muted)',
            }}
          />
        ) : (
          <div
            style={{
              width: 72,
              height: 54,
              flex: 'none',
              borderRadius: 8,
              border: '1.5px dashed var(--border)',
              display: 'grid',
              placeItems: 'center',
              fontSize: 11,
              color: 'var(--text-faint)',
            }}
          >
            sem foto
          </div>
        )}

        <div style={{ flex: 1 }}>
          <strong style={{ display: 'block', fontSize: 14, marginBottom: 6 }}>
            {atividade.title}
          </strong>
          <input
            ref={entrada}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            style={{ display: 'none' }}
            onChange={(e) => void escolher(e.target.files?.[0])}
          />
          <button
            type="button"
            className="btn btn-secundario"
            disabled={enviando}
            onClick={() => entrada.current?.click()}
          >
            {enviando ? 'Enviando…' : atividade.imageUrl ? 'Trocar imagem' : 'Escolher imagem'}
          </button>
          <p className="faint" style={{ fontSize: 12, marginTop: 6 }}>
            {atividade.imageUrl
              ? 'JPG, PNG ou WebP, até 5 MB.'
              : 'Sem imagem, o app usa uma foto genérica da modalidade.'}
          </p>
          {erro ? (
            <p style={{ fontSize: 12, marginTop: 4, color: 'var(--danger)' }}>{erro}</p>
          ) : null}
        </div>
    </div>
  );
}
