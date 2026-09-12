-- =====================================================================
-- Kidoo — endereço e telefone do estabelecimento.
--
-- Para um banco que JÁ EXISTE. Cole inteiro no SQL Editor do Supabase e
-- clique em Run. É idempotente: rodar duas vezes não faz mal.
--
-- O que entra:
--   1. `partners.address` e `partners.phone`.
--   2. Os dois são PREENCHIDOS a partir do que cada parceiro já digitou no
--      cadastro. O formulário sempre pediu rua e telefone (`not null`), e a
--      aprovação copiava só nome, bairro, cidade e coordenada — os dois campos
--      ficavam parados no pedido. Não há o que coletar: o dado existe e foi
--      escrito pelo próprio estabelecimento.
--   3. A aprovação para de perder os dois daqui em diante.
--   4. A visão do catálogo passa a carregar os dois.
--   5. O parceiro deixa de poder se autoverificar. Explicado lá embaixo.
--
-- Depois de rodar, o painel ganha a aba "Meu local", para corrigir e atualizar
-- o que veio do cadastro.
-- =====================================================================

begin;

alter table partners add column if not exists address text;
alter table partners add column if not exists phone   text;

comment on column partners.address is
  'Endereço da rua, como a família o leria. O mapa é aberto pela coordenada, não por este texto.';
comment on column partners.phone is
  'Telefone de contato do estabelecimento, para a família ligar. Não é o do responsável pela conta.';

create or replace view activities_public as
select
  a.id, a.partner_id, a.category_id, a.title, a.image_url,
  a.min_age, a.max_age, a.description, a.tags, a.rating, a.review_count,
  p.name          as partner_name,
  p.neighborhood  as partner_neighborhood,
  p.city          as partner_city,
  p.verified      as partner_verified,
  p.latitude      as partner_latitude,
  p.longitude     as partner_longitude,
  p.address       as partner_address,
  p.phone         as partner_phone,
  o.coin_cost     as coin_cost,
  o.next_starts_at as next_session_at,
  coalesce(o.open_sessions, 0) as open_sessions
from activities a
join partners p on p.id = a.partner_id
left join lateral (
  select min(s.coin_cost)  as coin_cost,
         min(s.starts_at)  as next_starts_at,
         count(*)          as open_sessions
    from class_sessions_open s
   where s.activity_id = a.id
) o on true
where a.active;

alter view activities_public set (security_invoker = true);
grant select on activities_public to anon, authenticated;

-- --------------------------------------- o que o parceiro já tinha escrito ---

/*
  O endereço e o telefone já eram pedidos — e jogados fora.

  `partner_applications` exige os dois (`not null`) desde que o cadastro
  existe: todo parceiro aprovado digitou a rua e o telefone para entrar. Mas
  `approve_application` copiava para `partners` só nome, bairro, cidade e
  coordenada, e os dois campos ficavam parados na linha do pedido, onde
  nenhuma tela olha.

  Então não há o que coletar: o dado existe, está correto e foi escrito pelo
  próprio estabelecimento. Só precisa atravessar.
*/

update partners p
   set address = a.address,
       phone   = a.phone
  from partner_applications a
 where a.partner_id = p.id
   and a.status = 'aprovado'
   and p.address is null
   and p.phone is null;

-- E a aprovação para de perder os dois daqui em diante. É a mesma função da
-- 000015, com duas colunas a mais no insert — o resto é idêntico de propósito:
-- `create or replace` substitui o corpo inteiro, então o que não for repetido
-- some.
create or replace function approve_application(p_id uuid)
returns partners
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ped     partner_applications%rowtype;
  v_partner partners%rowtype;
  v_cat     text;
begin
  if not is_kidoo_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;

  select * into v_ped from partner_applications where id = p_id for update;
  if not found then
    raise exception 'application_not_found' using errcode = 'P0002';
  end if;
  if v_ped.status = 'aprovado' then
    raise exception 'already_approved' using errcode = 'P0001';
  end if;

  foreach v_cat in array v_ped.categories loop
    if not exists (select 1 from activity_categories where id = v_cat) then
      raise exception 'unknown_category' using errcode = 'P0001';
    end if;
  end loop;

  insert into partners (name, neighborhood, city, verified, latitude, longitude, address, phone)
  values (v_ped.name, v_ped.neighborhood, v_ped.city, true, v_ped.latitude, v_ped.longitude,
          v_ped.address, v_ped.phone)
  returning * into v_partner;

  insert into partner_members (partner_id, user_id, role)
  values (v_partner.id, v_ped.user_id, 'owner');

  insert into payout_rates (partner_id, kind, amount_cents) values
    (v_partner.id, 'ociosa',  800),
    (v_partner.id, 'cheia',  1800);

  insert into activities (partner_id, category_id, title, min_age, max_age, description)
  select v_partner.id, c.id, c.label || ' — ' || v_ped.name,
         v_ped.min_age, v_ped.max_age, ''
    from activity_categories c
   where c.id = any (v_ped.categories);

  update partner_applications
     set status = 'aprovado', decided_at = now(), decided_by = auth.uid(),
         partner_id = v_partner.id, reason = null, updated_at = now()
   where id = p_id;

  return v_partner;
end;
$$;

-- ------------------------------------------------ o selo não se autoconcede ---

-- O `grant update on partners to authenticated` era a tabela inteira, e a
-- política `partner_reads_own` deixa o parceiro escrever na própria linha.
-- Juntos, os dois permitiam que um parceiro mandasse `{"verified": true}`
-- direto pela API REST e saísse "verificado" sozinho — o selo que a família
-- usa para decidir em quem confiar. Nunca houve tela para isso, e é por isso
-- que passou despercebido: ninguém precisa de tela para chamar o PostgREST.
--
-- Até agora nenhum dos dois clientes escrevia em `partners` (a linha nasce na
-- função da aprovação, que roda com privilégio próprio), então esta restrição
-- não tira nada de ninguém. Daqui em diante o painel edita endereço, telefone
-- e nome — e é essa a lista.
--
-- Fora dela de propósito: `verified` (é o selo) e `latitude`/`longitude` (são
-- a prova de distância do check-in — quem move a própria coordenada move o
-- portão junto). Mudança de endereço que mude a coordenada passa por você,
-- como na entrada.
revoke update on partners from authenticated;
grant update (name, neighborhood, city, address, phone) on partners to authenticated;

commit;

-- ------------------------------------------------------------- conferência ---

-- As duas colunas existem?
select column_name
  from information_schema.columns
 where table_name = 'partners' and column_name in ('address', 'phone')
 order by column_name;

-- Em quais colunas de `partners` um parceiro logado pode escrever?
-- `verified`, `latitude` e `longitude` NÃO podem aparecer nesta lista.
select column_name
  from information_schema.column_privileges
 where table_name = 'partners' and privilege_type = 'UPDATE' and grantee = 'authenticated'
 order by column_name;

-- Quantos parceiros ficaram com endereço, e quantos ainda estão sem?
-- Sem = cadastrados por fora do formulário, direto no SQL. Esses preenchem
-- pelo painel, na aba "Meu local".
select count(*) filter (where address is not null) as com_endereco,
       count(*) filter (where address is null)     as sem_endereco,
       count(*) filter (where phone   is not null) as com_telefone
  from partners;
