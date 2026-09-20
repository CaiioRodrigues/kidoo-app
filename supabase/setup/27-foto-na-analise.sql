-- =====================================================================
-- Kidoo — a foto do pedido chega em quem analisa.
--
-- Para um banco que JÁ EXISTE, e DEPOIS da 26. Cole inteiro no SQL Editor do
-- Supabase e clique em Run. É idempotente.
--
-- A 26 tirou a foto do bucket público e deixou a policy do bucket novo
-- liberar a leitura para quem analisa. Faltava o outro lado: a fila nunca
-- devolveu o caminho da foto, então a tela não tinha o que abrir.
--
-- Depois desta, a tela de Pedidos mostra a foto do espaço em cada pedido.
-- Pedido sem foto continua sem foto — e a tela diz isso com todas as letras,
-- em vez de deixar um buraco.
-- =====================================================================

begin;

-- `drop` + `create`, e não `create or replace`: a função é `returns table`, e
-- `or replace` não muda a lista de colunas de retorno.
drop function if exists pending_applications();

create function pending_applications()
returns table (
  id           uuid,
  name         text,
  neighborhood text,
  city         text,
  address      text,
  phone        text,
  email        text,
  categories   text[],
  min_age      smallint,
  max_age      smallint,
  cnpj         text,
  photo_path   text,
  created_at   timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select a.id, a.name, a.neighborhood, a.city, a.address, a.phone,
         u.email, a.categories, a.min_age, a.max_age, a.cnpj,
         a.photo_path, a.created_at
    from partner_applications a
    join auth.users u on u.id = a.user_id
   where a.status = 'pendente' and is_kidoo_admin()
   order by a.created_at;
$$;

-- O `grant` morre junto com a função derrubada. Sem esta linha, a fila
-- responderia `permission denied` para quem analisa, na primeira tela depois
-- da colagem.
grant execute on function pending_applications() to authenticated;

commit;

-- ---------------------------------------------------------- conferir -------

-- `photo_path` tem de aparecer no retorno, e o `grant` tem de estar de pé.
select pg_get_function_result(p.oid) like '%photo_path%' as devolve_a_foto,
       has_function_privilege('authenticated', p.oid, 'execute') as quem_analisa_executa
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname = 'pending_applications';
