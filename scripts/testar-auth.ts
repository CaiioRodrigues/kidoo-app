/**
 * As mensagens de erro de autenticação do painel.
 *
 * Roda com `npm run test:auth`. Existe por causa de um defeito real: `signUp`
 * falhava porque o remetente do SMTP não estava verificado, o painel dizia
 * apenas "Não foi possível criar a conta", e a frase do servidor — que apontava
 * a causa — era descartada. Uma tela que não deixa ninguém consertar nada.
 */
import { mensagemDeAuth } from '../partner/src/mensagens-de-auth';

const falhas: string[] = [];
const ok = (cond: boolean, msg: string) => {
  console.log((cond ? '  OK    ' : '  FALHA ') + msg);
  if (!cond) falhas.push(msg);
};

const PADRAO = 'Não foi possível criar a conta.';

// As frases abaixo são as que o GoTrue devolve de verdade nestes casos.
ok(
  mensagemDeAuth('User already registered', PADRAO).includes('já tem conta'),
  'e-mail repetido vira convite para entrar',
);
ok(
  /SMTP/i.test(mensagemDeAuth('Error sending confirmation email', PADRAO)),
  'falha de envio aponta para o SMTP do projeto',
);
ok(
  /Redirect URLs/.test(mensagemDeAuth('Invalid request: redirect_to is not allowed', PADRAO)),
  'destino não permitido aponta para as Redirect URLs',
);
ok(
  /limite de e-mails/.test(mensagemDeAuth('email rate limit exceeded', PADRAO)),
  'limite estourado é dito como limite, não como erro genérico',
);
ok(
  /Providers/.test(mensagemDeAuth('Signups not allowed for this instance', PADRAO)),
  'cadastro desligado diz onde religar',
);

// O caso que motivou tudo: o desconhecido não pode sumir.
const desconhecido = mensagemDeAuth('Database error saving new user', PADRAO);
ok(desconhecido.includes(PADRAO), 'o desconhecido mantém a frase de balcão');
ok(
  desconhecido.includes('Database error saving new user'),
  'e carrega a mensagem crua junto — sem ela não há o que investigar',
);

// Uma tradução não pode capturar o que não é dela. "not allowed" aparece em
// várias frases do GoTrue, e casar cedo demais mandaria o operador mexer nas
// Redirect URLs por causa de um problema de senha.
ok(
  /senha/i.test(mensagemDeAuth('Password should be at least 6 characters', PADRAO)),
  'erro de senha não é confundido com destino não permitido',
);

console.log(falhas.length ? `\n${falhas.length} FALHA(S)` : '\ntudo certo');
process.exit(falhas.length ? 1 : 0);
