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

## O domínio

Quem entrega e-mail em escala precisa provar que o domínio é seu, via SPF e
DKIM. Sem isso, ou você só consegue mandar para si mesmo, ou cai no spam. Não dá
para contornar.

O do Kidoo é **`sejakidoo.com.br`**. `kidoo.com.br` já estava registrado — parado,
sem site, mas ocupado — e `kidoo.app` indisponível.

Registro e DNS ficam em lugares diferentes, e é a parte que confunde:

| | Onde | Por quê |
| --- | --- | --- |
| **Registro** | [registro.br](https://registro.br), login gov.br | É o único lugar que vende `.br`. O Cloudflare recusa a extensão — isso é esperado, não é erro. R$ 40/ano, sem preço promocional de primeiro ano |
| **DNS** | Cloudflare, plano gratuito | `Add a site` aceita qualquer TLD; a restrição é só na venda. Ele devolve dois nameservers, que você cola no registro.br em **Alterar servidores DNS** |

O DNS no Cloudflare não é preferência: é ele que faz os registros do Resend
propagarem em segundos em vez de horas, e é onde os subdomínios do painel vão
morar depois.

> Semanas depois de registrar costuma chegar boleto de "renovação de domínio" de
> empresa com nome parecido. O WHOIS do `.br` é público e alimenta essa fraude
> desde sempre. **Cobrança de domínio só existe dentro do painel do
> registro.br**, com login gov.br. Boleto por e-mail, ignore.

### Sem domínio, só para testar

O Resend entrega para o endereço da própria conta mesmo antes de qualquer
domínio verificar. Dá para percorrer o fluxo inteiro sozinho — cadastrar,
receber, clicar, entrar. Não dá para convidar ninguém.

## Resend

1. Conta em [resend.com](https://resend.com). A camada gratuita cobre muito mais
   do que esta fase.
2. **Domains → Add Domain** → `sejakidoo.com.br`.
3. Ele devolve três ou quatro registros (TXT, CNAME, MX). Cole no Cloudflare, em
   **DNS → Records** — mas leia os dois erros abaixo antes de colar.
4. **API Keys → Create API Key**.

> A API key é segredo: ela manda e-mail em nome do seu domínio. Não vai para
> arquivo nenhum deste repositório, e não precisa ser compartilhada com ninguém.

### Os dois erros que custam a tarde

**O Cloudflare completa o nome sozinho.** O Resend mostra o registro como
`send.sejakidoo.com.br`. Colar isso inteiro no campo *Name* produz
`send.sejakidoo.com.br.sejakidoo.com.br`, que nunca verifica e não acusa nada.
Cole só **`send`**.

**A nuvem laranja tem que ficar cinza.** Todo CNAME do Resend precisa estar em
**DNS only** (Proxy status desligado). Com o proxy ligado, o Cloudflare responde
no lugar do registro e a validação do Resend não enxerga o valor real.

Juntos, são a causa de quase todo "não verifica e eu não sei por quê".

## Ligar no Supabase

**Project Settings → Authentication → SMTP Settings** → ligue **Enable Custom
SMTP** e preencha:

| Campo | Valor |
| --- | --- |
| Sender email | `nao-responda@sejakidoo.com.br` |
| Sender name | `Kidoo` |
| Host | `smtp.resend.com` |
| Port | `587` |
| Username | `resend` |
| Password | a API key do Resend |

Salve. Logo abaixo há o **Rate limit** de e-mails por hora — com SMTP próprio dá
para subir; comece em algo como 30 e suba quando precisar.

## Pôr o modelo do Kidoo

Agora que os modelos destravaram:

**Authentication → Emails → Confirm sign up**

- **Subject**: `Confirme seu e-mail no Kidoo`
- **Body**: aba **Source**, cole o conteúdo de
  [`email-confirmacao.html`](email-confirmacao.html) inteiro.

Ele usa `{{ .ConfirmationURL }}` e `{{ .Email }}`, que o Supabase substitui.

## Conferir

Cadastre-se com um endereço que você ainda não usou:

1. O e-mail chega em segundos, com remetente `@sejakidoo.com.br`.
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
| O domínio não verifica no Resend | os dois erros do Cloudflare acima: nome duplicado, ou proxy ligado |
| Nada chega, nem no spam | a chave está errada, ou o domínio ainda não terminou de verificar |
| Chega, mas cai no spam | DKIM ainda não propagou, ou você está no caminho sem domínio |
| "Email rate limit exceeded" | o Rate limit do Supabase ainda está no valor antigo |
| Chega para você e para mais ninguém | Resend sem domínio verificado: só entrega para a conta |
| O link chega e não abre o app | não é SMTP: veja as Redirect URLs no README |
