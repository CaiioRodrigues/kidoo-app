-- =====================================================================
-- Kidoo — o candidato fica sabendo da decisão.
--
-- Para um banco que JÁ EXISTE, e DEPOIS da 27. Cole inteiro no SQL Editor do
-- Supabase e clique em Run. É idempotente.
--
-- Cria a caixa de saída `email_outbox` e faz `approve_application` e
-- `reject_application` escreverem nela. Nada é enviado ainda: quem entrega é a
-- Edge Function `enviar-emails`, e o passo a passo dela está em
-- `28-email-da-decisao.md`.
--
-- Enquanto ela não estiver no ar, nada se perde — as mensagens ficam
-- acumuladas e saem todas na primeira execução. Mesmo desenho dos avisos de
-- vaga.
-- =====================================================================

begin;

create table if not exists email_outbox (
  id         uuid primary key default gen_random_uuid(),
  -- O endereço é gravado AQUI, no momento da decisão, e não consultado na
  -- entrega: é para este endereço que a decisão foi tomada. Se a conta trocar
  -- de e-mail depois, o aviso ainda vai para onde o pedido foi feito.
  to_email   text not null,
  kind       text not null check (kind in ('pedido_aprovado', 'pedido_recusado')),
  data       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  sent_at    timestamptz,
  error      text
);

create index if not exists email_outbox_pendentes on email_outbox (created_at)
  where sent_at is null;

alter table email_outbox enable row level security;
-- Sem policy nenhuma: fechada para app e painel. E a policy não basta — o
-- privilégio de tabela vem antes dela e não é automático nem para o
-- `service_role`. Foi exatamente isso que fez os avisos de vaga falharem com
-- `42501: permission denied` antes de qualquer policy ser avaliada.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    raise notice 'sem papel service_role: pulando os grants do entregador';
    return;
  end if;
  -- `insert` fica de fora de propósito: quem escreve é o banco, nas funções de
  -- decisão. O entregador só lê e marca.
  grant select, update on email_outbox to service_role;
end $$;

-- ------------------------------------------------ aprovar avisa quem pediu --

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
  v_email   text;
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

  -- A modalidade é lista fechada. Um pedido com categoria inventada viraria
  -- atividade que o app não sabe desenhar — sem ícone, sem cor, sem filtro.
  foreach v_cat in array v_ped.categories loop
    if not exists (select 1 from activity_categories where id = v_cat) then
      raise exception 'unknown_category' using errcode = 'P0001';
    end if;
  end loop;

  insert into partners (name, neighborhood, city, verified, latitude, longitude)
  values (v_ped.name, v_ped.neighborhood, v_ped.city, true, v_ped.latitude, v_ped.longitude)
  returning * into v_partner;

  insert into partner_members (partner_id, user_id, role)
  values (v_partner.id, v_ped.user_id, 'owner');

  -- O repasse padrão da casa. Vaga ociosa vale menos porque a turma acontece
  -- de qualquer jeito; vaga cheia é turma que só existe por causa do Kidoo.
  insert into payout_rates (partner_id, kind, amount_cents) values
    (v_partner.id, 'ociosa',  800),
    (v_partner.id, 'cheia',  1800);

  -- Uma atividade por modalidade, com a faixa etária que ele declarou. É o
  -- esqueleto: título e descrição ele ajusta depois, no painel.
  insert into activities (partner_id, category_id, title, min_age, max_age, description)
  select v_partner.id, c.id, c.label || ' — ' || v_ped.name,
         v_ped.min_age, v_ped.max_age, ''
    from activity_categories c
   where c.id = any (v_ped.categories);

  update partner_applications
     set status = 'aprovado', decided_at = now(), decided_by = auth.uid(),
         partner_id = v_partner.id, reason = null, updated_at = now()
   where id = p_id;

  -- O aviso vai para a fila. Conta sem e-mail não impede a aprovação: o
  -- estabelecimento existe, o dono entra no painel e opera. Perder o aviso é
  -- um incômodo; desfazer a aprovação por causa dele seria um estrago.
  select u.email into v_email from auth.users u where u.id = v_ped.user_id;
  if coalesce(btrim(v_email), '') <> '' then
    insert into email_outbox (to_email, kind, data)
    values (v_email, 'pedido_aprovado',
            jsonb_build_object('estabelecimento', v_ped.name));
  end if;

  return v_partner;
end;
$$;

-- ------------------------------------------- recusar entrega o motivo -------

/**
 * Recusar, com motivo.
 *
 * O motivo não é gentileza: sem ele o candidato reenvia o mesmo pedido, e
 * quem analisa recusa o mesmo pedido de novo, para sempre. Agora ele também
 * CHEGA — antes ficava guardado esperando o candidato voltar por conta.
 */
create or replace function reject_application(p_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nome    text;
  v_user    uuid;
  v_email   text;
begin
  if not is_kidoo_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;
  if coalesce(btrim(p_reason), '') = '' then
    raise exception 'reason_required' using errcode = 'P0001';
  end if;

  update partner_applications
     set status = 'recusado', reason = p_reason, decided_at = now(),
         decided_by = auth.uid(), updated_at = now()
   where id = p_id and status <> 'aprovado'
  returning name, user_id into v_nome, v_user;

  if not found then
    raise exception 'application_not_found' using errcode = 'P0002';
  end if;

  select u.email into v_email from auth.users u where u.id = v_user;
  if coalesce(btrim(v_email), '') <> '' then
    insert into email_outbox (to_email, kind, data)
    values (v_email, 'pedido_recusado',
            jsonb_build_object('estabelecimento', v_nome, 'motivo', p_reason));
  end if;
end;
$$;

grant execute on function approve_application(uuid)      to authenticated;
grant execute on function reject_application(uuid, text) to authenticated;

commit;

-- ---------------------------------------------------------- conferir -------

-- A caixa existe, está fechada (RLS ligada) e o entregador alcança.
select relrowsecurity as rls_ligada,
       has_table_privilege('service_role', 'email_outbox', 'select') as entregador_le,
       has_table_privilege('service_role', 'email_outbox', 'update') as entregador_marca,
       has_table_privilege('authenticated', 'email_outbox', 'select') as painel_le_NAO_PODE
  from pg_class where oid = 'email_outbox'::regclass;

-- E as duas funções de decisão passaram a escrever nela.
select p.proname,
       p.prosrc like '%email_outbox%' as avisa_o_candidato
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.proname in ('approve_application', 'reject_application')
 order by p.proname;
