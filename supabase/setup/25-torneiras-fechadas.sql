-- =====================================================================
-- Kidoo — o cliente para de poder escrever no que decide dinheiro.
--
-- Para um banco que JÁ EXISTE, e DEPOIS da 24. Cole inteiro no SQL Editor do
-- Supabase e clique em Run. É idempotente.
--
-- ATENÇÃO: esta é a correção mais importante desta leva. Até ela, qualquer
-- pessoa com uma conta no app conseguia, com UM pedido HTTP:
--
--   * destravar a própria assinatura sem pagar nada
--   * se dar 9999 coins
--   * emitir Kidoo Bônus para si mesma
--   * inventar XP para a criança
--
-- Nenhuma tela muda. O app nunca escreveu nessas colunas.
-- =====================================================================

begin;

-- ------------------------------------------------- a cota e o bônus --------

-- Nenhuma escrita direta, de ninguém. `select` fica: as duas telas leem.
revoke insert, update, delete on subscriptions from authenticated;
revoke insert, update, delete on bonus_grants  from authenticated;

-- ------------------------------------------------- o responsável -----------

-- Grant de tabela não sabe excluir coluna: derruba e reconcede.
revoke insert, update, delete on guardians from authenticated;
grant update (photo_url) on guardians to authenticated;

-- ------------------------------------------------- a criança ---------------

revoke insert, update, delete on children from authenticated;

-- O cadastro. `xp` fora: criança nasce com zero, e quem dá XP é a presença
-- confirmada pelo parceiro.
grant insert (guardian_id, name, birth_date, gender, photo_url, interests)
  on children to authenticated;

-- A troca de foto, e nada mais. `KidooApi.children` tem `list`, `create` e
-- `updatePhoto` — o dia em que existir "editar perfil", a migration daquele
-- dia acrescenta as colunas.
grant update (photo_url) on children to authenticated;

commit;

-- ---------------------------------------------------------- conferir -------

-- Em que colunas uma família logada ainda pode escrever? A lista TEM de ser
-- exatamente esta — `photo_url` em `guardians`, e em `children` as do
-- cadastro mais `photo_url`. Nada de `xp`, `coins_remaining` ou `status`.
select table_name, privilege_type, column_name
  from information_schema.column_privileges
 where grantee = 'authenticated'
   and table_name in ('guardians','children','subscriptions','bonus_grants')
   and privilege_type in ('INSERT','UPDATE','DELETE')
 order by table_name, privilege_type, column_name;
