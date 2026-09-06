-- O que o painel do parceiro precisa — e o que ele não pode fazer.
--
-- Duas perguntas organizam esta migration:
--   1. Como o parceiro vê quem vem hoje sem enxergar o cadastro das famílias?
--   2. O que ele **não** pode declarar sobre a própria vaga?

-- --------------------------------------------------- classificação da vaga ---

-- Vaga ociosa vale menos porque a turma acontece de qualquer jeito: o professor
-- já está pago e a sala já está alugada, então a criança a mais não custa nada.
-- Vaga cheia é turma que só existe por causa do Kidoo, e custa o valor integral.
--
-- Quem decide isso NÃO pode ser o parceiro. Com `kind` livre — como estava —
-- bastava marcar tudo como 'cheia' para dobrar o próprio repasse, sem mudar
-- nada no mundo real. Autodeclaração de preço não é preço, é pedido.
--
-- A regra: a turma já acontece quando tem matriculados diretos suficientes para
-- acontecer. Um mínimo absoluto, e não um percentual da capacidade — turma
-- grande tem ponto de equilíbrio proporcionalmente menor, e uma regra
-- percentual classificaria como "cheia" um futebol de 7 crianças que roda todo
-- sábado há dois anos.
--
-- Aviso honesto: `enrolled` é declarado pelo parceiro, então nenhuma regra aqui
-- torna a classificação inauditável por si só. O que esta função garante é que
-- `kind` **não seja um campo à parte**: mentir passa a exigir mentir sobre a
-- lotação da turma, que é verificável na porta. O resto é contrato e auditoria
-- por amostragem — é assim no Wellhub também.
create or replace function slot_kind_for(p_capacity int, p_enrolled int)
returns slot_kind language sql immutable as $$
  select case when p_enrolled >= 4 then 'ociosa' else 'cheia' end::slot_kind;
$$;

create or replace function force_slot_kind()
returns trigger language plpgsql as $$
begin
  new.kind := slot_kind_for(new.capacity, new.enrolled);
  return new;
end;
$$;

drop trigger if exists class_sessions_kind on class_sessions;
create trigger class_sessions_kind
  before insert or update of capacity, enrolled, kind on class_sessions
  for each row execute function force_slot_kind();

-- O custo em coins sai do bolso da família, não do parceiro: sem teto, dava
-- para publicar uma aula a 40 coins e torrar a cota semanal de quem reservasse.
alter table class_sessions drop constraint if exists coin_cost_within_band;
alter table class_sessions add constraint coin_cost_within_band
  check (coin_cost between 1 and 6);

-- ------------------------------------------------------- publicar a vaga ---

-- Abrir e fechar vaga é a operação central do painel. Vai por função para o
-- erro ser legível: um `update` direto esbarraria na constraint e devolveria
-- "violates check constraint slots_within_open", que não diz nada a ninguém.
create or replace function set_slots_open(p_session_id uuid, p_slots_open int)
returns class_sessions
language plpgsql
security definer
set search_path = public
as $$
declare v_session class_sessions%rowtype;
begin
  select * into v_session from class_sessions where id = p_session_id for update;
  if not found then
    raise exception 'session_not_found' using errcode = 'P0002';
  end if;
  if not is_partner_member((select partner_id from activities where id = v_session.activity_id)) then
    raise exception 'not_this_partner' using errcode = '42501';
  end if;

  if p_slots_open < 0 then
    raise exception 'negative_slots' using errcode = 'P0001';
  end if;
  -- Fechar abaixo do que já foi reservado deixaria famílias com reserva e sem
  -- lugar. Quem quer reduzir precisa esperar ou combinar com quem já reservou.
  if p_slots_open < v_session.slots_taken then
    raise exception 'slots_already_taken' using errcode = 'P0001';
  end if;
  if v_session.enrolled + p_slots_open > v_session.capacity then
    raise exception 'over_capacity' using errcode = 'P0001';
  end if;

  update class_sessions set slots_open = p_slots_open where id = p_session_id
  returning * into v_session;
  return v_session;
end;
$$;

