import { useState } from 'react';

import { useDados } from '@/components/ui';

import {
  inscrever,
  jaVotei,
  resultado,
  urlDaFoto,
  votacaoAtual,
  votar,
  type LinhaDoPodio,
  type Votacao as VotacaoAtiva,
} from './api';

/**
 * A votação, do lado de quem participa.
 *
 * Pública: quem chega é convidado de festa, sem conta e com o celular na mão.
 * Por isso a página inteira é um caminho só, sem menu — e por isso a foto abre
 * a câmera direto no telefone (`capture`), em vez de mandar a pessoa procurar
 * na galeria uma foto que ela ainda não tirou.
 *
 * A decoração é de Halloween porque a primeira votação é de fantasia. O que
 * está POR BAIXO não sabe disso: as tabelas falam de "votação", "categoria" e
 * "inscrito", e servem para melhor parceiro do ano sem trocar uma linha.
 */
type Passo = 'porta' | 'inscrever' | 'numero' | 'votar' | 'resultado';

export function Votacao() {
  const [passo, setPasso] = useState<Passo>('porta');
  // Quem acabou de votar nesta sessão. O banco é a verdade — `ja_votei` —,
  // mas ele só é consultado ao abrir a página: sem isto, votar e voltar para a
  // porta mostraria o botão "Votar" de novo, e o segundo toque só descobriria
  // que o voto já existe depois de preencher a cédula inteira.
  const [votouAgora, setVotouAgora] = useState(false);
  // O papel que a pessoa digitou na porta. Vazio numa festa sem papel — ali a
  // identidade continua sendo o aparelho.
  const [numero, setNumero] = useState('');

  const { dado, carregando, erro, recarregar } = useDados(async () => {
    const atual = await votacaoAtual();
    // Com papel numerado não há o que perguntar ao abrir a página: quem vota é
    // o número, e ele só existe depois que a pessoa digitar. Perguntar pelo
    // aparelho aqui diria "já votou" para quem emprestou o celular.
    const votou = atual && atual.numeros === null ? await jaVotei(atual.id) : false;
    return { votacao: atual, votou };
  }, []);

  const votacao = dado?.votacao ?? null;
  const votou = votouAgora || (dado?.votou ?? false);

  return (
    <div className="hw">
      <Teia />
      <Teia canto="hw-teia-2" />
      <main className="hw-palco">
        <h1 className="hw-titulo">{votacao?.title ?? 'Votação'}</h1>
        {votacao?.subtitle ? <p className="hw-sub">{votacao.subtitle}</p> : null}

        {carregando ? (
          <p className="hw-espera">Abrindo os portões…</p>
        ) : erro ? (
          <p className="hw-erro">{erro}</p>
        ) : !votacao ? (
          <p className="hw-espera">Nenhuma votação acontecendo agora.</p>
        ) : passo === 'porta' ? (
          <Porta votacao={votacao} votou={votou} aoEscolher={setPasso} />
        ) : passo === 'inscrever' ? (
          <Inscricao
            votacao={votacao}
            aoTerminar={() => {
              setPasso('porta');
              recarregar();
            }}
          />
        ) : passo === 'numero' ? (
          <Numero
            votacao={votacao}
            aoConferir={(n) => {
              setNumero(n);
              setPasso('votar');
            }}
          />
        ) : passo === 'votar' ? (
          <Cedula
            votacao={votacao}
            numero={numero}
            aoTerminar={() => {
              setVotouAgora(true);
              setNumero('');
              setPasso('porta');
            }}
          />
        ) : (
          <Resultado votacao={votacao} />
        )}

        {passo !== 'porta' ? (
          <button className="hw-voltar" onClick={() => setPasso('porta')}>
            ← voltar
          </button>
        ) : null}
      </main>
    </div>
  );
}

/** A tela de entrada: o botão grande, e o que dá para fazer agora. */
function Porta({
  votacao,
  votou,
  aoEscolher,
}: {
  votacao: VotacaoAtiva;
  votou: boolean;
  aoEscolher: (p: Passo) => void;
}) {
  if (votacao.status === 'apurada') {
    return (
      <>
        <p className="hw-espera">A votação terminou. Quem levou?</p>
        <button className="hw-botao" onClick={() => aoEscolher('resultado')}>
          <span className="hw-abobora" aria-hidden>
            🏆
          </span>
          Ver o resultado
        </button>
      </>
    );
  }

  return (
    <>
      <button
        className="hw-botao"
        disabled={votacao.status !== 'inscricoes'}
        onClick={() => aoEscolher('inscrever')}
      >
        <span className="hw-abobora" aria-hidden>
          🎃
        </span>
        Entrar na disputa
      </button>
      {votacao.status !== 'inscricoes' ? (
        <p className="hw-nota">As inscrições já fecharam.</p>
      ) : (
        <p className="hw-nota">Tire uma foto da sua fantasia e escolha um nome.</p>
      )}

      <button
        className="hw-botao hw-botao-2"
        disabled={votacao.status !== 'votacao' || votou}
        onClick={() => aoEscolher(votacao.numeros === null ? 'votar' : 'numero')}
      >
        <span className="hw-abobora" aria-hidden>
          🗳️
        </span>
        {votou ? 'Você já votou' : 'Votar'}
      </button>
      {votacao.status === 'inscricoes' ? (
        <p className="hw-nota">A votação abre quando todo mundo estiver inscrito.</p>
      ) : votou ? (
        <p className="hw-nota">O resultado sai no fim da festa.</p>
      ) : (
        <p className="hw-nota">
          {votacao.entries.length} na disputa · {votacao.categories.length} categorias
          {votacao.numeros !== null ? ' · tenha o seu papel em mãos' : null}
        </p>
      )}
    </>
  );
}

