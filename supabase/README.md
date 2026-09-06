# Banco

Migrations em SQL puro, aplicáveis pelo Supabase CLI (`supabase db push`) ou por
`psql`. Não há nada específico do Supabase além de `auth.users` e `auth.uid()`,
que o teste local substitui por um stub.

## O que o schema garante

**A turma é quem tem lugar.** `class_sessions` carrega capacidade, matriculados
e `slots_open` — quantos lugares o parceiro liberou para o Kidoo. `slot_kind`
separa vaga **ociosa** (turma que roda de qualquer jeito e tem lugar sobrando,
custo marginal ~zero para o parceiro) de vaga **cheia**. O repasse sai daí, via
`payout_rates`.

**A vaga não é vendida duas vezes.** `book_session` trava a linha da turma com
`for update` antes de contar. Sem isso, duas famílias que confirmam no mesmo
segundo leem `slots_taken` antigo, as duas passam na checagem, e o parceiro
recebe duas crianças para um lugar só.

**Ninguém enxerga o que é do outro.** RLS separa responsável de responsável e
parceiro de parceiro. O catálogo é público, porque o app permite explorar sem
conta.

**Responsável não confirma a própria presença.** Ele não tem `update` em
`bookings`; quem confirma é o parceiro. Sem essa separação, o repasse viraria
autodeclaração.

> Falta ainda uma função de check-in: como o responsável não tem `update` em
> `bookings`, emitir o código precisa de um `security definer` próprio, no
> mesmo formato de `book_session`.

## Rodando os testes

Precisa de um Postgres local (16+). Não usa Docker nem rede.

```bash
export PGDATA_DIR=/var/lib/postgresql/kidoo-test
initdb -D "$PGDATA_DIR" -A trust -U postgres
pg_ctl -D "$PGDATA_DIR" -o "-p 5433 -k $PGDATA_DIR" start

supabase/tests/run.sh          # migrations + RLS + regras de reserva
supabase/tests/concurrency.sh  # duas famílias na mesma última vaga
```

`run.sh` recria o banco do zero a cada execução. `concurrency.sh` prepara o
próprio cenário — rodar depois de `run.sh` sem isso encontraria a turma já
cheia e passaria por engano, sem a corrida ter acontecido.

## Achados que os testes produziram

Três coisas que só apareceram rodando:

- **Faltavam os `grant`.** RLS filtra linhas; `grant` decide se a tabela pode
  ser tocada. O Supabase concede por *default privileges*, então em produção
  talvez passasse — mas num banco limpo o app inteiro responde
  `permission denied`, e o erro não menciona RLS em lugar nenhum.
- **`unique (session_id, child_id)` prendia a família.** Reserva cancelada
  continuava ocupando o par, e a criança não conseguia voltar para a mesma
  turma. Virou índice parcial, com `where status <> 'cancelled'`.
- **A view de repasse pagava reserva cancelada.** Hoje as funções impedem essa
  combinação, mas a view não deve depender disso para estar certa.
