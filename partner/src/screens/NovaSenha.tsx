import { useState } from 'react';

import { api } from '@/api';
import { Erro, Marca } from '@/components/ui';

/**
 * Escolher a senha nova, depois de chegar pelo link do e-mail.
 *
 * O link já abriu a sessão — o cliente do painel roda com
 * `detectSessionInUrl`, e o clique no e-mail é a prova de acesso à caixa de
 * entrada. O que falta é a senha, e é por isso que esta tela existe em vez de
 * simplesmente deixar entrar: sem ela a pessoa cairia no painel com a senha
 * antiga ainda valendo, sem nada indicando que o pedido não se completou.
 */
export function NovaSenha({ aoSalvar }: { aoSalvar: () => void }) {
  const [senha, setSenha] = useState('');
  const [repetida, setRepetida] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const enviar = async (evento: React.FormEvent) => {
    evento.preventDefault();
    // A conferência existe porque aqui não há como errar e descobrir depois: a
    // senha antiga já não vale, e um deslize de digitação tranca a pessoa para
    // fora de novo — exatamente o buraco de onde ela está saindo.
    if (senha !== repetida) {
      setErro('As duas senhas precisam ser iguais.');
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      await api.definirNovaSenha(senha);
      aoSalvar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível salvar a senha.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="login">
      <div className="login-card">
        <Marca style={{ padding: '0 0 20px' }} />
        <section className="card">
          <form className="card-pad" onSubmit={(e) => void enviar(e)}>
            <h2 style={{ marginBottom: 4 }}>Escolha a senha nova</h2>
            <p className="faint" style={{ marginBottom: 18 }}>
              A anterior deixa de valer assim que você salvar.
            </p>

            <div className="stack">
              <div className="field">
                <label htmlFor="nova">Nova senha</label>
                <input
                  id="nova"
                  className="input"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                />
                <span className="faint">Pelo menos 8 caracteres.</span>
              </div>
              <div className="field">
                <label htmlFor="repetida">Repita a senha</label>
                <input
                  id="repetida"
                  className="input"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={repetida}
                  onChange={(e) => setRepetida(e.target.value)}
                />
              </div>

              {erro && <Erro>{erro}</Erro>}

              <button className="btn" type="submit" disabled={salvando}>
                {salvando ? 'Salvando…' : 'Salvar e entrar'}
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