function Inscricao({ votacao, aoTerminar }: { votacao: VotacaoAtiva; aoTerminar: () => void }) {
  const [nome, setNome] = useState('');
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [previa, setPrevia] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const escolher = (f: File | undefined) => {
    if (!f) return;
    setArquivo(f);
    // A prévia não é enfeite: é como a pessoa descobre que a foto saiu
    // tremida ANTES de ela virar a cara dela na cédula de todo mundo.
    setPrevia(URL.createObjectURL(f));
  };

  const enviar = async () => {
    if (!arquivo || !nome.trim()) return;
    setEnviando(true);
    setErro(null);
    try {
      await inscrever(votacao.id, nome, arquivo);
      aoTerminar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não deu.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="hw-caixa">
      <h2 className="hw-h2">Sua fantasia</h2>

      <label className="hw-foto">
        {previa ? (
          <img src={previa} alt="Sua fantasia" />
        ) : (
          <span>
            <strong>📸</strong>
            <br />
            tocar para tirar a foto
          </span>
        )}
        {/*
          `capture` abre a câmera direto no celular, em vez da galeria. Quem
          está na festa vai tirar a foto agora — mandá-lo procurar numa galeria
          uma foto que ainda não existe é o caminho mais longo possível.
        */}
        <input
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(e) => escolher(e.target.files?.[0])}
        />
      </label>

      <input
        className="hw-input"
        placeholder="Nome da fantasia (ou o seu)"
        maxLength={60}
        value={nome}
        onChange={(e) => setNome(e.target.value)}
      />

      {erro ? <p className="hw-erro">{erro}</p> : null}

      <button
        className="hw-botao"
        disabled={!arquivo || nome.trim().length < 2 || enviando}
        onClick={() => void enviar()}
      >
        {enviando ? 'Entrando…' : 'Estou na disputa'}
      </button>
    </div>
  );
}

/**
 * O papel entregue na porta.
 *
 * Vem ANTES da cédula de propósito: o número é conferido aqui, contra a faixa
 * e contra quem já votou. Descobrir na hora de enviar que o papel já votou
 * seria jogar fora três escolhas e parecer que o sistema comeu o voto.
 */
