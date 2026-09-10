import { useCallback, useEffect, useState } from 'react';

import { api, emDemonstracao, type Partner } from '@/api';
import { Erro, Marca } from '@/components/ui';
import { IconeHoje, IconePedidos, IconeRepasse, IconeSair, IconeTurmas } from '@/components/icons';
import { Agenda } from '@/screens/Agenda';
import { Cadastro } from '@/screens/Cadastro';
import { Login } from '@/screens/Login';
import { Pedidos } from '@/screens/Pedidos';
import { Repasse } from '@/screens/Repasse';
import { Turmas } from '@/screens/Turmas';
import { Rodape } from '@/components/Rodape';
import { Vitrine } from '@/screens/Vitrine';

type Aba = 'agenda' | 'turmas' | 'repasse' | 'pedidos';

type ItemDeMenu = { id: Aba; rotulo: string; Icone: () => React.ReactElement };

/** Só entra no menu de quem analisa pedidos, e por isso fica fora da lista. */
const PEDIDOS_ABA: ItemDeMenu = { id: 'pedidos', rotulo: 'Pedidos', Icone: IconePedidos };

const ABAS: ItemDeMenu[] = [
  { id: 'agenda', rotulo: 'Hoje', Icone: IconeHoje },
  { id: 'turmas', rotulo: 'Turmas e vagas', Icone: IconeTurmas },
  { id: 'repasse', rotulo: 'Repasse', Icone: IconeRepasse },
];

export function App() {
  const [estado, setEstado] = useState<'verificando' | 'fora' | 'dentro'>('verificando');
  const [parceiros, setParceiros] = useState<Partner[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [aba, setAba] = useState<Aba>('agenda');
  const [doKidoo, setDoKidoo] = useState(false);
  // Muda a cada envio de pedido, para a tela de cadastro reler o estado dele
  // sem que a página inteira recarregue.
  const [gatilho, setGatilho] = useState(0);
  // Quem chega sem sessão vê a vitrine primeiro. Só depois de escolher um
  // caminho é que aparece o formulário — e ele já abre na aba certa.
  const [porta, setPorta] = useState<null | 'entrar' | 'criar'>(null);

  const carregar = useCallback(async () => {
    if (!(await api.sessaoAtiva())) {
      setEstado('fora');
      setParceiros([]);
      setDoKidoo(false);
      return;
    }
    try {
      const [meus, admin] = await Promise.all([api.meusParceiros(), api.souDoKidoo()]);
      setParceiros(meus);
      setDoKidoo(admin);
      setErro(null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Algo deu errado.');
    }
    setEstado('dentro');
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  if (estado === 'verificando') {
    return (
      <div className="login">
        <p className="muted">Carregando…</p>
      </div>
    );
  }

  if (estado === 'fora') {
    if (!porta) {
      return (
        <Vitrine aoCadastrar={() => setPorta('criar')} aoEntrar={() => setPorta('entrar')} />
      );
    }
    return (
      <Login
        modoInicial={porta}
        aoVoltar={() => setPorta(null)}
        aoEntrar={() => void carregar()}
      />
    );
  }

  const desconectar = async () => {
    await api.sair();
    setPorta(null);
    setEstado('fora');
  };

  const parceiro = parceiros[0];
  // Mais de um lugar na mesma conta deixa de ser detalhe: é o que decide se a
  // tela precisa dizer de quem é cada turma.
  const varios = parceiros.length > 1;

  /*
    Conta sem estabelecimento deixou de ser um beco.

    Antes esta tela dizia "fale com a gente para liberar o acesso" — o que era
    honesto e inútil: o cadastro só existia rodando SQL à mão. Agora ela É o
    cadastro. Quem chegar aqui por engano com a conta de família continua
    entendendo o que aconteceu, porque o formulário se apresenta.

    Quem analisa pedidos e ainda não tem estabelecimento próprio (o caso da
    operação do Kidoo) cai na fila de pedidos, não no formulário: mandá-lo
    cadastrar uma escolinha seria o oposto do que ele veio fazer.
  */
  if (!parceiro) {
    if (doKidoo) {
      return (
        <div className="shell">
          <nav className="sidebar" aria-label="Seções do painel">
            <Marca papel="Operação" />
            <button className="nav-item" aria-current="page">
              <IconePedidos />
              Pedidos
            </button>
            <div className="sidebar-foot">
              <button className="nav-item" onClick={() => void desconectar()}>
                <IconeSair />
                Sair
              </button>
            </div>
          </nav>
          <main className="main">
            <Pedidos />
          </main>
        </div>
      );
    }

    return (
      <div className="cadastro-pagina">
        <div className="cadastro-cabeca">
          <Marca papel="Abra as vagas que sobram no seu horário" style={{ padding: 0 }} />
          <button className="btn btn-ghost btn-sm" onClick={() => void desconectar()}>
            Sair
          </button>
        </div>
        {erro && <Erro>{erro}</Erro>}
        <Cadastro key={gatilho} aoEnviar={() => setGatilho((n) => n + 1)} />
      </div>
    );
  }

  return (
    <div className="shell">
      <nav className="sidebar" aria-label="Seções do painel">
        <Marca />

        {[...ABAS, ...(doKidoo ? [PEDIDOS_ABA] : [])].map((item) => (
          <button
            key={item.id}
            className="nav-item"
            aria-current={aba === item.id ? 'page' : undefined}
            onClick={() => setAba(item.id)}
          >
            <item.Icone />
            {item.rotulo}
          </button>
        ))}

        <div className="sidebar-foot">
          <div className="sidebar-who">
            {/*
              Com mais de um estabelecimento, mostrar só o primeiro seria dizer
              que a agenda é dele — e ela traz as turmas de todos.
            */}
            {varios ? (
              <>
                <strong style={{ color: 'var(--text)' }}>
                  {parceiros.length} estabelecimentos
                </strong>
                <br />
                {parceiros.map((p) => p.name).join(' · ')}
              </>
            ) : (
              <>
                <strong style={{ color: 'var(--text)' }}>{parceiro.name}</strong>
                <br />
                {parceiro.neighborhood} · {parceiro.city}
              </>
            )}
          </div>
          <button className="nav-item" onClick={() => void desconectar()}>
            <IconeSair />
            Sair
          </button>
          {/* Quem opera precisa saber se o que está na tela vale alguma coisa.
              Sem este aviso, uma demonstração e um dia real são idênticos. */}
          {emDemonstracao && (
            <p className="sidebar-who" style={{ paddingTop: 10 }}>
              Modo demonstração: os dados são fictícios.
            </p>
          )}
        </div>
      </nav>

      <main className="main">
        {aba === 'agenda' && <Agenda varios={varios} />}
        {aba === 'turmas' && <Turmas parceiros={parceiros} varios={varios} />}
        {aba === 'repasse' && <Repasse />}
        {aba === 'pedidos' && <Pedidos />}

        {/* Sem ação: quem está aqui já entrou e já tem espaço cadastrado.
            Repetir "Cadastrar meu espaço" para essa pessoa seria oferecer a
            porta a quem já está dentro de casa. */}
        <Rodape />
      </main>
    </div>
  );
}
