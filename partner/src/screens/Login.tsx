import { useState } from 'react';

import { api, emDemonstracao } from '@/api';
import { Erro, Marca } from '@/components/ui';

type Modo = 'entrar' | 'criar' | 'recuperar';

/**
 * Entrar e criar conta, na mesma tela.
 *
 * Criar conta não existia, e isso deixava o cadastro de estabelecimento
 * inalcançável: o formulário de pedido ficava atrás de um login que exigia uma
 * conta que só nascia por fora do painel. Uma segunda rota resolveria, mas
 * quem chega aqui pela primeira vez não sabe qual das duas é a dele — o
 * alternador responde isso sem tirar ninguém do lugar.
 */
export function Login({
  aoEntrar,
  modoInicial = 'entrar',
  avisoInicial = null,
  aoVoltar,
}: {
  aoEntrar: () => void;
  /** Em que aba abrir: quem clicou "quero ser parceiro" já pediu a de criar. */
  modoInicial?: Modo;
  /**
   * Recado que veio do endereço, não do formulário.
   *
   * Hoje é um só: o link de redefinição que venceu. Sem ele a pessoa clica no
   * e-mail, cai no login e não descobre por quê — e tentaria de novo o mesmo
   * link, que continua vencido.
   */
  avisoInicial?: string | null;
  /** Volta para a vitrine. Ausente quando não há vitrine atrás. */
  aoVoltar?: () => void;
}) {
  const [modo, setModo] = useState<Modo>(modoInicial);
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(avisoInicial);
  const [enviando, setEnviando] = useState(false);
  const [confirmar, setConfirmar] = useState<string | null>(null);
  const [linkEnviado, setLinkEnviado] = useState<string | null>(null);

  const criando = modo === 'criar';
  const recuperando = modo === 'recuperar';

  const enviar = async (evento: React.FormEvent) => {
    evento.preventDefault();
    setEnviando(true);
    setErro(null);
    try {
      if (recuperando) {
        await api.pedirNovaSenha(email.trim());
        setLinkEnviado(email.trim());
        return;
      }
      if (criando) {
        const r = await api.criarConta(email.trim(), senha);
        if (r.status === 'confirmar') {
          setConfirmar(r.email);
          return;
        }
      } else {
        await api.entrar(email.trim(), senha);
      }
      aoEntrar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível continuar.');
    } finally {
      setEnviando(false);
    }
  };

  /*
    Confirmação pendente não é erro, e não pode parecer erro: o estabelecimento
    fez tudo certo e a conta existe. Trocar a tela inteira é mais honesto do
    que uma mensagem vermelha embaixo de um formulário que ele já enviou.
  */
  /*
    A mesma tela para e-mail com conta e sem conta.

    Dizer "não encontramos este e-mail" seria simpático e seria um vazamento:
    quem quisesse saber quais estabelecimentos são parceiros do Kidoo bastaria
    digitar uma lista aqui. A frase está no condicional porque ela precisa ser
    verdadeira nos dois casos.
  */
  if (linkEnviado) {
    return (
      <div className="login">
        <div className="login-card">
          <Marca style={{ padding: '0 0 20px' }} />
          <section className="card">
            <div className="card-pad">
              <h2 style={{ marginBottom: 6 }}>Confira seu e-mail</h2>
              <p className="muted">
                Se <strong>{linkEnviado}</strong> tiver conta no painel, o link para criar uma
                senha nova já está a caminho. Ele vale por uma hora e só serve uma vez.
              </p>
              <p className="faint" style={{ marginTop: 10 }}>
                Não achou? Procure na caixa de spam antes de pedir outro.
              </p>
              <button
                className="btn btn-ghost"
                style={{ marginTop: 18 }}
                onClick={() => {
                  setLinkEnviado(null);
                  setModo('entrar');
                  setSenha('');
                }}
              >
                Voltar para entrar
              </button>
            </div>
          </section>
        </div>
      </div>
    );
  }

  if (confirmar) {
    return (
      <div className="login">
        <div className="login-card">
          <Marca style={{ padding: '0 0 20px' }} />
          <section className="card">
            <div className="card-pad">
              <h2 style={{ marginBottom: 6 }}>Confirme seu e-mail</h2>
              <p className="muted">
                Mandamos um link para <strong>{confirmar}</strong>. Abra-o e volte aqui para
                entrar — aí você preenche o cadastro do seu espaço.
              </p>
              <button
                className="btn btn-ghost"
                style={{ marginTop: 18 }}
                onClick={() => {
                  setConfirmar(null);
                  setModo('entrar');
                  setSenha('');
                }}
              >
                Já confirmei, quero entrar
              </button>
            </div>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="login">
      <div className="login-card">
        <Marca style={{ padding: '0 0 20px' }} />

        {aoVoltar && (
          <button className="btn-link" style={{ marginBottom: 14 }} onClick={aoVoltar}>
            ‹ Voltar
          </button>
        )}

        <div className="alternador" role="group" aria-label="Entrar ou criar conta"
             style={{ display: 'flex', marginBottom: 14 }}>
          <button className="alternador-opcao" style={{ flex: 1 }}
                  aria-pressed={!criando} onClick={() => { setModo('entrar'); setErro(null); }}>
            Já tenho conta
          </button>
          <button className="alternador-opcao" style={{ flex: 1 }}
                  aria-pressed={criando} onClick={() => { setModo('criar'); setErro(null); }}>
            Cadastrar meu espaço
          </button>
        </div>

        <section className="card">
          <form className="card-pad" onSubmit={(e) => void enviar(e)}>
            <h2 style={{ marginBottom: 4 }}>
              {recuperando ? 'Recuperar acesso' : criando ? 'Criar conta' : 'Entrar'}
            </h2>
            <p className="faint" style={{ marginBottom: 18 }}>
              {recuperando
                ? 'Informe o e-mail da conta e mandamos um link para você escolher outra senha.'
                : criando
                  ? 'Primeiro a conta; depois você conta onde fica o espaço e o que oferece.'
                  : 'Use o e-mail cadastrado para o seu estabelecimento.'}
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
              {!recuperando && (
              <div className="field">
                <label htmlFor="senha">Senha</label>
                <input
                  id="senha"
                  className="input"
                  type="password"
                  autoComplete={criando ? 'new-password' : 'current-password'}
                  required
                  minLength={criando ? 8 : undefined}
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                />
                {criando && <span className="faint">Pelo menos 8 caracteres.</span>}
              </div>
              )}

              {erro && <Erro>{erro}</Erro>}

              <button className="btn" type="submit" disabled={enviando}>
                {enviando
                  ? recuperando ? 'Mandando…' : criando ? 'Criando…' : 'Entrando…'
                  : recuperando ? 'Mandar o link' : criando ? 'Criar conta' : 'Entrar'}
              </button>

              {/* Só na aba de entrar: quem está criando conta não tem senha
                  para esquecer, e quem já está aqui não precisa da volta. */}
              {!criando && (
                <button
                  type="button"
                  className="btn-link"
                  style={{ alignSelf: 'center' }}
                  onClick={() => {
                    setModo(recuperando ? 'entrar' : 'recuperar');
                    setErro(null);
                    setSenha('');
                  }}
                >
                  {recuperando ? 'Lembrei, quero entrar' : 'Esqueci minha senha'}
                </button>
              )}
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
