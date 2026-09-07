#!/usr/bin/env bash
# Regenera `01-banco.sql` a partir das migrations.
#
# O arquivo colável é derivado, nunca editado à mão: editar os dois lados é
# como as duas versões passam a discordar sem ninguém perceber.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
cd "$HERE/../.."
bash -c '
{
  sed -n "1,14p" supabase/setup/01-banco.sql
  for f in supabase/migrations/*.sql; do
    printf "\n-- =====================================================================\n"
    printf -- "-- %s\n" "$(basename "$f")"
    printf -- "-- =====================================================================\n\n"
    cat "$f"
  done
  printf "\ncommit;\n\n-- Se chegou até aqui sem erro, o banco está pronto.\n-- Próximo passo: \`supabase/setup/02-primeiro-parceiro.sql\`.\n"
} > /tmp/01-banco.sql && mv /tmp/01-banco.sql supabase/setup/01-banco.sql'
echo "supabase/setup/01-banco.sql regenerado ($(wc -l < supabase/setup/01-banco.sql) linhas)"
