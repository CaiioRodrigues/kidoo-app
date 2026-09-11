/**
 * Quais erros de "manda o e-mail" dá para mostrar sem entregar quem tem conta.
 *
 * O problema que este arquivo resolve. A tela de "esqueci minha senha" não pode
 * dizer se o e-mail digitado tem conta — senão ela vira um verificador: digita-se
 * uma lista de endereços e descobre-se quais famílias são clientes do Kidoo.
 * A saída fácil para isso é engolir todo erro do servidor, e foi o que eu fiz
 * primeiro. Só que aí ela engole junto os erros que **não** dependem do e-mail
 * nenhum: destino fora das Redirect URLs, SMTP fora do ar. Nesses casos a tela
 * diz "confira seu e-mail", nada chega, e o motivo só existe em
 * Authentication → Logs.
 *
 * É o mesmo defeito que escondeu o `Error sending confirmation email` e custou
 * uma tarde de DNS. Engolir por segurança e engolir por descuido produzem a
 * mesma tela.
 *
 * A separação é por **lista de permitidos**, não de proibidos, e isso é o ponto
 * inteiro do arquivo. Erro que eu não reconheço pode depender do e-mail
 * digitado, então ele continua calado. Só passa o que eu sei ser idêntico para
 * qualquer endereço do mundo.
 *
 * Vive em `src/lib` e não no adaptador porque o painel usa o mesmo, por
 * `@app/lib/erro-de-envio` — a regra é a mesma nos dois lados, e duas cópias
 * dela é como um lado ganharia um caso que o outro não tem.
 */

type Caso = { casa: RegExp; diz: string };

/**
 * Erros que valem para todo e-mail igualmente — logo, mostrá-los não conta nada
 * sobre o endereço digitado.
 *
 * Cada frase começa dizendo de quem é o problema. Quem lê esta tela é uma
 * família, que não vai mexer em Redirect URL nenhuma; o que ela precisa saber é
 * que não adianta tentar de novo com outro e-mail. O detalhe técnico vem em
 * seguida porque é ele que aparece na captura de tela que chega até quem
 * conserta — foi assim que o erro do SMTP foi finalmente diagnosticado.
 */
const DE_CONFIGURACAO: Caso[] = [
  {
    // Sem `not allowed` solto: a frase aparece em vários erros do GoTrue, e
    // casar por ela mandaria procurar defeito nas Redirect URLs por causa de
    // outra coisa. `redirect_to` é o que identifica este caso.
    casa: /redirect_to|redirect url/i,
    diz:
      'O problema é nosso, não seu: o endereço de retorno deste link não está ' +
      'liberado no servidor (Redirect URLs).',
  },
  {
    casa: /sending (recovery|confirmation|magic link|email)|smtp/i,
    diz:
      'O problema é nosso, não seu: o servidor de e-mail do Kidoo recusou o envio. ' +
      'Nenhuma mensagem foi mandada.',
  },
  {
    /*
      O limite por hora do PROJETO — um teto único, igual para todo mundo.

      Não confundir com o intervalo por endereço ("you can only request this
      after 60 seconds"), que fica de fora de propósito: ele só existe depois de
      um envio ter acontecido para aquele endereço, então responder "espere um
      minuto" a um e-mail e "pronto" a outro separa os dois — que é exatamente o
      que esta tela não pode fazer.
    */
    casa: /email rate limit exceeded|rate limit.*email/i,
    diz:
      'O problema é nosso, não seu: o limite de e-mails por hora do Kidoo foi ' +
      'atingido. Tente daqui a pouco.',
  },
];

/**
 * Fora estes, tudo se cala. Explicitados para o leitor não achar que foram
 * esquecidos: eles dependem do endereço digitado, ou podem depender.
 */
const SILENCIOSOS = /user not found|for security purposes|only request this (after|once)/i;

/**
 * A frase para a tela, ou `null` quando o erro tem de ficar calado.
 *
 * `null` é o padrão: só sai frase para o que está em `DE_CONFIGURACAO`.
 */
export function erroDeEnvio(mensagem: string): string | null {
  if (SILENCIOSOS.test(mensagem)) return null;

  const caso = DE_CONFIGURACAO.find((c) => c.casa.test(mensagem));
  if (!caso) return null;

  // A mensagem crua vai junto, entre parênteses. É feia e é em inglês, e é ela
  // que transforma uma captura de tela em diagnóstico.
  return `${caso.diz} (${mensagem})`;
}
