# E-mail que chega: SMTP próprio

Com a confirmação de e-mail ligada, **o cadastro depende do e-mail chegar**. Hoje
ele sai pelo serviço compartilhado do Supabase, que serve para você testar e não
serve para famílias de verdade, por três motivos:

- limite de poucos envios por hora, e o erro não aparece para quem se cadastrou;
- o remetente é do domínio do Supabase, o que joga a mensagem no spam com
  frequência;
- os modelos de e-mail ficam travados — o do Kidoo, em
  [`email-confirmacao.html`](email-confirmacao.html), nem entra.

O sintoma disso em campo é sempre o mesmo: *"me cadastrei e não recebi nada"*.
E é pior do que não pedir confirmação, porque a pessoa fez tudo certo e ficou
parada.

## Antes de tudo: você tem um domínio?

É a pergunta que decide o caminho, e não dá para contornar — quem entrega
e-mail em escala precisa provar que o domínio é seu (SPF e DKIM). Sem isso, ou
você só consegue mandar para si mesmo, ou cai no spam.

### Com domínio (é o certo, e resolve de vez)

Um `.com.br` custa na casa de R$ 40 por ano, e você vai precisar dele de
qualquer forma — para o site, para o painel e para o e-mail não parecer golpe.

1. Crie a conta no [Resend](https://resend.com) (camada gratuita cobre muito
   mais do que esta fase).
2. **Domains → Add Domain** → digite o seu.
3. Ele mostra três ou quatro registros DNS (TXT e CNAME). Copie para o painel de
   onde você comprou o domínio. A verificação leva de minutos a algumas horas.
4. **API Keys → Create API Key**. Guarde: é ela que vai no campo de senha do
   SMTP, e ela **não entra neste repositório**.

### Sem domínio ainda (dá para testar hoje)

O Resend só entrega para o e-mail da sua própria conta enquanto não houver
domínio verificado — o que basta para você testar o fluxo inteiro sozinho, mas
não para convidar ninguém.

Para convidar alguém antes de ter domínio, o SendGrid tem **Single Sender
Verification**: você verifica um endereço individual (um Gmail seu, por exemplo)
e passa a enviar por ele. Funciona, e a entrega é pior — sem DKIM no seu
domínio, boa parte vai para promoções ou spam. Serve como ponte, não como
destino.

## Ligar no Supabase

**Project Settings → Authentication → SMTP Settings** → ligue **Enable Custom
SMTP** e preencha:

| Campo | Resend | SendGrid |
| --- | --- | --- |
| Sender email | `nao-responda@SEUDOMINIO` | o endereço verificado |
| Sender name | `Kidoo` | `Kidoo` |
| Host | `smtp.resend.com` | `smtp.sendgrid.net` |
| Port | `587` | `587` |
| Username | `resend` | `apikey` |
| Password | a API key | a API key |

Salve. Logo abaixo há o **Rate limit** de e-mails por hora — com SMTP próprio dá
para subir; comece em algo como 30 e suba quando precisar.

> A API key é segredo: ela manda e-mail em nome do seu domínio. Não vai para
> arquivo nenhum deste repositório, e não precisa ser compartilhada com ninguém.

## Pôr o modelo do Kidoo

Agora que os modelos destravaram:

**Authentication → Emails → Confirm sign up**

- **Subject**: `Confirme seu e-mail no Kidoo`
- **Body**: aba **Source**, cole o conteúdo de
  [`email-confirmacao.html`](email-confirmacao.html) inteiro.

Ele usa `{{ .ConfirmationURL }}` e `{{ .Email }}`, que o Supabase substitui.

## Conferir

Cadastre-se com um endereço que você ainda não usou:

1. O e-mail chega em segundos, com o remetente do seu domínio.
2. O link abre o painel (se o cadastro foi lá) ou o app (se foi no celular).
3. Você entra sem digitar a senha de novo.

E veja quem ficou pelo caminho:

```sql
select email, created_at, email_confirmed_at
  from auth.users
 where email_confirmed_at is null
 order by created_at desc;
```

Linha antiga aqui é gente que se cadastrou e nunca confirmou — antes do SMTP,
quase sempre porque o e-mail não chegou.

## Se não chegar

| Sintoma | Onde olhar |
| --- | --- |
| Nada chega, nem no spam | a chave está errada, ou o domínio ainda não verificou no Resend |
| Chega, mas cai no spam | falta DKIM/SPF, ou você está no caminho sem domínio |
| "Email rate limit exceeded" | o Rate limit do Supabase ainda está no valor antigo |
| Chega para você e para mais ninguém | é o Resend sem domínio verificado: só entrega para a conta |
| O link chega e não abre o app | não é SMTP: veja as Redirect URLs no README |
