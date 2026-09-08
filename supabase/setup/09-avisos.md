# Avisos de vaga (push)

O gatilho no banco já enfileira o aviso quando uma vaga abre. Esta página é
sobre a outra metade: **quem tira o aviso da fila e entrega**. Enquanto ela não
estiver feita, nada se perde — os avisos ficam acumulados em `push_outbox` e
saem todos na primeira execução.

## Como está montado

```
vaga abre  →  gatilho escreve em push_outbox  →  Edge Function entrega  →  Expo  →  celular
 (instantâneo, dentro da transação)              (a cada 5 min, fora dela)
```

A entrega é separada de propósito. O gatilho roda dentro da transação que
devolve a vaga; uma chamada de rede ali seguraria o lock da turma pelo tempo do
serviço de push responder — e uma queda dele desfaria o cancelamento da família.

## 0. Credencial de push do Android (FCM)

**Este passo é obrigatório e é o que mais passa despercebido**, porque nada
falha até o aparelho tentar pegar o token — e aí falha em silêncio, dentro do
`catch` que existe para não travar o login. O sintoma é `push_tokens` vazia com
a permissão de notificação concedida.

O push do Expo no Android não entrega sozinho: ele entrega **pelo Firebase
Cloud Messaging**. Sem credencial de FCM no projeto do EAS,
`getExpoPushTokenAsync` levanta erro e o aparelho nunca é registrado.

1. Em <https://console.firebase.google.com>, crie um projeto (ou use um que já
   exista) e adicione um **app Android** com o pacote exato:

   ```
   com.kidoo.app
   ```

2. Baixe o `google-services.json` que ele oferece, coloque na **raiz do
   repositório** e aponte no `app.json`:

   ```json
   "android": {
     "package": "com.kidoo.app",
     "googleServicesFile": "./google-services.json"
   }
   ```

   Este arquivo **não é segredo** — ele vai dentro do APK de qualquer jeito,
   como a chave publicável do Supabase. Pode ser versionado.

3. No Firebase: **Configurações do projeto → Contas de serviço → Gerar nova
   chave privada**. Baixe o JSON. **Esse sim é segredo**: não entra no
   repositório.

4. Entregue essa chave ao EAS:

   ```bash
   eas credentials --platform android
   ```

   Escolha o perfil (`preview`), depois **Push Notifications (FCM V1)** e
   **Upload a service account key** — o JSON do passo 3.

5. Gere a build de novo. Sem passar de novo pelo build, a credencial não vale:

   ```bash
   eas build --platform android --profile preview
   ```

No iOS não há Firebase: a credencial é a chave de push da Apple, e o `eas
credentials --platform ios` cuida dela — mas exige conta paga de
desenvolvedor.

Para conferir sem abrir o banco, o Perfil do app mostra o estado deste
aparelho em **Avisos**: "Avisos ativados" quer dizer registrado.

## 1. Publicar a função

Precisa do [Supabase CLI](https://supabase.com/docs/guides/cli) na sua máquina.

**Antes de tudo, dois cuidados que valem o erro que eles evitam:**

- Rode **da raiz do repositório**. O CLI procura `supabase/functions/<nome>/index.ts`
  a partir da pasta onde você está.
- Traga a branch antes. Se o seu clone estiver atrasado, a função ainda não
  existe na sua máquina e o deploy falha com
  `Entrypoint path does not exist`, que parece erro de servidor mas é arquivo
  faltando no seu lado.

```bash
cd /caminho/para/kidoo-app
git pull origin claude/android-ios-app-design-4n77ap
ls supabase/functions/enviar-avisos/index.ts   # tem de existir antes de seguir

npx supabase login
npx supabase link --project-ref efqsiuwqqzpausyemjed
npx supabase functions deploy enviar-avisos
```

O aviso `WARNING: Docker is not running` é esperado e não impede o deploy —
o empacotamento acontece no servidor do Supabase.

`SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` já existem dentro das Edge
Functions — **não** crie esses segredos à mão, e não coloque a chave de serviço
em arquivo nenhum deste repositório.

## 2. Agendar

No SQL Editor do Supabase, uma vez.

**Primeiro guarde a chave de serviço no Vault** — no banco, nunca no
repositório. (A instrução antiga aqui era
`alter database postgres set app.settings.service_key = ...`; ela **não
funciona mais**: exige superusuário, e o `postgres` do Supabase não é mais um.
O erro é `42501: permission denied to set parameter`.)

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Rodar de novo? Apague antes: o nome do segredo é único.
delete from vault.secrets where name = 'kidoo_service_key';
select vault.create_secret('COLE_A_SERVICE_ROLE_AQUI', 'kidoo_service_key');
```

O Vault guarda cifrado e só o `postgres` lê — a chave não aparece no texto do
agendamento, que qualquer um com acesso ao banco consegue ler em `cron.job`.

Depois, o agendamento:

```sql
select cron.schedule(
  'entregar-avisos-de-vaga',
  '*/5 * * * *',
  $$
    select net.http_post(
      url     := 'https://efqsiuwqqzpausyemjed.supabase.co/functions/v1/enviar-avisos',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || (select decrypted_secret
                                         from vault.decrypted_secrets
                                        where name = 'kidoo_service_key')
      )
    );
  $$
);
```

Confira que o segredo é legível de dentro do agendamento antes de esperar cinco
minutos por nada:

```sql
select left(decrypted_secret, 6) || '…' as chave_ok
  from vault.decrypted_secrets where name = 'kidoo_service_key';
