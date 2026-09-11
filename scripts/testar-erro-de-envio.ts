/**
 * O que a tela de "esqueci minha senha" pode dizer, e o que tem de calar.
 *
 * Este arquivo existe por causa de um defeito meu. Para a tela não virar um
 * verificador de quais e-mails têm conta no Kidoo, eu engoli TODO erro do
 * `resetPasswordForEmail`. Junto foram os erros que não dependem do e-mail
 * nenhum — destino fora das Redirect URLs, SMTP fora do ar — e nesses casos a
 * tela dizia "confira seu e-mail", nada chegava, e o motivo só existia em
 * Authentication → Logs.
 *
 * As duas metades precisam de teste porque falham em direções opostas e as
 * duas falham em silêncio: engolir demais esconde a configuração quebrada;
 * mostrar demais entrega quais famílias são clientes. Nenhuma das duas aparece
 * olhando a tela.
 *
 * `npm run test:erro-de-envio`
 */
import { erroDeEnvio } from '@shared/erro-de-envio';

const falhas: string[] = [];
const ok = (cond: boolean, msg: string) => {
  console.log((cond ? '  OK    ' : '  FALHA ') + msg);
  if (!cond) falhas.push(msg);
};

// ------------------------------------------------- o que PODE ser mostrado --
// Todos idênticos para qualquer endereço do mundo: mostrá-los não conta nada
// sobre o e-mail digitado.

const REDIRECT = 'Invalid request: redirect_to is not allowed';
ok(erroDeEnvio(REDIRECT) !== null, 'destino não permitido é mostrado');
ok(
  erroDeEnvio(REDIRECT)?.includes('Redirect URLs') === true,
  'e aponta as Redirect URLs pelo nome',
);
ok(
  erroDeEnvio(REDIRECT)?.includes(REDIRECT) === true,
  'a frase crua do servidor vai junto — é ela que vira diagnóstico numa captura de tela',
);
ok(
  erroDeEnvio(REDIRECT)?.startsWith('O problema é nosso') === true,
  'e começa dizendo de quem é o problema: quem lê é uma família, não o operador',
);

ok(erroDeEnvio('Error sending recovery email') !== null, 'falha de envio é mostrada');
ok(erroDeEnvio('Error sending confirmation email') !== null, 'a do outro fluxo também');
ok(erroDeEnvio('smtp: connection refused') !== null, 'SMTP fora do ar é mostrado');
ok(
  erroDeEnvio('email rate limit exceeded') !== null,
  'o limite por hora do projeto é mostrado — é um teto único, igual para todos',
);

// --------------------------------------------------- o que tem de ficar calado --

ok(
  erroDeEnvio('User not found') === null,
  'e-mail sem conta NÃO é revelado — é o vazamento que motivou engolir tudo',
);
ok(
  erroDeEnvio('For security purposes, you can only request this after 54 seconds') === null,
  'o intervalo POR ENDEREÇO fica calado: ele só existe depois de um envio àquele ' +
    'e-mail, então responder coisas diferentes a dois endereços separa os dois',
);

/*
  O caso que decide o desenho do arquivo: lista de permitidos, não de proibidos.

  Um erro que eu não reconheço pode depender do e-mail digitado. Com lista de
  proibidos ele passaria — e o vazamento entraria pela porta de um erro que o
  GoTrue ainda nem tinha quando escrevi isto.
*/
ok(
  erroDeEnvio('Database error finding user by email') === null,
  'erro desconhecido fica calado por padrão, mesmo parecendo técnico',
);
ok(erroDeEnvio('') === null, 'mensagem vazia não inventa frase');
ok(
  erroDeEnvio('Signups not allowed for this instance') === null,
  'erro de outro fluxo não é adotado só por ser de configuração',
);

/*
  `not allowed` sozinho não pode casar.

  A frase aparece em vários erros do GoTrue. Casar por ela mandaria procurar
  defeito nas Redirect URLs por causa de outra coisa inteiramente — que é o
  mesmo engano que o painel já tinha cometido e corrigido em `mensagens-de-auth`.
*/
ok(
  erroDeEnvio('Email logins are not allowed') === null,
  '"not allowed" solto não vira erro de Redirect URL',
);

console.log(falhas.length === 0 ? '\ntudo certo' : `\n${falhas.length} falha(s)`);
process.exit(falhas.length === 0 ? 0 : 1);
