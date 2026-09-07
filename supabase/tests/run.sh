#!/usr/bin/env bash
# Sobe um Postgres descartável, aplica as migrations e roda os testes.
#
# Não usa o Supabase CLI de propósito: as migrations são SQL puro, e um
# Postgres local prova RLS e concorrência sem depender de Docker nem de rede.
set -euo pipefail

PGDATA_DIR="${PGDATA_DIR:-/var/lib/postgresql/kidoo-test}"
PORT="${PORT:-5433}"
HERE="$(cd "$(dirname "$0")" && pwd)"

export PGHOST="$PGDATA_DIR" PGPORT="$PORT" PGUSER=postgres

psql -tc 'select 1' >/dev/null 2>&1 || {
  echo "Postgres não está no ar em $PGDATA_DIR:$PORT."
  echo "  initdb -D \$PGDATA_DIR -A trust -U postgres"
  echo "  pg_ctl -D \$PGDATA_DIR -o \"-p $PORT -k \$PGDATA_DIR\" start"
  exit 1
}

dropdb --if-exists kidoo_test
createdb kidoo_test

# auth.users e auth.uid() são do Supabase; fora dele viram stub para o teste.
psql -q -v ON_ERROR_STOP=1 -d kidoo_test <<'SQL'
create schema if not exists auth;
create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb);
create function auth.uid() returns uuid language sql stable as
  $fn$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $fn$;
do $do$ begin
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
end $do$;
SQL

for f in "$HERE"/../migrations/*.sql; do
  psql -q -v ON_ERROR_STOP=1 -d kidoo_test -f "$f"
done

psql -q -v ON_ERROR_STOP=1 -d kidoo_test -f "$HERE/seed.sql"
psql -X -q -v ON_ERROR_STOP=1 -d kidoo_test -f "$HERE/rls.sql"
psql -X -q -v ON_ERROR_STOP=1 -d kidoo_test -f "$HERE/partner.sql"

# Os dois testes em TypeScript rodam contra o mesmo banco recém-aplicado:
# paridade das regras que existem nos dois lados, e o contrato de nomes entre o
# adapter e o esquema — nada disso o `tsc` enxerga.
( cd "$HERE/../.." && npx tsx supabase/tests/parity.ts && npx tsx supabase/tests/contract.ts )
