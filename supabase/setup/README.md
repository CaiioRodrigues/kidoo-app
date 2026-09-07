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

## 2. Desligar a confirmação de e-mail (por enquanto)

**Authentication → Sign In / Providers → Email → Confirm email: desligado.**

Com ela ligada, o cadastro no app não devolve sessão: a pessoa cria a conta e
fica presa até clicar num link de e-mail. O app trata esse caso com uma
mensagem honesta, mas o fluxo fica pela metade.

Antes de abrir para famílias de verdade, **religue**. Sem confirmação, qualquer
um cria conta com o e-mail de outra pessoa. Quando chegar a hora, me peça a
tela de "confirme seu e-mail" — é meia hora de trabalho.

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

## Depois desta primeira vez

O banco passa a mudar por **migrations novas** em `supabase/migrations/`, nunca
editando as antigas — uma migration já aplicada é história, e reescrevê-la faz
o banco de produção divergir em silêncio do que está no repositório.

O `01-banco.sql` é derivado: regenere com `supabase/setup/gerar.sh` em vez de
editá-lo à mão.
