# Primeira subida

Sete passos. Dá para fazer tudo no plano gratuito.

## 1. Criar o projeto

No painel do Supabase, **New project**:

- **Region: South America (São Paulo)**. É o que decide quanto tempo cada
  toque no app leva para responder. Um banco na Virgínia adiciona uns 120 ms a
  cada leitura, e isso aparece como lentidão em toda a interface.
- **Database password**: guarde num gerenciador de senhas agora. Ela não é
  mostrada de novo, e recuperá-la depois dá trabalho.

Leva uns dois minutos para ficar pronto.

## 2. Confirmação de e-mail

**Authentication → Sign In / Providers → Email → Confirm email.**

O app suporta os dois modos, então a escolha é sua:

**Ligada (recomendado a partir de agora).** O cadastro leva para a tela
"Confirme seu e-mail", com o motivo explicado, botão de reenviar e saída para
o login. É como tem de ficar antes de qualquer família real: sem confirmação,
qualquer pessoa cria conta com o e-mail de outra e passa a receber o que for
mandado para aquele endereço — e aqui a conta guarda dados de criança.

**Desligada.** O cadastro entra direto e cai no cadastro da criança. Útil
enquanto você está testando sozinho e não quer abrir o e-mail a cada conta
nova.

### O e-mail de confirmação

[`email-confirmacao.html`](email-confirmacao.html) é o modelo do Kidoo, pronto
para colar em **Authentication → Emails → Confirm sign up**, na aba **Source**.
Assunto sugerido: `Confirme seu e-mail no Kidoo`.

**Ele só é editável com SMTP próprio.** Com o serviço de e-mail padrão do
Supabase os campos aparecem mas ficam travados — é o aviso que a própria tela
mostra no topo.

E o serviço padrão não serve para produção de qualquer forma, por três motivos
que aparecem em ordem: ele é limitado a poucos e-mails por hora, o remetente é
do domínio do Supabase (o que joga a mensagem no spam com frequência), e não
há como você provar que o domínio é seu.

O passo a passo de ligar SMTP próprio está em [`16-smtp.md`](16-smtp.md) —
inclusive o caminho para quem ainda não tem domínio, que é o que decide tudo
por lá.

Enquanto você testa sozinho, o template padrão do Supabase entrega o link e
funciona — é feio, não é quebrado.

**Sobre para onde o link volta:** cada cadastro declara o seu destino (a família
para o app, o estabelecimento para o painel), então o **Site URL** só vale para
quem chegar sem destino declarado. O que precisa estar certo são as **Redirect
URLs** — a seção "O link do e-mail de confirmação", mais abaixo, tem as três.

## 3. Criar o banco

**SQL Editor → New query**, cole o conteúdo de [`01-banco.sql`](01-banco.sql)
inteiro e clique em **Run**.

São as seis migrations em ordem, dentro de uma transação: ou passa tudo, ou não
passa nada. Se der erro, nada foi criado — me mande a mensagem.

Ao terminar você deve ter 13 tabelas, as 9 modalidades e os 3 planos.

## 4. Criar a conta do parceiro

**Authentication → Users → Add user → Create new user.**

Marque **Auto Confirm User**. Sem isso a pessoa não consegue entrar no painel.

## 5. Cadastrar o parceiro

Abra [`02-primeiro-parceiro.sql`](02-primeiro-parceiro.sql), edite só o bloco
entre `EDITE DAQUI` e `ATÉ AQUI`, e rode no SQL Editor.

O que mais importa ali é a **coordenada**: é dela que sai a distância mostrada
no app e a checagem de proximidade do check-in. Pegue no Google Maps clicando
com o botão direito sobre o endereço.

### Conferindo

Depois do `01-banco.sql`, cole [`04-conferir.sql`](04-conferir.sql) numa query
nova. Os números têm de ser: 13 tabelas, 3 visões, 9 modalidades, 3 planos e
**zero** tabelas sem RLS.

Funções: **26 nossas**, mais uma (`rls_auto_enable`) se você marcou "Enable
automatic RLS" na criação do projeto — então 27 ali é o esperado, não um
problema. Se aparecer qualquer outra coisa a mais, vale investigar: função em
`public` que ninguém colocou é a forma clássica de uma alteração passar
despercebida.

