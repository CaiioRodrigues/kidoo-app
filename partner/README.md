# Painel do parceiro

App web para o estabelecimento: ver quem vem hoje, confirmar presença, abrir e
fechar vagas, e acompanhar o repasse.

```bash
cd partner
npm install
npm run dev      # http://localhost:5273
```

Sem `.env`, o painel abre em **modo demonstração**: dados fictícios em memória,
com as mesmas regras do banco (código de check-in conferido, vaga não fecha
abaixo do que já foi reservado, classificação da vaga derivada). Entre com
qualquer e-mail e uma senha de 4 letras. Com `VITE_SUPABASE_URL` e
`VITE_SUPABASE_ANON_KEY` definidos, fala com o Supabase de verdade.

## Por que é um app separado do Expo

Mesmo repositório, projeto próprio. O app das famílias é React Native rodando
no celular; o painel é uma ferramenta de balcão, usada num navegador, com
tabela e formulário. Empurrá-lo para dentro do Expo custaria o React Native Web
inteiro no bundle e ainda daria um layout de telefone numa tela de recepção.

O que os dois compartilham é o que importa: os tipos de domínio, via o alias
`@app/*`. `SlotKind`, `ClassSession` e a curva de níveis são os mesmos objetos —
se fossem copiados, uma mudança no app só apareceria aqui quando quebrasse.

## O que o painel não pode fazer

Estas não são omissões, são decisões, e todas valem no banco (não só na tela):

- **Não escolhe o tipo da vaga.** `ociosa` ou `cheia` é derivado da lotação da
  turma por um gatilho no Postgres. Com o campo livre, bastava marcar tudo como
  `cheia` para dobrar o próprio repasse sem mudar nada no mundo real.
- **Não lista crianças.** `children` é privado por RLS. O painel chama
  `session_roster`, que devolve **primeiro nome e idade** de quem reservou com
  ele — o suficiente para receber a criança na porta, e nada além disso.
- **Não marca presença sozinho.** Só `confirm_by_partner`, com o código que a
  família mostra, e o código expira. "O aluno veio" não pode ser
  autodeclaração de quem recebe por isso.
- **Não fecha vaga já reservada.** Reduzir abaixo de `slots_taken` deixaria
  família com reserva e sem lugar.

## Sessão

Fica em `sessionStorage`, não em `localStorage`. O computador da recepção
costuma ser compartilhado e ficar ligado: em `localStorage` a sessão sobrevive
a fechar o navegador, e o próximo turno abriria o painel já logado como quem
saiu. Em `sessionStorage` ela sobrevive ao F5 — que é o que dói no dia a dia —
e morre com a aba.

## Comandos

```bash
npm run dev       # desenvolvimento
npm run build     # typecheck + build de produção em dist/
npm run preview   # serve o build
```
