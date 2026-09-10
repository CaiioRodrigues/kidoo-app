import { Marca } from '@/components/ui';
import { Blobs, Kiddo, MODALIDADES } from '@/components/marca';
import { Rodape } from '@/components/Rodape';

/**
 * A porta da rua do painel.
 *
 * Antes, a URL abria direto no formulário de e-mail e senha — porta sem placa.
 * Quem chega aqui pela primeira vez é o dono de uma escolinha que recebeu um
 * link e não sabe o que é o Kidoo; pedir credencial a essa pessoa é pedir que
 * ela decida antes de entender.
 *
 * A página faz uma coisa só: explicar em trinta segundos e oferecer um caminho.
 * Sem preço, sem percentual, sem "junte-se a centenas de parceiros" — não
 * existem centenas, e prometer número que não temos é a forma mais barata de
 * perder a conversa na primeira reunião.
 *
 * A identidade é a mesma do aplicativo, e isso não é enfeite: metade de quem
 * chega aqui já viu o Kidoo pela tela do filho. Se o painel parecer outro
 * produto, a confiança que veio junto se perde na porta.
 */
export function Vitrine({
  aoCadastrar,
  aoEntrar,
}: {
  aoCadastrar: () => void;
  aoEntrar: () => void;
}) {
  return (
    <div className="vitrine">
      {/* Ancorado no topo da página, e não dentro do herói: as formas são
          desenhadas com boa parte do corpo acima da moldura, então presas mais
          abaixo elas mostram a borda reta do recorte no meio da tela. Nascendo
          fora do quadro, lêem como o que são — algo maior que a tela. */}
      <Blobs />
      <header className="vitrine-topo">
        <Marca papel="Para estabelecimentos" style={{ padding: 0 }} />
        <button className="btn btn-ghost btn-sm" onClick={aoEntrar}>
          Entrar
        </button>
      </header>

      <main>
        <section className="vitrine-hero">
          <div className="vitrine-fala">
            <h1 className="vitrine-titulo">
              Sua turma tem lugar sobrando.
              <br />
              <span className="vitrine-destaque">A gente leva criança até ele.</span>
            </h1>
            <p className="vitrine-linha">
              O Kidoo é um clube de atividades para crianças. A família assina e experimenta
              futebol numa semana, natação na outra — no seu espaço, na turma que já ia
              acontecer de qualquer jeito.
            </p>
            <div className="vitrine-acoes">
              <button className="btn" onClick={aoCadastrar}>
                Quero ser parceiro
              </button>
              <button className="btn btn-ghost" onClick={aoEntrar}>
                Já sou parceiro
              </button>
            </div>
            <p className="faint">Estamos começando por Belo Horizonte.</p>
          </div>
          {/* Escondido de leitores de tela: o mascote não acrescenta informação
              a quem já ouviu o título, e anunciá-lo só atrasa a chegada ao botão. */}
          <div className="vitrine-mascote" aria-hidden="true">
            <Kiddo size={168} />
          </div>
        </section>

        <section className="vitrine-modalidades" aria-label="Modalidades que o Kidoo reúne">
          <h2 className="vitrine-subtitulo">Cabe todo tipo de espaço</h2>
          <ul className="vitrine-chips">
            {MODALIDADES.map((m) => (
              <li
                key={m.nome}
                className="chip-modalidade-cor"
                /* Como variáveis, e não como `background`/`color` diretos: o
                   CSS precisa poder trocar o par no tema escuro, e estilo
                   inline vence qualquer media query. */
                style={
                  {
                    '--m-cor': m.cor,
                    '--m-fundo': m.fundo,
                    '--m-cor-escura': m.corEscura,
                    '--m-fundo-escuro': m.fundoEscuro,
                  } as React.CSSProperties
                }
              >
                {m.nome}
              </li>
            ))}
          </ul>
        </section>

        <section className="vitrine-passos" aria-label="Como funciona">
          <Passo
            n={1}
            titulo="Você abre o que sobra"
            texto="Escolhe a turma, o horário e quantos lugares libera. O resto da sua grade continua sendo só sua."
          />
          <Passo
            n={2}
            titulo="A família reserva pelo app"
            texto="Ela já paga a assinatura do Kidoo. Escolhe o horário, aparece no dia e faz o check-in na sua recepção."
          />
          <Passo
            n={3}
            titulo="Você recebe por quem veio"
            texto="Cada criança que apareceu vira repasse, com o extrato aberto no painel. Quem não apareceu não entra na conta."
          />
        </section>

        <section className="card vitrine-requisitos">
          <div className="card-pad">
            <h2 style={{ marginBottom: 10 }}>Dá para ser parceiro se você tem</h2>
            <ul className="vitrine-lista">
              <li>um espaço com atividade para criança — esporte, arte, música, o que for;</li>
              <li>alguma turma com lugar sobrando em algum horário;</li>
              <li>CNPJ e uma conta para receber.</li>
            </ul>
            <div className="vitrine-fecho">
              <p className="muted" style={{ margin: 0 }}>
                O cadastro é um formulário: onde fica, o que oferece, para que idades. A gente
                lê, responde e libera o painel.
              </p>
              <button className="btn" onClick={aoCadastrar}>
                Cadastrar meu espaço
              </button>
            </div>
          </div>
        </section>
      </main>

      <Rodape aoCadastrar={aoCadastrar} aoEntrar={aoEntrar} />
    </div>
  );
}

function Passo({ n, titulo, texto }: { n: number; titulo: string; texto: string }) {
  return (
    <article className="vitrine-passo">
      {/* O número é decoração: quem usa leitor de tela já recebe a ordem da
          lista, e ouvir "um" antes de cada título só atrasa. */}
      <span className="vitrine-numero" aria-hidden="true">
        {n}
      </span>
      <h3>{titulo}</h3>
      <p className="muted">{texto}</p>
    </article>
  );
}
