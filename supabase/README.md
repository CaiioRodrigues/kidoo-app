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

**Ninguém escreve em `bookings` direto** — nem o responsável, nem o parceiro.
Reservar, cancelar, fazer check-in e confirmar presença passam por funções
`security definer`, que travam a linha e controlam exatamente quais colunas
mudam. Uma policy de `update` aberta ao parceiro deixaria ele marcar
`partner_confirmed_at` sem código nenhum, e o repasse viraria autodeclaração do
outro lado.

**A cota semanal vira no servidor.** `roll_subscription_cycle` aplica a virada
de segunda-feira (fuso de Brasília, que é o que a tela promete) antes de
qualquer leitura ou débito. Isso vivia só em `src/lib/subscription.ts` — ou
seja, só no cliente: um app que não recarrega gastaria a cota da semana passada
indefinidamente.

**O dinheiro anda dentro da transação.** `book_session` debita o bônus (que
expira primeiro) e depois a cota da assinatura, na mesma transação que trava a
vaga. Debitar fora dela abriria janela para gastar o mesmo coin duas vezes.
Cancelar devolve a cota; o bônus volta ao lote original, mantendo a validade —
senão cancelar viraria uma forma de esticar o prazo de uma moeda vencendo.

**Quem mede a distância é o servidor.** `check_in` recebe a leitura crua do
aparelho (latitude, longitude, precisão) e calcula a distância contra a
coordenada do parceiro, com `distance_m`. Receber uma distância já pronta seria
autodeclaração: "estou a 10 m" é só um número que qualquer um edita. A
coordenada entra no cálculo e vai embora — o que fica gravado é a distância.

**O nome do autor da avaliação não vem do cliente.** `submit_review` o deriva do
perfil (só o primeiro nome). O `insert` direto em `reviews` foi revogado; com
ele, dava para assinar uma avaliação com o nome de outra família.

## Regras duplicadas, de propósito

Nível, bônus e custo de XP existem em SQL **e** em `src/lib/levels.ts`. O banco
precisa ser a autoridade (creditar fora da transação abre brecha) e a tela
precisa prever o resultado antes de chamar.

Duplicação em duas linguagens é onde este tipo de projeto racha em silêncio:
alguém ajusta a curva de um lado, o app mostra um número e o banco credita
outro. Por isso existe `tests/parity.ts`, que roda as duas implementações sobre
a mesma faixa de XP e compara. Verifiquei que ele falha quando as regras
divergem — um teste de paridade que não pega divergência não vale nada.

## Rodando os testes

Precisa de um Postgres local (16+). Não usa Docker nem rede.

```bash
export PGDATA_DIR=/var/lib/postgresql/kidoo-test
initdb -D "$PGDATA_DIR" -A trust -U postgres
pg_ctl -D "$PGDATA_DIR" -o "-p 5433 -k $PGDATA_DIR" start

supabase/tests/run.sh          # migrations + RLS + reserva + check-in + extrato
                               # (já roda parity.ts e contract.ts no fim)
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
- **Presença já confirmada aceitava novo check-in.** `check_in_booking` só
  desviava quando o status era `checked_in`; com `completed` ele caía no
  caminho normal e creditava mais 100 de XP. Repetindo, era uma fábrica de
  Kidoo Bônus — e o mesmo buraco existia no mock.

## O contrato de nomes com o adapter

`tests/contract.ts` lê `src/services/supabase/` e pergunta ao Postgres se cada
tabela, coluna, função e parâmetro que o adapter cita existe de verdade.

É a classe de erro que o TypeScript não vê: `rpc('book_sesion', ...)` compila e
só quebra na mão do usuário. O teste foi sabotado de propósito (nome de tabela
trocado, parâmetro com typo, coluna inventada no mapper) e apontou os cinco
casos antes de voltar a passar.
