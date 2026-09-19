-- =====================================================================
-- Kidoo — a avaliação deixa de carregar o id de quem a escreveu.
--
-- Para um banco que JÁ EXISTE, e DEPOIS da 23. Cole inteiro no SQL Editor do
-- Supabase e clique em Run. É idempotente: rodar duas vezes não faz mal.
--
-- Não muda nenhuma tela: o app nunca pediu essa coluna. É só a porta que
-- estava aberta sem ninguém passar por ela.
-- =====================================================================

begin;

-- Não dá para tirar uma coluna de um `grant` de tabela: o jeito é derrubar o
-- grant inteiro e reconceder coluna a coluna. Mesmo caminho do `update` de
-- `partners`, que precisou disso para proteger `verified` e a coordenada.
revoke select on reviews from anon, authenticated;

grant select (id, booking_id, activity_id, author_name, rating, comment, created_at, helpful_count)
  on reviews to anon, authenticated;

commit;

-- ---------------------------------------------------------- conferir -------

-- `guardian_id` NÃO pode aparecer nesta lista. As outras oito, sim.
select column_name
  from information_schema.column_privileges
 where table_name = 'reviews' and grantee = 'anon' and privilege_type = 'SELECT'
 order by column_name;