-- Publicar uma turma nova. `kind` não é parâmetro de propósito — é derivado.
create or replace function publish_session(
  p_activity_id uuid,
  p_starts_at   timestamptz,
  p_capacity    int,
  p_enrolled    int,
  p_slots_open  int,
  p_coin_cost   int
)
returns class_sessions
language plpgsql
security definer
set search_path = public
as $$
declare v_session class_sessions%rowtype;
begin
  if not is_partner_member((select partner_id from activities where id = p_activity_id)) then
    raise exception 'not_this_partner' using errcode = '42501';
  end if;
  if p_starts_at <= now() then
    raise exception 'session_in_the_past' using errcode = 'P0001';
  end if;
  if p_enrolled + p_slots_open > p_capacity then
    raise exception 'over_capacity' using errcode = 'P0001';
  end if;

  insert into class_sessions (activity_id, starts_at, capacity, enrolled, slots_open, coin_cost)
  values (p_activity_id, p_starts_at, p_capacity, p_enrolled, p_slots_open, p_coin_cost)
  returning * into v_session;
  return v_session;
end;
$$;

-- ---------------------------------------------------------------- agenda ---

-- As turmas do parceiro numa janela de tempo, com o que ele precisa ver de
-- relance: quantos reservaram, quantos já chegaram, quantos ele confirmou.
create or replace function partner_agenda(p_from timestamptz, p_to timestamptz)
returns table (
  session_id     uuid,
  activity_id    uuid,
  activity_title text,
  category_id    text,
  starts_at      timestamptz,
  capacity       smallint,
  enrolled       smallint,
  slots_open     smallint,
  slots_taken    smallint,
  kind           slot_kind,
  coin_cost      smallint,
  checked_in     bigint,
  confirmed      bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select s.id, a.id, a.title, a.category_id, s.starts_at,
         s.capacity, s.enrolled, s.slots_open, s.slots_taken, s.kind, s.coin_cost,
         count(*) filter (where b.status in ('checked_in','completed')),
         count(*) filter (where b.partner_confirmed_at is not null)
    from class_sessions s
    join activities a on a.id = s.activity_id
    left join bookings b on b.session_id = s.id and b.status <> 'cancelled'
   where is_partner_member(a.partner_id)
     and s.starts_at >= p_from and s.starts_at < p_to
   group by s.id, a.id, a.title, a.category_id, s.starts_at,
            s.capacity, s.enrolled, s.slots_open, s.slots_taken, s.kind, s.coin_cost
   order by s.starts_at;
$$;

-- ----------------------------------------------------------------- lista ---

-- Quem vem nesta turma.
--
-- É `security definer` porque `children` é privado por RLS — e tem de continuar
-- sendo: o parceiro não pode listar as crianças de ninguém, só as que reservaram
-- com ele. E mesmo dessas, ele recebe o mínimo para receber uma criança na
-- porta: **primeiro nome e idade**. Sobrenome, foto, data de nascimento exata e
-- o contato do responsável não saem daqui — nada disso é preciso para dizer
-- "oi, João, sua turma é ali".
create or replace function session_roster(p_session_id uuid)
returns table (
  booking_id           uuid,
  child_first_name     text,
  child_age            int,
  status               booking_status,
  checked_in_at        timestamptz,
  partner_confirmed_at timestamptz,
  slot_kind            slot_kind,
  has_code             boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select b.id,
         split_part(c.name, ' ', 1),
         extract(year from age(c.birth_date))::int,
         b.status,
         b.checked_in_at,
         b.partner_confirmed_at,
         b.slot_kind,
         b.check_in is not null
    from bookings b
    join children c   on c.id = b.child_id
    join activities a on a.id = b.activity_id
   where b.session_id = p_session_id
     and b.status <> 'cancelled'
     and is_partner_member(a.partner_id)
   order by c.name;
$$;

-- --------------------------------------------------------------- repasse ---

-- O extrato mensal, já com o nome do mês e separado por tipo de vaga. É a
-- tela que prova para o parceiro quanto a vaga ociosa rendeu de receita que
-- antes era zero.
create or replace function partner_statement(p_months int default 6)
returns table (
  month       timestamptz,
  slot_kind   slot_kind,
  check_ins   bigint,
  rate_cents  integer,
  total_cents bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select p.month, p.slot_kind, p.check_ins, p.rate_cents, p.total_cents
    from partner_payouts p
   where is_partner_member(p.partner_id)
     and p.month >= date_trunc('month', now()) - make_interval(months => greatest(0, p_months))
   order by p.month desc, p.slot_kind;
$$;

grant execute on function slot_kind_for(int, int) to anon, authenticated;
grant execute on function set_slots_open(uuid, int) to authenticated;
grant execute on function publish_session(uuid, timestamptz, int, int, int, int) to authenticated;
grant execute on function partner_agenda(timestamptz, timestamptz) to authenticated;
grant execute on function session_roster(uuid) to authenticated;
grant execute on function partner_statement(int) to authenticated;