O último é o que importa. Uma tabela sem RLS é uma tabela que
qualquer pessoa com a chave pública lê inteira, e a chave é pública por
definição. Diferente de zero, pare e me chame.

A contagem de funções ignora o que vem de extensão de propósito: o Supabase
instala o `pgcrypto` num schema separado, e o número dançaria sem motivo.

O painel vai continuar dizendo **"Last migration: No migrations"** mesmo depois
de rodar — aquele campo só enxerga migrations aplicadas pelo CLI do Supabase, e
aqui colamos SQL direto. A verdade está na consulta acima.

Opcional: [`03-primeira-atividade.sql`](03-primeira-atividade.sql) cria uma
atividade com 7 turmas, para o app não abrir com catálogo vazio. Tudo isso
também dá para fazer pelo painel, que é como vai ser no dia a dia.

## 6. Pegar as chaves

**Project Settings → API.** Você precisa de duas coisas:

- a **URL** do projeto (`https://xxxxx.supabase.co`);
- a **chave pública** — aparece como `anon` `public`, ou `publishable` nos
  projetos mais novos.

**Nunca** use a `service_role` (ou `secret`). Ela ignora a RLS inteira: num
bundle de navegador ou de celular, daria a qualquer pessoa o banco todo. Ela
não entra em nenhum arquivo deste repositório, e não precisa ser compartilhada
com ninguém — nem comigo.

## 7. Ligar o app e o painel

Dois arquivos, cada um na sua pasta. Ambos já estão no `.gitignore`.

`.env` na raiz (app das famílias):

```
EXPO_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=cole-a-chave-publica-aqui
```

`partner/.env` (painel):

```
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=cole-a-chave-publica-aqui
```

Reinicie o Metro (`npm start`) e o Vite (`cd partner && npm run dev`). O app
para de dizer "modo demonstração" no Perfil, e o painel para de dizer "dados
fictícios" na lateral. É assim que você confirma que pegou.

### Para o APK

`.env` não vai para dentro do build do EAS. As duas variáveis precisam entrar
em `eas.json`, no `env` do perfil que você usa:

```json
"preview": {
  "env": {
    "EXPO_PUBLIC_ENABLE_PARTNER_SIM": "true",
    "EXPO_PUBLIC_SUPABASE_URL": "https://xxxxx.supabase.co",
    "EXPO_PUBLIC_SUPABASE_ANON_KEY": "cole-a-chave-publica-aqui"
  }
}
```

Tudo que começa com `EXPO_PUBLIC_` fica visível para quem baixar o app — é da
natureza dessas duas, e por isso podem ficar no arquivo versionado. Segredo de
verdade nunca.

---

## Atualizar um banco que já existe

**O `01-banco.sql` roda uma vez só.** Ele tem `create table` sem
`if not exists`, então a segunda execução falha na primeira tabela. Para um
banco que já está de pé, use **`10-atualizar.sql`** — só o que entrou depois
da primeira subida, todo idempotente, seguro de rodar duas vezes.

Cole inteiro no SQL Editor e clique em Run. Depois confira:

```sql
select count(*) from class_sessions_visible;
select proname from pg_proc where proname in
  ('join_waitlist','leave_waitlist','my_waitlist','register_push_token','session_roster');
```

Se a primeira consulta der `relation "class_sessions_visible" does not exist`,
o script não rodou — e o app fica sem listar turma nenhuma, porque é dessa
visão que ele lê os horários.

## O link do e-mail de confirmação

Quem cria conta recebe um e-mail com um link, e o link precisa voltar para o
lugar certo — que são **dois lugares diferentes**: a família volta para o
aplicativo, o estabelecimento volta para o painel. O código já pede isso em
cada cadastro (`emailRedirectTo`); o que falta é o Supabase aceitar os dois
endereços.

Em **Authentication → URL Configuration**:

- **Site URL**: o endereço do painel publicado. É para onde vai quem clicar num
  link sem destino declarado.