function Numero({
  votacao,
  aoConferir,
}: {
  votacao: VotacaoAtiva;
  aoConferir: (numero: string) => void;
}) {
  const [numero, setNumero] = useState('');
  const [conferindo, setConferindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const conferir = async () => {
    setConferindo(true);
    setErro(null);
    try {
      if (await jaVotei(votacao.id, numero)) {
        setErro(`O papel ${Number(numero)} já votou.`);
        return;
      }
      aoConferir(numero);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não deu para conferir.');
    } finally {
      setConferindo(false);
    }
  };

  return (
    <div className="hw-caixa">
      <h2 className="hw-h2">O número do seu papel</h2>
      <p className="hw-nota" style={{ margin: '0 0 12px' }}>
        Está no papel que você recebeu na entrada, de 1 a {votacao.numeros}. É ele que garante um
        voto por pessoa — então o mesmo celular serve para todo mundo.
      </p>
      <input
        className="hw-input"
        /* `inputMode` numérico abre o teclado de números no celular sem virar
           um campo com setinhas de incremento, que não fazem sentido aqui. */
        inputMode="numeric"
        autoComplete="off"
        maxLength={3}
        placeholder="Ex.: 7"
        value={numero}
        onChange={(e) => setNumero(e.target.value.replace(/\D/g, ''))}
      />

      {erro ? <p className="hw-erro">{erro}</p> : null}

      <button
        className="hw-botao"
        disabled={numero === '' || conferindo}
        onClick={() => void conferir()}
      >
        {conferindo ? 'Conferindo…' : 'Continuar'}
      </button>
    </div>
  );
}

function Cedula({
  votacao,
  numero,
  aoTerminar,
}: {
  votacao: VotacaoAtiva;
  numero: string;
  aoTerminar: () => void;
}) {
  const [escolhas, setEscolhas] = useState<Record<string, string>>({});
  const [senha, setSenha] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const faltam = votacao.categories.filter((c) => !escolhas[c.id]).length;

  const enviar = async () => {
    setEnviando(true);
    setErro(null);
    try {
      await votar(votacao.id, escolhas, senha, numero === '' ? undefined : numero);
      aoTerminar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não deu.');
    } finally {
      setEnviando(false);
    }
  };

  if (votacao.entries.length === 0) {
    return <p className="hw-espera">Ninguém se inscreveu ainda.</p>;
  }

  return (
    <div className="hw-caixa">
      {/* De quem é esta cédula. Sem isto, quem digitou o número três telas
          atrás não tem como conferir que acertou antes de enviar. */}
      {numero !== '' ? (
        <p className="hw-nota" style={{ margin: '0 0 14px' }}>
          Papel {Number(numero)}
        </p>
      ) : null}
      {votacao.categories.map((cat) => (
        <section key={cat.id} className="hw-categoria">
          <h2 className="hw-h2">{cat.label}</h2>
          <div className="hw-grade">
            {votacao.entries.map((ins) => {
              const marcado = escolhas[cat.id] === ins.id;
              return (
                <button
                  key={ins.id}
                  className={`hw-card ${marcado ? 'hw-card-on' : ''}`}
                  aria-pressed={marcado}
                  onClick={() => setEscolhas((a) => ({ ...a, [cat.id]: ins.id }))}
                >
                  <img src={urlDaFoto(ins.photoPath)} alt={ins.name} />
                  <span>{ins.name}</span>
                </button>
              );
            })}
          </div>
        </section>
      ))}

      {votacao.protegida ? (
        <input
          className="hw-input"
          placeholder="Senha da festa"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
        />
      ) : null}

      {erro ? <p className="hw-erro">{erro}</p> : null}

      <button className="hw-botao" disabled={faltam > 0 || enviando} onClick={() => void enviar()}>
        {enviando
          ? 'Registrando…'
          : faltam > 0
            ? // Contar o que falta, em vez de só desabilitar: botão morto sem
              // explicação é a pessoa achando que a página travou.
              `Faltam ${faltam} de ${votacao.categories.length}`
            : 'Confirmar meu voto'}
      </button>
    </div>
  );
}

function Resultado({ votacao }: { votacao: VotacaoAtiva }) {
  const { dado: linhas, erro } = useDados<LinhaDoPodio[]>(
    () => resultado(votacao.id),
    [votacao.id],
  );

  if (erro) return <p className="hw-erro">{erro}</p>;
  if (!linhas) return <p className="hw-espera">Contando…</p>;
  if (linhas.length === 0) return <p className="hw-espera">Ninguém recebeu voto.</p>;

  const MEDALHA = ['🥇', '🥈', '🥉'];

  return (
    <div className="hw-caixa">
      {votacao.categories.map((cat) => {
        const doGrupo = linhas.filter((l) => l.categoryId === cat.id).slice(0, 3);
        if (doGrupo.length === 0) return null;
        return (
          <section key={cat.id} className="hw-categoria">
            <h2 className="hw-h2">{cat.label}</h2>
            {doGrupo.map((l) => (
              <div key={l.entryId} className="hw-podio">
                <span className="hw-medalha" aria-label={`${l.place}º lugar`}>
                  {MEDALHA[l.place - 1] ?? `${l.place}º`}
                </span>
                <img src={urlDaFoto(l.photoPath)} alt={l.entry} />
                <div>
                  <strong>{l.entry}</strong>
                  <p className="hw-votos">
                    {l.votes} {l.votes === 1 ? 'voto' : 'votos'}
                  </p>
                </div>
              </div>
            ))}
          </section>
        );
      })}
    </div>
  );
}

/** Teia no canto. Desenhada, não emoji: emoji quem desenha é o sistema. */
function Teia({ canto }: { canto?: string }) {
  return (
    <svg className={canto ? `hw-teia ${canto}` : 'hw-teia'} viewBox="0 0 120 120" aria-hidden>
      {[28, 52, 76, 100].map((r) => (
        <path
          key={r}
          d={`M0 ${r} Q ${r / 2} ${r / 2} ${r} 0`}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        />
      ))}
      {[0, 22.5, 45, 67.5, 90].map((a) => {
        const rad = (a * Math.PI) / 180;
        return (
          <line
            key={a}
            x1="0"
            y1="0"
            x2={110 * Math.sin(rad)}
            y2={110 * Math.cos(rad)}
            stroke="currentColor"
            strokeWidth="1.5"
          />
        );
      })}
    </svg>
  );
}
