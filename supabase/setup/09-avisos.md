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

## 1. Publicar a função

Precisa do [Supabase CLI](https://supabase.com/docs/guides/cli) na sua máquina:

```bash
npx supabase login
npx supabase link --project-ref efqsiuwqqzpausyemjed
npx supabase functions deploy enviar-avisos
```

`SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` já existem dentro das Edge
Functions — **não** crie esses segredos à mão, e não coloque a chave de serviço
em arquivo nenhum deste repositório.

## 2. Agendar

No SQL Editor do Supabase, uma vez:

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'entregar-avisos-de-vaga',
  '*/5 * * * *',
  $$
    select net.http_post(
      url     := 'https://efqsiuwqqzpausyemjed.supabase.co/functions/v1/enviar-avisos',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_key', true)
      )
    );
  $$
);
```

Antes disso, guarde a chave de serviço **no banco**, não no repositório:

```sql
alter database postgres set app.settings.service_key = 'COLE_A_SERVICE_ROLE_AQUI';
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
| `error = 'sem aparelho registrado'` | a família nunca abriu o app numa build de verdade, ou negou a permissão |
| `error = 'DeviceNotRegistered'` | app desinstalado; o token já foi removido sozinho |
