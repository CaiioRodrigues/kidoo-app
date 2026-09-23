import { useState } from 'react';

import { api, type LinhaDoPodio, type Papel, type StatusDaVotacao, type VotacaoAdmin } from '@/api';
import { Card, Erro, Vazio, useDados } from '@/components/ui';

/**
 * As votações, do lado de quem organiza.
 *
 * A página pública (`/votacao`) não tem botão nenhum de comando: quem abre as
 * inscrições, quem libera o voto e quem manda contar é uma pessoa do Kidoo,
 * aqui, logada. Sem isso, qualquer convidado com o link decidiria a hora de
 * fechar a urna.
 *
 * O vocabulário é genérico de ponta a ponta — "votação", "categoria",
 * "inscrito". A primeira é de fantasia numa festa; a próxima pode ser melhor
 * parceiro do ano, sem tocar em tabela nem nesta tela.
 */
const ROTULO: Record<StatusDaVotacao, string> = {
  rascunho: 'rascunho',
  inscricoes: 'inscrições abertas',
  votacao: 'votação aberta',
  apurada: 'apurada',
};

/** O que o próximo passo FAZ, em vez de para onde ele leva. */
const PROXIMO: Record<StatusDaVotacao, string | null> = {
  rascunho: 'Abrir as inscrições',
  inscricoes: 'Liberar a votação',
  votacao: 'Contar os votos',
  apurada: null,
};

const AVISO: Record<StatusDaVotacao, string> = {
  rascunho: 'Ninguém consegue se inscrever ainda.',
  inscricoes: 'Liberar a votação FECHA as inscrições. Quem chegar depois só vota.',
  votacao: 'Contar os votos encerra a urna e mostra o pódio. Não tem volta.',
  apurada: 'O resultado já está no ar para todo mundo.',
};

export function Votacoes() {
  const { dado: votacoes, carregando, erro, recarregar } = useDados(() => api.votacoesAdmin(), []);
  const [criando, setCriando] = useState(false);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Votações</h1>
          <p className="page-sub">
            A página que os participantes abrem é <code>/votacao</code>. Ela mostra o que este
            painel liberou — nada mais.
          </p>
        </div>
        {!criando && (
          <button className="btn" onClick={() => setCriando(true)}>
            Criar votação
          </button>
        )}
      </div>

      {criando && (
        <Formulario
          aoCancelar={() => setCriando(false)}
          aoCriar={() => {
            setCriando(false);
            recarregar();
          }}
        />
      )}

      {erro && <Erro>{erro}</Erro>}
      {carregando && !votacoes && (
        <Card>
          <p className="muted">Carregando votações…</p>
        </Card>
      )}

      {votacoes && votacoes.length === 0 && !criando && (
        <Card>
          <Vazio marca="🗳️">
            <h3>Nenhuma votação criada</h3>
            <p className="muted" style={{ marginTop: 6 }}>
              Crie uma e a página pública abre sozinha, já recebendo inscrições.
            </p>
          </Vazio>
        </Card>
      )}

      <div className="stack">
        {votacoes?.map((v) => (
          <CartaoDaVotacao key={v.id} votacao={v} aoAvancar={recarregar} />
        ))}
      </div>
    </>
  );
}

