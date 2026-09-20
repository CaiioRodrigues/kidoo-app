-- =====================================================================
-- A foto do pedido chega em quem analisa.
-- =====================================================================
--
-- A migration anterior tirou essa foto do bucket público e deixou a policy
-- do bucket novo liberar a leitura para `is_kidoo_admin()`. Faltava o outro
-- lado: `pending_applications()` nunca devolveu `photo_path`, então a tela de
-- análise não tinha o que assinar. A porta estava aberta e não havia corredor.
--
-- Um pedido chega com nome, endereço, CNPJ e modalidades — e a decisão é
-- sobre um ESPAÇO onde criança vai ficar. A foto é a única parte do pedido
-- que mostra o espaço; sem ela, aprovar é aprovar um formulário.
--
-- É `drop` + `create`, e não `create or replace`: a função é `returns table`,
-- e `or replace` não muda a lista de colunas de retorno (`cannot change
-- return type of existing function`). O `grant` morre junto com a função
-- derrubada, então ele volta logo abaixo — esquecê-lo deixaria a fila inteira
-- respondendo `permission denied` para quem analisa.
-- =====================================================================

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
  -- O caminho dentro do bucket `pedidos`, não a URL: URL assinada expira em
  -- uma hora, e quem monta a fila é quem sabe quando vai exibi-la.
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

grant execute on function pending_applications() to authenticated;
