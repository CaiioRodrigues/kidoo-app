#!/usr/bin/env bash
# Os arquivos de `supabase/setup/` rodam do jeito que uma pessoa os roda:
# uma colagem inteira no SQL Editor do Supabase, por arquivo.
#
# Existe porque `run.sh` aplica as *migrations* com `psql -f`, e o psql abre uma
# transação por instrução. O SQL Editor manda a colagem inteira como UMA
# transação. São dois comportamentos diferentes do Postgres, e o que a suíte
# exercitava não era o que você usa.
#
# Foi assim que a `22` foi para a sua mão quebrada: `alter type ... add value`
# seguido de um `create view` que compara com o valor novo passa no psql e
# morre no editor, com
#
#     ERROR: 55P04 unsafe use of new value "no_show" of enum type booking_status
#
# Dois caminhos, porque são os dois que existem:
#
#   A. Banco novo — `01-banco.sql` numa colagem só.
#   B. Banco de pé — as migrations até a 000015, e depois os arquivos de
#      atualização em ordem, uma colagem cada.
#
# O caminho A é o que mais surpreende: ele também quebrava, e por muito tempo
# ninguém teria descoberto — quem instala do zero faz isso uma vez.
#
# Chamado por `run.sh`. Para rodar sozinho: `bash supabase/tests/colagem.sh`.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
RAIZ="$HERE/../.."
export PGHOST="${PGHOST:-/var/lib/postgresql/kidoo-test}"
export PGPORT="${PGPORT:-5433}"
export PGUSER="${PGUSER:-postgres}"

falhas=0
ok() { if [ "$1" = "0" ]; then echo "  ok    $2"; else echo "  FALHA $2"; falhas=$((falhas + 1)); fi; }

# O que o Supabase já traz pronto e o Postgres cru não tem.
ambiente() {
  psql -q -v ON_ERROR_STOP=1 -d "$1" >/dev/null <<'SQL'
create schema if not exists auth;
create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb);
create function auth.uid() returns uuid language sql stable as
  $fn$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $fn$;
do $do$ begin
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role nologin; end if;
end $do$;
grant usage on schema auth to authenticated, anon, service_role;
grant select on auth.users to authenticated, anon, service_role;
create schema if not exists storage;
create table if not exists storage.buckets (id text primary key, name text, public boolean default false,
  file_size_limit bigint, allowed_mime_types text[]);
create table if not exists storage.objects (id uuid primary key default gen_random_uuid(),
  bucket_id text, name text, owner uuid);
alter table storage.objects enable row level security;
create or replace function storage.foldername(name text) returns text[] language sql immutable as
  $fn$ select string_to_array(name, '/') $fn$;
SQL
}

# Uma colagem: o arquivo inteiro numa transação só, como o editor faz.
#
# `--single-transaction`, e não `-c "$(cat ...)"`: passar o arquivo como
# argumento parece mais fiel, mas o `01-banco.sql` tem 3881 linhas e estoura o
# limite de argumento do sistema — o shell devolve 126 sem nunca chamar o
# psql, e sem ERROR na saída o teste lê isso como sucesso. Quase entrou assim.
# O que importa reproduzir é a transação única, e é o que esta opção faz.
colar() {
  local banco="$1" arquivo="$2" saida
  if saida=$(psql -X -q -v ON_ERROR_STOP=1 --single-transaction -d "$banco" -f "$arquivo" 2>&1); then
    return 0
  fi
  echo "$saida" | grep -E 'ERROR|HINT|^LINE' | head -4 | sed 's/^/        /'
  return 1
}

echo ""
echo "A · banco novo: 01-banco.sql numa colagem só"
echo ""
dropdb --if-exists kidoo_colagem_novo 2>/dev/null
createdb kidoo_colagem_novo
ambiente kidoo_colagem_novo
colar kidoo_colagem_novo "$RAIZ/supabase/setup/01-banco.sql" && r=0 || r=1
ok "$r" "01-banco.sql"

echo ""
echo "B · banco de pé: as atualizações, uma colagem cada"
echo ""
dropdb --if-exists kidoo_colagem_velho 2>/dev/null
createdb kidoo_colagem_velho
ambiente kidoo_colagem_velho
# O ponto de partida é o banco anterior aos arquivos de atualização: tudo até a
# 000015. Da 000016 em diante é o que os arquivos de `setup/` fazem.
#
# O corte é por comparação, e não por lista escrita à mão: a lista existiu, e
# a primeira migration nova depois dela entrou nos dois lados — o banco "de
# pé" recebeu uma atualização que ainda não devia ter, e quebrou num erro que
# não tinha nada a ver com a causa.
PRIMEIRA_DO_SETUP=20260101000016
for f in "$RAIZ"/supabase/migrations/*.sql; do
  nome="$(basename "$f")"
  if [ "${nome%%_*}" \> "$PRIMEIRA_DO_SETUP" ] || [ "${nome%%_*}" = "$PRIMEIRA_DO_SETUP" ]; then
    continue
  fi
  psql -q -v ON_ERROR_STOP=1 -d kidoo_colagem_velho -f "$f" >/dev/null
done
for n in 19 20 21 22 23 24 25; do
  arquivo=$(ls "$RAIZ"/supabase/setup/$n-*.sql)
  colar kidoo_colagem_velho "$arquivo" && r=0 || r=1
  ok "$r" "$(basename "$arquivo")"
done

dropdb --if-exists kidoo_colagem_novo 2>/dev/null
dropdb --if-exists kidoo_colagem_velho 2>/dev/null

echo ""
if [ "$falhas" = "0" ]; then
  echo "colagem ok: os arquivos de setup rodam como uma pessoa os roda"
else
  echo "colagem: $falhas falha(s)"
  exit 1
fi