```

Cinco minutos é de propósito: vaga em turma infantil não é leilão. Um atraso de
poucos minutos não muda quem consegue o lugar, e uma execução por minuto seria
gasto sem retorno.

## 3. Conferir

```sql
-- Fila pendente e o que já saiu
select sent_at is null as pendente, error, count(*)
  from push_outbox group by 1, 2 order by 1 desc;

-- Aparelhos registrados
select platform, count(*) from push_tokens group by 1;

-- Últimas execuções do agendamento
select * from cron.job_run_details order by start_time desc limit 5;
```

Rodar na mão, sem esperar os 5 minutos:

```bash
curl -X POST https://efqsiuwqqzpausyemjed.supabase.co/functions/v1/enviar-avisos \
  -H "Authorization: Bearer SUA_SERVICE_ROLE"
```

A resposta diz quantos foram: `{"pendentes":3,"enviados":3,"sem_aparelho":0,...}`.

## O que NÃO funciona

- **Navegador.** Push do Expo não existe na web. `obterTokenDePush` devolve
  `null` e o app segue normal — a fila continua registrada, só não há entrega.
- **Expo Go.** Desde o SDK 53 o Expo Go não recebe push no Android. Precisa da
  build do EAS ou de uma dev build.
- **Emulador.** Sem aparelho físico não há token. Testar isso exige celular.
- **Build sem credencial de FCM.** O APK instala, o app abre, a permissão é
  concedida — e o token nunca sai. É o passo 0 acima.

Ou seja: o teste de ponta a ponta é com o APK instalado. Um jeito rápido de
provocar o aviso sem esperar alguém cancelar:

```sql
-- Enche a turma, entra na fila pelo app, e então devolve a vaga aqui:
update class_sessions set slots_open = slots_open + 1
 where id = 'ID_DA_TURMA';
-- confira que o aviso entrou:
select title, body from push_outbox order by created_at desc limit 1;
```

## Se o aviso não chegar

| Sintoma | Onde olhar |
| --- | --- |
| `push_outbox` vazio depois de abrir vaga | ninguém na `session_waitlist` daquela turma, ou `notified_at` já preenchido |
| Pendente e não sai | a função não foi publicada, ou o cron não está agendado (`cron.job_run_details`) |
| `42501: permission denied to set parameter` ao agendar | instrução antiga: use o Vault, no passo 2 acima |
| O cron roda mas nada sai | o `Authorization` foi montado vazio — confira o segredo com o `select` do passo 2 |
| `permission denied for table push_outbox` (42501) | faltam os `grant` da migration 000014: rode o `10-atualizar.sql` |
| `error = 'sem aparelho registrado'` | a família nunca abriu o app numa build de verdade, negou a permissão, ou a build saiu sem credencial de FCM (passo 0) |
| `push_tokens` vazia com a permissão concedida | quase sempre é o passo 0: falta o FCM no projeto do EAS |
| `error = 'DeviceNotRegistered'` | app desinstalado; o token já foi removido sozinho |
