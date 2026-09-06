import { useCallback, useEffect, useState } from 'react';

import { api, emDemonstracao, type Partner } from '@/api';
import { Card, Erro } from '@/components/ui';
import { IconeHoje, IconeRepasse, IconeSair, IconeTurmas } from '@/components/icons';
import { Agenda } from '@/screens/Agenda';
import { Login } from '@/screens/Login';
import { Repasse } from '@/screens/Repasse';
import { Turmas } from '@/screens/Turmas';

type Aba = 'agenda' | 'turmas' | 'repasse';

const ABAS: { id: Aba; rotulo: string; Icone: () => React.ReactElement }[] = [
  { id: 'agenda', rotulo: 'Hoje', Icone: IconeHoje },
  { id: 'turmas', rotulo: 'Turmas e vagas', Icone: IconeTurmas },
  { id: 'repasse', rotulo: 'Repasse', Icone: IconeRepasse },
];

export function App() {
  const [estado, setEstado] = useState<'verificando' | 'fora' | 'dentro'>('verificando');
  const [parceiro, setParceiro] = useState<Partner | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aba, setAba] = useState<Aba>('agenda');

  const carregar = useCallback(async () => {
    if (!(await api.sessaoAtiva())) {
      setEstado('fora');
      setParceiro(null);
      return;
    }
    try {
      setParceiro(await api.meuParceiro());
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

  if (estado === 'fora') return <Login aoEntrar={() => void carregar()} />;

  const desconectar = async () => {
    await api.sair();
    setEstado('fora');
  };

  // Conta válida sem vínculo com parceiro: é o caso de alguém entrar aqui com a
  // conta de família. Explicar é melhor do que mostrar um painel vazio, que
  // pareceria um estabelecimento sem nenhuma turma.
  if (!parceiro) {
    return (
      <div className="login">
        <div className="login-card">
          <Card>
            <h2>Conta sem estabelecimento</h2>
            <p className="muted" style={{ marginTop: 8 }}>
              Esta conta não administra nenhum parceiro do Kidoo. Se você é uma família, use o
              aplicativo; se é um estabelecimento, fale com a gente para liberar o acesso.
            </p>
            {erro && (
              <div style={{ marginTop: 12 }}>
                <Erro>{erro}</Erro>
              </div>
            )}
            <button className="btn btn-ghost" style={{ marginTop: 16 }} onClick={() => void desconectar()}>
              Sair
            </button>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="shell">
      <nav className="sidebar" aria-label="Seções do painel">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            K
          </span>
          <span>
            <span className="brand-name">Kidoo</span>
            <div className="brand-role">Painel do parceiro</div>
          </span>
        </div>

        {ABAS.map((item) => (
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
            <strong style={{ color: 'var(--text)' }}>{parceiro.name}</strong>
            <br />
            {parceiro.neighborhood} · {parceiro.city}
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
        {aba === 'agenda' && <Agenda />}
        {aba === 'turmas' && <Turmas parceiro={parceiro} />}
        {aba === 'repasse' && <Repasse />}
      </main>
    </div>
  );
}
