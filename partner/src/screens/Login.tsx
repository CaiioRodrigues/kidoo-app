import { useState } from 'react';

import { api, emDemonstracao } from '@/api';
import { Erro } from '@/components/ui';

export function Login({ aoEntrar }: { aoEntrar: () => void }) {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const enviar = async (evento: React.FormEvent) => {
    evento.preventDefault();
    setEnviando(true);
    setErro(null);
    try {
      await api.entrar(email.trim(), senha);
      aoEntrar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível entrar.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="login">
      <div className="login-card">
        <div className="brand" style={{ padding: '0 0 20px' }}>
          <span className="brand-mark" aria-hidden="true">
            K
          </span>
          <span>
            <span className="brand-name">Kidoo</span>
            <div className="brand-role">Painel do parceiro</div>
          </span>
        </div>

        <section className="card">
          <form className="card-pad" onSubmit={(e) => void enviar(e)}>
            <h2 style={{ marginBottom: 4 }}>Entrar</h2>
            <p className="faint" style={{ marginBottom: 18 }}>
              Use o e-mail cadastrado para o seu estabelecimento.
            </p>

            <div className="stack">
              <div className="field">
                <label htmlFor="email">E-mail</label>
                <input
                  id="email"
                  className="input"
                  type="email"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="senha">Senha</label>
                <input
                  id="senha"
                  className="input"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                />
              </div>

              {erro && <Erro>{erro}</Erro>}

              <button className="btn" type="submit" disabled={enviando}>
                {enviando ? 'Entrando…' : 'Entrar'}
              </button>
            </div>
          </form>
        </section>

        <p className="faint" style={{ marginTop: 14, textAlign: 'center' }}>
          {emDemonstracao
            ? 'Modo demonstração: entre com qualquer e-mail e uma senha de 4 letras para ver o painel com dados fictícios.'
            : 'Sua sessão fica só nesta aba: fechar o navegador desconecta. É de propósito — o computador da recepção costuma ser compartilhado.'}
        </p>
      </div>
    </div>
  );
}
