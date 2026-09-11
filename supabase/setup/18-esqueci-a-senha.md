# Esqueci minha senha

Duas configurações no Supabase. Sem elas o app e o painel mostram as telas
certas e o e-mail nunca chega — ou chega com um link que o Supabase recusa.

Depende do SMTP já estar funcionando ([`16-smtp.md`](16-smtp.md)). O link de
redefinição sai pelo mesmo remetente do link de confirmação.

---

## 1. Redirect URLs

**Authentication → URL Configuration → Redirect URLs.**

O Supabase só emite links para endereços cadastrados aqui. Um endereço que não
está na lista devolve `Invalid request: redirect_to is not allowed`, e o pedido
falha antes de virar e-mail.

O painel **não precisa de nada novo**: o link volta para a mesma origem que o
de confirmação já usa (`https://sejakidoo.com.br`), e é o `type=recovery` no
fim da URL que decide qual tela abrir.

O app precisa de uma entrada nova:

```
kidoo://nova-senha
```

E, enquanto você ainda testa pelo Expo Go, também o endereço que o Expo gera —
ele aparece no terminal ao rodar `npx expo start`, no formato
`exp://192.168.x.x:8081/--/nova-senha`. Esse muda de IP, então é entrada de
teste, não de produção.

> **O erro que custa tempo aqui.** O link de confirmação aponta para
> `kidoo://confirmado` e o de redefinição para `kidoo://nova-senha`. São rotas
> diferentes de propósito: confirmar termina na Home, redefinir tem de parar e
> pedir a senha nova. Cadastrar só uma das duas faz metade do fluxo funcionar,
> e a metade quebrada falha em silêncio — o e-mail simplesmente não sai.

## 2. O e-mail de redefinição

**Authentication → Emails → Reset Password.**

O modelo padrão do Supabase é em inglês e assinado como "Supabase Auth". Vale
trocar pelo mesmo tom do
[`email-confirmacao.html`](email-confirmacao.html), com o assunto
`Criar uma senha nova no Kidoo`.

O corpo precisa conter `{{ .ConfirmationURL }}` — é ele que vira o link.

Como o de confirmação, **só é editável com SMTP próprio**. Com o serviço padrão
do Supabase os campos aparecem travados.

### Validade do link

**Authentication → Sign In / Providers → Email → Email OTP Expiration.**

O padrão é uma hora, e as duas telas dizem isso em voz alta ("vale por uma
hora"). Se você mudar aqui, mude a frase também — um prazo escrito na tela que
não bate com o do servidor é pior que nenhum prazo, porque a pessoa confia nele.

---

## Como conferir que funcionou

Com o SMTP no ar, ponta a ponta:

1. **No painel** — `sejakidoo.com.br`, Entrar, **Esqueci minha senha**. Digite
   um e-mail que tenha conta e mande. A tela responde "Confira seu e-mail".
2. O e-mail chega. Abra o link: o painel tem de parar em **"Escolha a senha
   nova"**, e não entrar direto.
3. Salve a senha nova e entre com ela.
4. **No app** — mesma coisa, a partir de "Esqueci minha senha" no login.

A resposta é a mesma para e-mail com conta e sem conta, de propósito: dizer
"não encontramos este e-mail" transformaria a tela num verificador de quem é
cliente do Kidoo. Então o teste do passo 1 não prova nada sozinho — o que
prova é o e-mail chegar.

### Se o e-mail não chegar

Não é esta tela que está quebrada; é o SMTP ou a lista de Redirect URLs.

- **Authentication → Logs** mostra o pedido e o motivo da recusa.
- `redirect_to is not allowed` → falta a entrada do passo 1.
- `Error sending confirmation email` → é o SMTP; volte para
  [`16-smtp.md`](16-smtp.md).
- Nada nos logs → o pedido nem chegou. Confira `VITE_SUPABASE_URL` no painel e
  `EXPO_PUBLIC_SUPABASE_URL` no app.

Há um limite de envios por hora no Supabase. Ele é engolido de propósito pelo
app e pelo painel — propagá-lo revelaria a diferença entre "e-mail não existe"
e "limite atingido", e essa diferença é a que entrega quais e-mails têm conta.
O preço é que um limite estourado passa calado: se o e-mail não chega e os logs
não acusam nada, confira o limite antes de procurar defeito no código.
