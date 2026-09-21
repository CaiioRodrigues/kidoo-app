# O e-mail da decisão

O `28-email-da-decisao.sql` já faz as funções de decisão escreverem na caixa de
saída. Esta página é sobre a outra metade: **quem tira o e-mail da fila e
entrega**. Enquanto ela não estiver feita, nada se perde — as mensagens ficam
acumuladas em `email_outbox` e saem todas na primeira execução.

## Como está montado

```
aprovar/recusar  →  a função escreve em email_outbox  →  Edge Function  →  Resend  →  caixa de entrada
 (instantâneo, dentro da transação)                      (a cada 5 min, fora dela)
```

A entrega é separada de propósito, pelo mesmo motivo dos avisos de vaga:
`approve_application` cria parceiro, vínculo de dono, atividades e repasse numa
transação só. Uma ida à rede ali seguraria a transação pelo tempo do Resend
responder — e uma queda dele desfaria uma aprovação que já estava certa.

O texto da mensagem mora na função, não no banco. A caixa guarda **o que
aconteceu** (`kind` + `data`), então mudar a redação não é migration, e uma
mensagem que ficou na fila sai com o texto novo.

## 0. O domínio tem de estar verificado

Isto depende do Resend com `sejakidoo.com.br` verificado — o caminho inteiro
está em [`16-smtp.md`](16-smtp.md). Se o domínio ainda não fechou, o Resend
recusa o envio com `403`, a função registra o erro em `email_outbox.error` e
**não tenta de novo**: 4xx é recusa definitiva, tentar amanhã dá o mesmo erro.

Enquanto você testa sozinho, o Resend entrega para o endereço da própria conta
mesmo sem domínio verificado. Dá para percorrer o fluxo com uma conta de
parceiro que use o seu e-mail.

## 1. Publicar a função

Os mesmos dois cuidados do `09-avisos.md`: rode **da raiz do repositório**, e
traga a branch antes — clone atrasado dá `Entrypoint path does not exist`, que
parece erro de servidor e é arquivo faltando no seu lado.

```bash
cd /caminho/para/kidoo-app
git pull
ls supabase/functions/enviar-emails/index.ts   # tem de existir antes de seguir

npx supabase login
npx supabase link --project-ref efqsiuwqqzpausyemjed
npx supabase functions deploy enviar-emails
```

`WARNING: Docker is not running` é esperado e não impede o deploy.

## 2. A chave do Resend

Ela **não entra em arquivo nenhum deste repositório**. Vai como segredo da
função:

```bash
npx supabase secrets set RESEND_API_KEY=re_sua_chave_aqui
```

Dois segredos opcionais, com padrão razoável:

| Segredo           | Padrão                                  | Quando mexer                      |
| ----------------- | --------------------------------------- | --------------------------------- |
| `EMAIL_REMETENTE` | `Kidoo <nao-responda@sejakidoo.com.br>` | outro remetente, ou outro domínio |
| `PAINEL_URL`      | `https://sejakidoo.com.br`              | o painel mudar de endereço        |

`SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` já existem dentro das Edge
Functions — **não** crie esses à mão.

## 3. Agendar

No SQL Editor, uma vez. Se você já agendou os avisos de vaga, o segredo do
Vault já existe e você pula direto para o `cron.schedule`.

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Só se ainda não existir (o agendamento dos avisos já cria este segredo):
-- delete from vault.secrets where name = 'kidoo_service_key';
-- select vault.create_secret('COLE_A_SERVICE_ROLE_AQUI', 'kidoo_service_key');

select cron.schedule(
  'entregar-emails-de-decisao',
  '*/5 * * * *',
  $$
    select net.http_post(
      url     := 'https://efqsiuwqqzpausyemjed.supabase.co/functions/v1/enviar-emails',
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

Cinco minutos é de propósito. Uma decisão de cadastro não é urgente ao minuto —
o candidato esperou dias pela análise, e cinco minutos a mais não mudam nada.

## 4. Conferir

```sql
-- A fila: o que saiu, o que falhou e por quê
select kind, sent_at is null as pendente, error, count(*)
  from email_outbox
 group by 1, 2, 3
 order by 1, 2;
```

Para provar o caminho inteiro sem esperar o cron, aprove um pedido de teste e
chame a função na mão:

```bash
curl -i -X POST \
  'https://efqsiuwqqzpausyemjed.supabase.co/functions/v1/enviar-emails' \
  -H "Authorization: Bearer SUA_SERVICE_ROLE"
```

Ela devolve `{"pendentes":N,"enviados":N,"falhas":0}`. **Me mande só esse JSON
e o status HTTP — nunca a chave.**

## Se o e-mail não chegar

Leia a coluna `error` antes de qualquer outra coisa: ela guarda a resposta do
Resend, e ela diz qual dos casos é.

| `error` contém                   | O que é                                                       |
| -------------------------------- | ------------------------------------------------------------- |
| `403` + `domain is not verified` | o DNS do `16-smtp.md` ainda não fechou                        |
| `422` + `Invalid \`to\` field`   | o endereço da conta não é válido                              |
| `401`                            | `RESEND_API_KEY` errada ou não configurada                    |
| `tipo desconhecido`              | a função publicada é mais velha que o banco — republique      |
| vazio, com `sent_at` nulo        | a função não rodou. Confira o `cron.job` e o segredo do Vault |

**`sent_at` preenchido com `error` preenchido não é contradição:** significa que
a mensagem saiu da fila sem ser entregue, porque insistir daria o mesmo erro
para sempre. É o caso do domínio não verificado — conserte o DNS e reenfileire
à mão se quiser recuperar os que já falharam.