- **Redirect URLs**: acrescente as linhas abaixo. Sem elas o Supabase ignora o
  destino pedido e manda todo mundo para o Site URL — a família cairia na tela
  de administrar estabelecimento.

  ```
  https://SEU-PAINEL.vercel.app
  https://painel.sejakidoo.com.br
  kidoo://*
  exp://*
  ```

  `kidoo://*` é o aplicativo instalado; `exp://*` é o Expo Go, e só serve
  enquanto você testa — tire quando parar de usá-lo.

  As duas primeiras convivem de propósito: o endereço da Vercel continua
  funcionando, e `painel.sejakidoo.com.br` passa a funcionar assim que o
  subdomínio apontar para lá. Mantenha as duas até o domínio próprio estar no ar,
  e então promova ele a **Site URL** — é o endereço que um dono de escola vê
  antes de decidir se você existe.

Depois disso, confirmar o e-mail entra direto: no app cai na Home, no painel
abre o cadastro do espaço. Nenhum dos dois pede a senha de novo — o clique no
link já é a prova de que a pessoa tem acesso àquela caixa de entrada.

### Se o link não funcionar

| Sintoma | Onde olhar |
| --- | --- |
| O link abre o navegador em vez do app | falta `kidoo://*` em Redirect URLs, ou a build instalada é anterior a esta |
| "Este link expirou" | o padrão do Supabase é 24h; peça um novo pela tela de confirmação |
| Cai no painel sendo família (ou o contrário) | o destino foi ignorado: confira as Redirect URLs |
| Nenhum e-mail chega | sem SMTP próprio o Supabase limita o envio a poucos por hora — veja Authentication → Emails |

## O aviso de vaga não chegou

[`12-conferir-avisos.sql`](12-conferir-avisos.sql) percorre a corrente inteira
— fila → gatilho → caixa de saída → aparelho → entrega → agendamento — e diz
em qual elo ela parou. Não muda nada; só lê. A **primeira** etapa que não vier
"ok" é a causa: as seguintes são consequência dela.

O elo mais comum é o quarto. Push do Expo não existe no navegador nem no Expo
Go, e até a correção do adapter (`run()` para funções sem retorno) o registro
do aparelho falhava sempre, calado dentro do `catch` que existe para não travar
o login. Com a build antiga instalada, `push_tokens` está vazia e o aviso é
gerado corretamente sem ter para onde ir.

## Um catálogo de Belo Horizonte

[`14-catalogo-bh.sql`](14-catalogo-bh.sql) apaga os parceiros `Teste GPS%` e
põe oito estabelecimentos em bairros de BH, com quatorze atividades e duas
semanas de turmas — a mesma janela que a tira de dias do app mostra.

Os **nomes são inventados**, e é de propósito: pôr no app o nome de uma
academia de verdade que não combinou nada faria o Kidoo anunciar vaga em nome
de quem nunca concordou, e é a família que apareceria na porta. Os **bairros e
as coordenadas são reais**, porque é deles que sai a distância no app e o
portão do check-in — "perto de mim" só se testa com distâncias que fazem
sentido para quem mora aqui.

Ninguém administra esses parceiros: eles não têm vínculo com conta nenhuma,
então não aparecem no seu painel. Existem para o app das famílias ter o que
mostrar.

## Testar o GPS de verdade

O portão de proximidade do check-in nunca foi exercitado com uma leitura real.
[`11-parceiros-teste.sql`](11-parceiros-teste.sql) cria cinco parceiros a
distâncias medidas de **um ponto que você escolhe** — de onde você vai estar
na hora do teste — com turma começando em 10 minutos, dentro da janela.

O ponto de ter distâncias conhecidas é saber a resposta antes de tocar no
botão. Um deles fica de propósito na zona cinzenta (400 m), onde o resultado
depende da qualidade do sinal: o raio é 250 m, mas a regra desconta a margem de
erro antes de comparar, e essa margem vai de 130 a 180 m. A dúvida conta a
favor de quem está chegando — é o desenho, não defeito.

Apagar depois: `delete from partners where name like 'Teste GPS%';`

## Depois desta primeira vez

O banco passa a mudar por **migrations novas** em `supabase/migrations/`, nunca
editando as antigas — uma migration já aplicada é história, e reescrevê-la faz
o banco de produção divergir em silêncio do que está no repositório.

O `01-banco.sql` é derivado: regenere com `supabase/setup/gerar.sh` em vez de
editá-lo à mão. O `10-atualizar.sql` também é derivado, e a lista de quais
migrations ele carrega está no cabeçalho dele — ao criar uma migration nova,
acrescente-a lá.