function CartaoDaVotacao({ votacao, aoAvancar }: { votacao: VotacaoAdmin; aoAvancar: () => void }) {
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [folha, setFolha] = useState(false);
  const [podio, setPodio] = useState(false);
  const proximo = PROXIMO[votacao.status];

  const avancar = async () => {
    setOcupado(true);
    setErro(null);
    try {
      await api.avancarVotacao(votacao.id);
      aoAvancar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível avançar agora.');
    } finally {
      setOcupado(false);
    }
  };

  return (
    <section className="card">
      <div className="card-pad">
        <div className="row" style={{ gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
          <h3>{votacao.title}</h3>
          <span className={votacao.status === 'apurada' ? 'badge' : 'badge badge-espera'}>
            {ROTULO[votacao.status]}
          </span>
        </div>
        <p className="faint">
          {votacao.entries} {votacao.entries === 1 ? 'inscrito' : 'inscritos'} ·{' '}
          {/* Pessoas, não votos: quem votou em três categorias é uma pessoa,
              e é esse número que diz se a festa inteira já votou. */}
          {votacao.voterNumbers
            ? `${votacao.voters} de ${votacao.voterNumbers} papéis votaram`
            : `${votacao.voters} ${votacao.voters === 1 ? 'pessoa votou' : 'pessoas votaram'}`}{' '}
          · criada em {new Date(votacao.createdAt).toLocaleDateString('pt-BR')}
        </p>

        {votacao.voterNumbers && (
          <>
            <Papeis total={votacao.voterNumbers} votaram={votacao.votedNumbers ?? []} />
            <button
              className="btn btn-ghost btn-sm"
              style={{ marginTop: 10 }}
              onClick={() => setFolha((v) => !v)}
            >
              {folha ? 'Esconder os papéis' : 'Ver e imprimir os papéis'}
            </button>
            {folha && <Folha id={votacao.id} titulo={votacao.title} />}
          </>
        )}

        <p className="muted" style={{ marginTop: 12 }}>
          {AVISO[votacao.status]}
        </p>

        {erro && (
          <div style={{ marginTop: 12 }}>
            <Erro>{erro}</Erro>
          </div>
        )}

        {/* A página pública só mostra a votação mais recente: criar a próxima
            tira o pódio desta do ar. Aqui ele continua ao alcance de um
            clique, que é o que "quem ganhou naquela festa?" precisa. */}
        {votacao.status === 'apurada' && (
          <>
            <div className="row" style={{ marginTop: 14 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setPodio((v) => !v)}>
                {podio ? 'Esconder o resultado' : 'Ver o resultado'}
              </button>
            </div>
            {podio && <Podio id={votacao.id} />}
          </>
        )}

        {proximo && (
          <div className="row" style={{ gap: 10, marginTop: 16 }}>
            <button
              className="btn"
              disabled={ocupado || (votacao.status === 'inscricoes' && votacao.entries === 0)}
              onClick={() => void avancar()}
            >
              {ocupado ? 'Mudando…' : proximo}
            </button>
          </div>
        )}
        {/* Liberar o voto sem ninguém inscrito entrega uma cédula em branco, e
            o caminho de volta não existe: inscrições fechadas não reabrem. */}
        {votacao.status === 'inscricoes' && votacao.entries === 0 && (
          <p className="faint" style={{ marginTop: 8 }}>
            Ninguém se inscreveu ainda — não há em quem votar.
          </p>
        )}
      </div>
    </section>
  );
}

function Formulario({ aoCriar, aoCancelar }: { aoCriar: () => void; aoCancelar: () => void }) {
  const [titulo, setTitulo] = useState('');
  const [subtitulo, setSubtitulo] = useState('');
  const [categorias, setCategorias] = useState('');
  const [senha, setSenha] = useState('');
  // Texto, e não número: vazio é uma resposta legítima ("sem papel"), e
  // `0`/`NaN` seriam duas formas de dizer isso num campo numérico.
  const [papeis, setPapeis] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const linhas = categorias
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l !== '');
  // O banco recusa fora de 2..999; barrar aqui evita a viagem só para ouvir não.
  const faixaInvalida = papeis.trim() !== '' && !(Number(papeis) >= 2 && Number(papeis) <= 999);

  const criar = async () => {
    setOcupado(true);
    setErro(null);
    try {
      await api.criarVotacao({
        title: titulo,
        subtitle: subtitulo,
        categories: linhas,
        passphrase: senha,
        voterNumbers: papeis.trim() === '' ? null : Number(papeis),
      });
      aoCriar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível criar agora.');
    } finally {
      setOcupado(false);
    }
  };

  return (
    <Card>
      <h3>Nova votação</h3>
      <div className="field" style={{ marginTop: 14 }}>
        <label htmlFor="votacao-titulo">Nome</label>
        <input
          id="votacao-titulo"
          className="input"
          maxLength={80}
          placeholder="Festa de Halloween 2026"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor="votacao-subtitulo">Linha de apoio (opcional)</label>
        <input
          id="votacao-subtitulo"
          className="input"
          maxLength={120}
          placeholder="Escolha as melhores fantasias da noite"
          value={subtitulo}
          onChange={(e) => setSubtitulo(e.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor="votacao-categorias">Categorias, uma por linha</label>
        <textarea
          id="votacao-categorias"
          className="input"
          rows={4}
          placeholder={'Melhor fantasia\nMais assustadora\nMais engraçada'}
          value={categorias}
          onChange={(e) => setCategorias(e.target.value)}
        />
        <p className="faint" style={{ marginTop: 6 }}>
          Cada pessoa escolhe um inscrito em cada categoria, e cada uma tem pódio de três.
        </p>
      </div>
      <div className="field">
        <label htmlFor="votacao-papeis">Papéis numerados (opcional)</label>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
          {[10, 20, 30, 50, 100].map((n) => (
            <button
              key={n}
              type="button"
              className={papeis === String(n) ? 'btn btn-sm' : 'btn btn-ghost btn-sm'}
              onClick={() => setPapeis(String(n))}
            >
              {n} convidados
            </button>
          ))}
          <button
            type="button"
            className={papeis === '' ? 'btn btn-sm' : 'btn btn-ghost btn-sm'}
            onClick={() => setPapeis('')}
          >
            sem papel
          </button>
        </div>
        <input
          id="votacao-papeis"
          className="input"
          type="number"
          min={2}
          max={999}
          placeholder="ou digite a quantidade"
          value={papeis}
          onChange={(e) => setPapeis(e.target.value)}
        />
        <p className="faint" style={{ marginTop: 6 }}>
          {/* O papel é o que transforma "alguém votou" em "o 37 votou" — e é o
              que faz um celular só servir a festa inteira. */}
          Entregue um papel a cada convidado, numerado de 1 até a quantidade acima. É o número que a
          pessoa digita para votar, e é por ele que o voto é único — não pelo aparelho. Em branco,
          vale um voto por aparelho.
        </p>
      </div>

      <div className="field">
        <label htmlFor="votacao-senha">Senha da festa (opcional)</label>
        <input
          id="votacao-senha"
          className="input"
          maxLength={40}
          placeholder="abobora"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
        />
        <p className="faint" style={{ marginTop: 6 }}>
          {/* O link é público e circula em grupo de WhatsApp. A senha é o que
              separa quem está na festa de quem só recebeu o endereço. */}
          Pedida na hora de votar, não na de se inscrever. Em branco, qualquer um com o link vota.
          {papeis.trim() !== '' &&
            ' Com papel numerado ela importa mais: quem sabe o tamanho da festa adivinha um número.'}
        </p>
      </div>

      {erro && <Erro>{erro}</Erro>}

      <div className="row" style={{ gap: 10, marginTop: 14 }}>
        <button
          className="btn"
          disabled={ocupado || titulo.trim() === '' || linhas.length === 0 || faixaInvalida}
          onClick={() => void criar()}
        >
          {ocupado ? 'Criando…' : 'Criar e abrir inscrições'}
        </button>
        <button className="btn btn-ghost" onClick={aoCancelar}>
          Cancelar
        </button>
      </div>
    </Card>
  );
}

/**
 * O pódio de uma festa já apurada.
 *
 * Os mesmos números que a página pública mostrou na noite — e `poll_results`
 * é quem decide se pode mostrar: enquanto a urna não fecha, ele devolve vazio.
 */
function Podio({ id }: { id: string }) {
  const {
    dado: linhas,
    carregando,
    erro,
  } = useDados<LinhaDoPodio[]>(() => api.resultadoDaVotacao(id), [id]);

  if (erro) return <Erro>{erro}</Erro>;
  if (carregando || !linhas) return <p className="muted">Contando…</p>;
  if (linhas.length === 0) return <p className="muted">Ninguém recebeu voto nesta votação.</p>;

  const MEDALHA = ['🥇', '🥈', '🥉'];
  // As categorias na ordem em que vieram, sem repetir: o banco já devolve
  // agrupado e ordenado, e reordenar aqui seria inventar outra ordem.
  const categorias = [...new Map(linhas.map((l) => [l.categoryId, l.category])).entries()];

  return (
    <div className="podio">
      {categorias.map(([catId, rotulo]) => (
        <section key={catId} className="podio-grupo">
          <h4>{rotulo}</h4>
          {linhas
            .filter((l) => l.categoryId === catId && l.place <= 3)
            .map((l) => (
              <div key={l.entryId} className="podio-linha">
                <span className="podio-medalha" aria-label={`${l.place}º lugar`}>
                  {MEDALHA[l.place - 1] ?? `${l.place}º`}
                </span>
                <img src={l.photoUrl} alt={l.entry} />
                <div>
                  <strong>{l.entry}</strong>
                  <p className="faint" style={{ margin: 0 }}>
                    {l.votes} {l.votes === 1 ? 'voto' : 'votos'}
                  </p>
                </div>
              </div>
            ))}
        </section>
      ))}
    </div>
  );
}

/**
 * A folha para imprimir e recortar.
 *
 * Existe porque o código é sorteado: quem organiza não tem como escrever
 * `MORCEGO 84` de cabeça em sessenta papéis. O número vem junto e pequeno —
 * é por ele que você anota quem levou qual, se quiser saber de quem é o voto
 * que falta.
 *
 * Só aparece sob um clique, e some ao imprimir tudo o que não é ela: uma
 * lista de sessenta códigos aberta na tela do balcão é a chave da festa
 * inteira exposta a quem passar por trás.
 */
function Folha({ id, titulo }: { id: string; titulo: string }) {
  const { dado: papeis, carregando, erro } = useDados<Papel[]>(() => api.papeisDaVotacao(id), [id]);

  if (erro) return <Erro>{erro}</Erro>;
  if (carregando || !papeis) return <p className="muted">Carregando os papéis…</p>;

  return (
    <div className="folha">
      <div className="folha-topo">
        <h4>{titulo} — papéis para recortar</h4>
        <button className="btn btn-sm" onClick={() => window.print()}>
          Imprimir
        </button>
      </div>
      <p className="faint folha-aviso">
        Recorte e entregue um a cada convidado. Quem já votou aparece riscado.
      </p>
      <div className="folha-grade">
        {papeis.map((t) => (
          <div key={t.number} className={t.voted ? 'papelzinho papelzinho-usado' : 'papelzinho'}>
            <span className="papelzinho-n">#{t.number}</span>
            <strong>{t.label}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Os papéis entregues, um quadradinho cada: aceso quem já votou.
 *
 * É a pergunta que fez o papel existir — "quem falta?" —, e ela não se responde
 * com um número só. Com a grade, quem organiza olha e sabe a quem cobrar.
 */
function Papeis({ total, votaram }: { total: number; votaram: number[] }) {
  const jaVotou = new Set(votaram);
  return (
    <div className="papeis" aria-label={`${votaram.length} de ${total} papéis votaram`}>
      {Array.from({ length: total }, (_, i) => i + 1).map((n) => (
        <span key={n} className={jaVotou.has(n) ? 'papel papel-on' : 'papel'}>
          {n}
        </span>
      ))}
    </div>
  );
}
