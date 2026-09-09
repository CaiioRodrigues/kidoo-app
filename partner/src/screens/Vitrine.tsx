import { Marca } from '@/components/ui';

/**
 * A porta da rua do painel.
 *
 * Antes, a URL do painel abria direto no formulário de login — porta sem
 * placa. Quem chega aqui pela primeira vez é o dono de uma escolinha que
 * recebeu um link e não sabe o que é o Kidoo; pedir e-mail e senha a essa
 * pessoa é pedir que ela decida antes de entender.
 *
 * O que a página faz é uma coisa só: explicar em trinta segundos e oferecer
 * um caminho. Sem preço, sem percentual, sem "junte-se a centenas de
 * parceiros" — não existem centenas, e prometer número que não temos é a
 * forma mais barata de perder a conversa na primeira reunião.
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
      <header className="vitrine-topo">
        <Marca papel="Para estabelecimentos" style={{ padding: 0 }} />
        <button className="btn btn-ghost btn-sm" onClick={aoEntrar}>
          Entrar
        </button>
      </header>

      <main>
        <section className="vitrine-hero">
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
            <p className="muted" style={{ marginTop: 14 }}>
              O cadastro é um formulário: onde fica, o que oferece, para que idades. A gente
              lê, responde e libera o painel.
            </p>
            <button className="btn" style={{ marginTop: 16 }} onClick={aoCadastrar}>
              Cadastrar meu espaço
            </button>
          </div>
        </section>
      </main>

      <footer className="vitrine-rodape">
        <span className="faint">Kidoo · Belo Horizonte</span>
        <button className="btn-link" onClick={aoEntrar}>
          Entrar no painel
        </button>
      </footer>
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
