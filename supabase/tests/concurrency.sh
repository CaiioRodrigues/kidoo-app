#!/usr/bin/env bash
# Duas famílias confirmando a MESMA última vaga no mesmo instante.
#
# É o teste que justifica o `for update` em `book_session`. Sem ele as duas
# transações leem `slots_taken` antigo, as duas passam na checagem, e o parceiro
# recebe duas crianças para um lugar só. Um teste de uma conexão só nunca pega
# isso — por isso este script abre duas.
set -euo pipefail

PGDATA_DIR="${PGDATA_DIR:-/var/lib/postgresql/kidoo-test}"
PORT="${PORT:-5433}"
HERE="$(cd "$(dirname "$0")" && pwd)"
export PGHOST="$PGDATA_DIR" PGPORT="$PORT" PGUSER=postgres

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
chmod 755 "$TMP"

# Estado próprio: rodar depois de run.sh deixaria a turma já cheia, e a corrida
# nem aconteceria — os dois seriam recusados e o teste passaria por engano.
psql -X -q -v ON_ERROR_STOP=1 -d kidoo_test <<'SQL'
delete from bookings where session_id = 'eeeeeeee-0000-0000-0000-000000000001';
update class_sessions set slots_open = 1, slots_taken = 0
 where id = 'eeeeeeee-0000-0000-0000-000000000001';
SQL

# Ana entra, reserva e segura a transação aberta por 3s sem comitar.
cat > "$TMP/ana.sql" <<'SQL'
set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false);
begin;
select (book_session('eeeeeeee-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000001')).id;
select pg_sleep(3);
commit;
SQL

# Bruno chega 1s depois e tenta a mesma vaga.
cat > "$TMP/bruno.sql" <<'SQL'
set role authenticated;
select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',false);
select (book_session('eeeeeeee-0000-0000-0000-000000000001','bbbbbbbb-0000-0000-0000-000000000001')).id;
SQL

psql -X -q -d kidoo_test -f "$TMP/ana.sql"   > "$TMP/ana.out"   2>&1 &
sleep 1
psql -X -q -d kidoo_test -f "$TMP/bruno.sql" > "$TMP/bruno.out" 2>&1 &
wait

reservas=$(psql -X -q -t -d kidoo_test -c \
  "select count(*) from bookings where session_id='eeeeeeee-0000-0000-0000-000000000001' and status <> 'cancelled'" | tr -d ' ')
tomadas=$(psql -X -q -t -d kidoo_test -c \
  "select slots_taken from class_sessions where id='eeeeeeee-0000-0000-0000-000000000001'" | tr -d ' ')

echo "  reservas ativas na turma: $reservas (esperado 1)"
echo "  slots_taken:              $tomadas (esperado 1)"
grep -q 'session_full' "$TMP/bruno.out" \
  && echo "  o segundo recebeu session_full, como deve" \
  || { echo "FALHOU: o segundo não foi recusado"; cat "$TMP/bruno.out"; exit 1; }

[ "$reservas" = "1" ] && [ "$tomadas" = "1" ] \
  || { echo "FALHOU: a vaga foi vendida duas vezes"; exit 1; }
echo "  concorrência ok"
