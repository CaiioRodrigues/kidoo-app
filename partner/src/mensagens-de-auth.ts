/**
 * O que dizer quando o Supabase Auth recusa.
 *
 * Fica separado do adaptador porque é a única parte disto que dá para testar
 * sem uma conta de verdade — e porque o defeito que motivou o arquivo foi
 * justamente uma tradução: `signUp` falhava, o painel dizia "Não foi possível
 * criar a conta" e engolia a frase do servidor.
 *
 * Os erros do banco chegam como código curto (`not_admin`) e têm tabela
 * própria. Os do GoTrue chegam como frase em inglês, e essa frase costuma ser
 * a **única** pista: a causa quase nunca está na tela, está na configuração do
 * projeto — remetente de SMTP não verificado, endereço fora das Redirect URLs,
 * limite de e-mails estourado.
 */

const CONHECIDOS: { casa: RegExp; diz: string }[] = [
  {
    casa: /already registered|already been registered|user already/i,
    diz: 'Este e-mail já tem conta. Entre com ele.',
  },
  {
    casa: /confirmation email|sending email|smtp/i,
    diz:
      'A conta não foi criada porque o e-mail de confirmação não pôde ser enviado. ' +
      'Confira o SMTP do projeto — remetente de domínio ainda não verificado é a causa mais comum.',
  },
  {
    // Sem `not allowed` solto: a frase aparece em vários erros do GoTrue, e
    // casar por ela mandava o operador mexer nas Redirect URLs por causa de um
    // cadastro desligado. `redirect_to` é o que identifica este caso.
    casa: /redirect_to|redirect url/i,
    diz:
      'O endereço deste painel não está nas Redirect URLs do Supabase. ' +
      'Acrescente-o em Authentication → URL Configuration.',
  },
  {
    casa: /rate limit/i,
    diz: 'Muitas tentativas seguidas: o limite de e-mails por hora do projeto foi atingido.',
  },
  {
    casa: /signups? not allowed|signup is disabled/i,
    diz: 'A criação de contas está desligada no projeto, em Authentication → Providers.',
  },
  { casa: /password/i, diz: 'A senha não atende ao mínimo exigido pelo projeto.' },
];

/**
 * A frase para a tela.
 *
 * Sem correspondência, a mensagem crua vai junto entre parênteses. É feia e é
 * em inglês, mas quem vê esta tela é o operador do painel, e o custo de
 * esconder já foi cobrado: horas atrás de uma causa que o servidor tinha dito
 * na primeira tentativa.
 */
export function mensagemDeAuth(mensagem: string, padrao: string): string {
  const conhecido = CONHECIDOS.find((c) => c.casa.test(mensagem));
  return conhecido ? conhecido.diz : `${padrao} (${mensagem})`;
}
