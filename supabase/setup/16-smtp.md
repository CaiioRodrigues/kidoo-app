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
3. Ele devolve **três** registros. Numa conta da região São Paulo (`sa-east-1`)
   eles saem assim — confira contra a tela, porque o alvo muda com a região:

   | Type | Name | Content |
   | --- | --- | --- |
   | `TXT` | `resend._domainkey` | `p=MIGfMA0GCSqG…` (a chave DKIM inteira) |
   | `CNAME` | `rsend` | `rsend-sae1.forge.rmta.net` |
   | `CNAME` | `send` | `send.forge.rmta.net` |

4. **API Keys → Create API Key**.

> A API key é segredo: ela manda e-mail em nome do seu domínio. Não vai para
> arquivo nenhum deste repositório, e não precisa ser compartilhada com ninguém.

### Os erros que custam a tarde

**`rsend` não é erro de digitação.** Um registro é `rsend` e o outro é `send`.
Lidos rápido parecem o mesmo nome duas vezes.

**O Cloudflare completa o nome sozinho.** Em `Name`, vai só `send`, `rsend` e
`resend._domainkey`. Colar `send.sejakidoo.com.br` produz
`send.sejakidoo.com.br.sejakidoo.com.br`, que nunca verifica e não acusa nada.

**A nuvem laranja tem que ficar cinza.** O Cloudflare liga o proxy por padrão em
todo CNAME. Com ele ligado, quem consulta recebe os IPs do Cloudflare em vez do
alvo, e o Resend conclui que o registro não existe. Os dois CNAME precisam ficar
em **DNS only**.

**A chave DKIM aparece encurtada.** O Resend mostra `p=MIGfMA0GCSqG […]
OoaLFJwIDAQAB` — aquele `[…]` é conteúdo faltando, não estilo. Use o botão de
copiar ao lado do valor, nunca a seleção do que está na tela. O sintoma de ter
copiado errado é traiçoeiro: os CNAME resolvem, o DKIM parece estar lá, e a
verificação nunca fecha.

### Se demorar mesmo com tudo certo

Confira cada um por fora, em `dnschecker.org`:

- `CNAME send.SEUDOMINIO` → o alvo `.forge.rmta.net`
- `CNAME rsend.SEUDOMINIO` → idem
- `TXT resend._domainkey.SEUDOMINIO` → a chave, **terminando** onde a do Resend termina

Se os três batem, não há mais nada a fazer no DNS. O Resend consultou antes de
os registros existirem, e resolvedores guardam resposta negativa por um tempo —
no `.br` esse tempo é longo. Fecha sozinho, em geral em algumas horas.

### O domínio do registro.br já vem blindado contra envio

Domínio `.br` novo nasce com dois registros que dizem "aqui ninguém manda
e-mail": `v=spf1 -all` na raiz e `_dmarc` com `p=reject`. É boa prática para
domínio parado, e vira armadilha quando ele passa a enviar.

`p=reject` manda o destinatário **descartar** o que não passar na verificação:
não vai para o spam, some sem erro em lugar nenhum. Enquanto você configura,
troque para `p=none` e aperte de volta depois que estiver entregando. A falha
silenciosa é a mais cara de investigar — foi ela que escondeu o push por dias.

## Ligar no Supabase

**Project Settings → Authentication → SMTP Settings** → ligue **Enable Custom
SMTP** e preencha:

| Campo | Valor |
| --- | --- |
| Sender email | `nao-responda@sejakidoo.com.br` — mas veja a ponte abaixo |
| Sender name | `Kidoo` |
| Host | `smtp.resend.com` |
| Port | `587` |
| Username | **`resend`** — a palavra, não o seu e-mail nem o nome da empresa |
| Password | a API key do Resend |

O **Username** é o campo que mais engana: parece que devia ser o endereço de
quem envia, e é o mesmo literal `resend` para toda conta. Com outra coisa ali, a
autenticação falha antes de qualquer envio — e a tentativa **não aparece nos
logs do Resend**, porque a conexão nunca chegou a ser aceita. Log vazio, nesse
caso, é o diagnóstico: o problema é o Username.

### A ponte enquanto o domínio não verifica

`onboarding@resend.dev` é um remetente do próprio Resend e funciona sem domínio
verificado. Ele entrega **só para o endereço da sua conta**, o que basta para
percorrer o cadastro inteiro sozinho e não serve para convidar ninguém.

Vale usá-lo desde já: a verificação do domínio leva horas, e sem SMTP que
funcione o cadastro não anda — o Supabase trata o envio do e-mail como parte da
criação da conta, então um envio recusado **derruba o cadastro inteiro**, com
`{"code":"unexpected_failure","message":"Error sending confirmation email"}`.
Quando o domínio verificar, troque só este campo.

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
| O domínio não verifica no Resend | proxy ligado, nome duplicado, ou a chave DKIM copiada encurtada — veja "Se demorar mesmo com tudo certo" |
| "Error sending confirmation email" ao criar conta | o SMTP recusou. Username diferente de `resend`, ou remetente num domínio ainda não verificado |
| Nada chega, nem no spam | a chave está errada, ou o domínio ainda não terminou de verificar |
| Chega, mas cai no spam | DKIM ainda não propagou, ou você está no caminho sem domínio |
| "Email rate limit exceeded" | o Rate limit do Supabase ainda está no valor antigo |
| Chega para você e para mais ninguém | Resend sem domínio verificado: só entrega para a conta |
| O link chega e não abre o app | não é SMTP: veja as Redirect URLs no README |
