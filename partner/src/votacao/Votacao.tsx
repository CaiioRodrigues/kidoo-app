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
type Passo = 'porta' | 'inscrever' | 'votar' | 'resultado';

export function Votacao() {
  const [passo, setPasso] = useState<Passo>('porta');
  // Quem acabou de votar nesta sessão. O banco é a verdade — `ja_votei` —,
  // mas ele só é consultado ao abrir a página: sem isto, votar e voltar para a
  // porta mostraria o botão "Votar" de novo, e o segundo toque só descobriria
  // que o voto já existe depois de preencher a cédula inteira.
  const [votouAgora, setVotouAgora] = useState(false);

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
        ) : passo === 'votar' ? (
          <Cedula
            votacao={votacao}
            aoTerminar={() => {
              setVotouAgora(true);
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
        onClick={() => aoEscolher('votar')}
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
 * A cédula, uma categoria por vez.
 *
 * Com quatro fantasias, mostrar tudo de uma vez era o certo. Com quarenta em
 * três categorias são cento e vinte fotos na mesma rolagem, e a pessoa perde
 * de vista o que já escolheu — ou desiste.
 *
 * Então vira um caminho: uma categoria por tela, o que falta dito em cima, e
 * no fim uma revisão com as três escolhas lado a lado. A chave — o papel e a
 * senha — só aparece nessa última tela: pedir a credencial antes de a pessoa
 * ter escolhido alguma coisa é cobrar o ingresso de quem ainda está na fila.
 *
 * O número é conferido ali mesmo, ao sair do campo, e não no envio: assim o
 * "esse papel já votou" chega com as escolhas ainda na tela, e não depois de
 * jogá-las fora.
 */
function Cedula({ votacao, aoTerminar }: { votacao: VotacaoAtiva; aoTerminar: () => void }) {
  const [escolhas, setEscolhas] = useState<Record<string, string>>({});
  // Qual categoria está na tela. Igual ao total = a revisão final.
  const [passo, setPasso] = useState(0);
  const [numero, setNumero] = useState('');
  const [senha, setSenha] = useState('');
  const [busca, setBusca] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const total = votacao.categories.length;
  const categoria = votacao.categories[passo];

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

  /** Confere o papel assim que ele sai do campo, com as escolhas ainda de pé. */
  const conferirNumero = async () => {
    if (numero === '') return;
    setErro(null);
    try {
      if (await jaVotei(votacao.id, numero)) setErro(`O papel ${Number(numero)} já votou.`);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não deu para conferir o número.');
    }
  };

  if (votacao.entries.length === 0) {
    return <p className="hw-espera">Ninguém se inscreveu ainda.</p>;
  }

  // ------------------------------------------------------------- revisão --
  if (!categoria) {
    const faltaChave =
      (votacao.numeros !== null && numero === '') || (votacao.protegida && senha === '');
    return (
      <div className="hw-caixa">
        <h2 className="hw-h2">Confira e confirme</h2>

        {votacao.categories.map((cat, i) => {
          const dela = votacao.entries.find((e) => e.id === escolhas[cat.id]);
          return (
            <div key={cat.id} className="hw-revisao">
              {dela ? <img src={urlDaFoto(dela.photoPath)} alt={dela.name} /> : null}
              <div className="hw-revisao-texto">
                <span className="hw-revisao-cat">{cat.label}</span>
                <strong>{dela?.name ?? '—'}</strong>
              </div>
              <button className="hw-trocar" onClick={() => setPasso(i)}>
                trocar
              </button>
            </div>
          );
        })}

        {votacao.numeros !== null ? (
          <input
            className="hw-input"
            /* Teclado numérico no celular, sem as setinhas de incremento de um
               `type="number"` — ninguém escolhe o próprio papel subindo de um
               em um. */
            inputMode="numeric"
            autoComplete="off"
            maxLength={3}
            placeholder={`Número do seu papel (1 a ${votacao.numeros})`}
            value={numero}
            onChange={(e) => setNumero(e.target.value.replace(/\D/g, ''))}
            onBlur={() => void conferirNumero()}
          />
        ) : null}

        {votacao.protegida ? (
          <input
            className="hw-input"
            placeholder="Senha da festa"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
          />
        ) : null}

        {erro ? <p className="hw-erro">{erro}</p> : null}

        <button
          className="hw-botao"
          disabled={faltaChave || enviando}
          onClick={() => void enviar()}
        >
          {enviando ? 'Registrando…' : 'Confirmar meu voto'}
        </button>
        <button className="hw-voltar" onClick={() => setPasso(total - 1)}>
          ← voltar para a última categoria
        </button>
      </div>
    );
  }

  // ----------------------------------------------------------- categoria --
  const escolhida = escolhas[categoria.id];
  // A busca só aparece quando a rolagem começa a doer. Numa festa de oito
  // fantasias ela seria um campo a mais para ignorar.
  const temBusca = votacao.entries.length > 12;
  const lista = temBusca
    ? votacao.entries.filter((e) => e.name.toLowerCase().includes(busca.trim().toLowerCase()))
    : votacao.entries;

  const avancar = () => {
    setBusca('');
    setPasso(passo + 1);
  };

  return (
    <div className="hw-caixa">
      <p className="hw-passo">
        Categoria {passo + 1} de {total}
      </p>
      <h2 className="hw-h2">{categoria.label}</h2>

      {temBusca ? (
        <input
          className="hw-input hw-busca"
          placeholder="Procurar pelo nome"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
      ) : null}

      <div className="hw-grade">
        {lista.map((ins) => {
          const marcado = escolhida === ins.id;
          return (
            <button
              key={ins.id}
              className={`hw-card ${marcado ? 'hw-card-on' : ''}`}
              aria-pressed={marcado}
              onClick={() => setEscolhas((a) => ({ ...a, [categoria.id]: ins.id }))}
            >
              <img src={urlDaFoto(ins.photoPath)} alt={ins.name} />
              <span>{ins.name}</span>
            </button>
          );
        })}
      </div>
      {lista.length === 0 ? <p className="hw-nota">Ninguém com esse nome.</p> : null}

      {/*
        Grudado embaixo porque com quarenta fantasias o fim da lista fica a
        catorze rolagens do começo: um botão lá no fundo é um botão que só
        existe para quem procura.
      */}
      <div className="hw-barra">
        {passo > 0 ? (
          <button className="hw-voltar hw-barra-voltar" onClick={() => setPasso(passo - 1)}>
            ←
          </button>
        ) : null}
        <button className="hw-botao" disabled={!escolhida} onClick={avancar}>
          {!escolhida
            ? // Dizer o que falta, em vez de só apagar o botão: botão morto sem
              // explicação é a pessoa achando que a página travou.
              'Escolha uma fantasia'
            : passo + 1 < total
              ? 'Próxima categoria'
              : 'Revisar meu voto'}
        </button>
      </div>
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
