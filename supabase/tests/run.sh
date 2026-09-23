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
  -- O papel do entregador de avisos. Sem ele aqui, os `grant` que a Edge
  -- Function precisa não seriam verificáveis fora do Supabase — e foi
  -- justamente a falta de um deles que fez nenhum aviso chegar.
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role nologin; end if;
end $do$;

-- O schema `storage` do Supabase, em esqueleto.
--
-- Sem ele, TODAS as policies de Storage eram puladas em silêncio: as
-- migrations checam `to_regclass('storage.objects')` e voltam sem criar nada.
-- Resultado: a regra que impede um responsável de abrir a foto do filho de
-- outra família nunca tinha sido executada por teste nenhum. As colunas aqui
-- são as que as policies leem — `bucket_id` e `name` —, não o schema
-- completo do Supabase.
create schema if not exists storage;
create table if not exists storage.buckets (
  id text primary key, name text, public boolean default false,
  file_size_limit bigint, allowed_mime_types text[]);
create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text, name text, owner uuid);
alter table storage.objects enable row level security;
grant select, insert, update, delete on storage.objects to authenticated;
grant select on storage.objects to anon;
grant select on storage.buckets to authenticated, anon;
create or replace function storage.foldername(name text) returns text[]
  language sql immutable as $fn$ select string_to_array(name, '/') $fn$;
grant usage on schema storage to authenticated, anon, service_role;
-- No Supabase os papéis do cliente enxergam o schema `auth` — é de lá que sai
-- `auth.uid()`, que as policies e o código chamam o tempo todo. Sem isto, um
-- teste que chama `auth.uid()` fora de uma função `security definer` falharia
-- por um motivo que não existe em produção.
grant usage on schema auth to authenticated, anon, service_role;
SQL

for f in "$HERE"/../migrations/*.sql; do
  psql -q -v ON_ERROR_STOP=1 -d kidoo_test -f "$f"
done

psql -q -v ON_ERROR_STOP=1 -d kidoo_test -f "$HERE/seed.sql"
psql -X -q -v ON_ERROR_STOP=1 -d kidoo_test -f "$HERE/rls.sql"
psql -X -q -v ON_ERROR_STOP=1 -d kidoo_test -f "$HERE/partner.sql"
psql -X -q -v ON_ERROR_STOP=1 -d kidoo_test -f "$HERE/applications.sql"
psql -X -q -v ON_ERROR_STOP=1 -d kidoo_test -f "$HERE/votacao.sql"

# E o mesmo banco, atacado de propósito: o que uma conta comum consegue fazer
# se tentar. Vem depois porque reaproveita os dados que os outros criaram.
psql -X -q -v ON_ERROR_STOP=1 -d kidoo_test -f "$HERE/invasao.sql"

# E os arquivos de `setup/` do jeito que uma pessoa os roda: colagem inteira no
# SQL Editor, ou seja, uma transação por arquivo. Aqui em cima o psql abre uma
# transação por instrução — o que passa de um jeito pode morrer do outro, e foi
# assim que a 22 chegou quebrada na mão de quem cola.
bash "$HERE/colagem.sh"

# Os dois testes em TypeScript rodam contra o mesmo banco recém-aplicado:
# paridade das regras que existem nos dois lados, e o contrato de nomes entre o
# adapter e o esquema — nada disso o `tsc` enxerga.
( cd "$HERE/../.." && npx tsx supabase/tests/parity.ts && npx tsx supabase/tests/contract.ts )
