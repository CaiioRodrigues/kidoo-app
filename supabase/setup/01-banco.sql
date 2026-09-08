-- =====================================================================
-- Kidoo — primeira subida do banco.
--
-- Cole ISTO INTEIRO no SQL Editor do Supabase e clique em Run. É a soma
-- das seis migrations de `supabase/migrations/`, na ordem, sem nenhuma
-- alteração — gerado por `supabase/setup/gerar.sh`.
--
-- Roda uma vez. Depois disso, mudanças no banco entram como migrations
-- novas, nunca editando as antigas.
-- =====================================================================

begin;



-- =====================================================================
-- 20260101000000_init.sql
-- =====================================================================

-- Kidoo — esquema inicial.
--
-- Traduz o domínio de `src/types/domain.ts`. A regra que organiza tudo:
-- **a turma é quem tem lugar**, e é o parceiro quem decide quantos abre para o
-- Kidoo. Sem isso não existe vaga ociosa nem extrato de repasse.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- pessoas ---

-- Perfil do responsável. 1:1 com auth.users; o id é o mesmo de propósito, para
-- as policies compararem direto com auth.uid() sem um join no meio.
create table guardians (
  id          uuid primary key references auth.users (id) on delete cascade,
  name        text not null,
  email       text not null,
  city        text not null default 'Belo Horizonte',
  phone       text,
  created_at  timestamptz not null default now()
);

create table children (
  id          uuid primary key default gen_random_uuid(),
  guardian_id uuid not null references guardians (id) on delete cascade,
  name        text not null,
  birth_date  date not null,
  gender      text not null default 'undisclosed'
                check (gender in ('female', 'male', 'undisclosed')),
  photo_url   text,
  xp          integer not null default 0 check (xp >= 0),
  interests   text[] not null default '{}',
  created_at  timestamptz not null default now()
);
create index children_guardian_idx on children (guardian_id);

-- -------------------------------------------------------------- parceiros ---

create table partners (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  neighborhood  text not null,
  city          text not null,
  verified      boolean not null default false,
  -- Distância é derivada disto. Nunca guardamos a coordenada da família.
  latitude      double precision not null,
  longitude     double precision not null,
  created_at    timestamptz not null default now()
);

-- Quem administra cada parceiro no painel. É a tabela que a RLS consulta para
-- decidir o que um funcionário da recepção pode ver.
create table partner_members (
  partner_id  uuid not null references partners (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  role        text not null default 'staff' check (role in ('owner', 'staff')),
  created_at  timestamptz not null default now(),
  primary key (partner_id, user_id)
);
create index partner_members_user_idx on partner_members (user_id);

-- --------------------------------------------------------------- catálogo ---

create table activity_categories (
  id     text primary key,
  label  text not null
);

create table activities (
  id           uuid primary key default gen_random_uuid(),
  partner_id   uuid not null references partners (id) on delete cascade,
  category_id  text not null references activity_categories (id),
  title        text not null,
  image_url    text,
  min_age      smallint not null,
  max_age      smallint not null check (max_age >= min_age),
  description  text not null default '',
  tags         text[] not null default '{}',
  rating       numeric(2,1) not null default 0 check (rating between 0 and 5),
  review_count integer not null default 0,
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);
create index activities_partner_idx on activities (partner_id);
create index activities_category_idx on activities (category_id);

create type slot_kind as enum ('ociosa', 'cheia');

-- Uma turma concreta. `slots_open` é o que o parceiro liberou para o Kidoo;
-- `slots_taken` é o que já foi reservado. A diferença é o que está à venda.
create table class_sessions (
  id            uuid primary key default gen_random_uuid(),
  activity_id   uuid not null references activities (id) on delete cascade,
  starts_at     timestamptz not null,
  capacity      smallint not null check (capacity > 0),
  enrolled      smallint not null default 0 check (enrolled >= 0),
  slots_open    smallint not null default 0 check (slots_open >= 0),
  slots_taken   smallint not null default 0 check (slots_taken >= 0),
  kind          slot_kind not null default 'cheia',
  coin_cost     smallint not null check (coin_cost > 0),
  created_at    timestamptz not null default now(),
  -- Nunca vender mais do que foi aberto, nem abrir mais do que cabe.
  constraint slots_within_open  check (slots_taken <= slots_open),
  constraint open_within_capacity check (enrolled + slots_open <= capacity)
);
create index sessions_activity_starts_idx on class_sessions (activity_id, starts_at);
create index sessions_starts_idx on class_sessions (starts_at);

-- --------------------------------------------------------- assinatura/bônus ---

create table subscriptions (
  guardian_id       uuid primary key references guardians (id) on delete cascade,
  plan_id           text not null,
  coins_per_week    smallint not null check (coins_per_week >= 0),
  coins_remaining   smallint not null check (coins_remaining >= 0),
  cycle_started_at  timestamptz not null default now(),
  renews_at         timestamptz not null
);

create table bonus_grants (
  id          uuid primary key default gen_random_uuid(),
  child_id    uuid not null references children (id) on delete cascade,
  amount      smallint not null check (amount > 0),
  remaining   smallint not null check (remaining >= 0),
  level       smallint not null,
  granted_at  timestamptz not null default now(),
  -- Lote datado: sem isto não dá para saber o que vence quando.
  expires_at  timestamptz not null,
  constraint remaining_within_amount check (remaining <= amount)
);
create index bonus_child_expiry_idx on bonus_grants (child_id, expires_at);

-- --------------------------------------------------------------- reservas ---

create type booking_status as enum ('confirmed', 'checked_in', 'completed', 'cancelled');

create table bookings (
  id                   uuid primary key default gen_random_uuid(),
  guardian_id          uuid not null references guardians (id) on delete cascade,
  child_id             uuid not null references children (id) on delete cascade,
  session_id           uuid not null references class_sessions (id) on delete restrict,
  activity_id          uuid not null references activities (id) on delete restrict,
  status               booking_status not null default 'confirmed',
  scheduled_at         timestamptz not null,
  checked_in_at        timestamptz,
  coin_cost            smallint not null check (coin_cost > 0),
  -- Congelado na reserva: o extrato do parceiro é calculado sobre isto, e a
  -- turma pode mudar de tipo depois.
  slot_kind            slot_kind not null,
  payment              jsonb not null default '{}'::jsonb,
  check_in             jsonb,
  partner_confirmed_at timestamptz,
  check_in_proof       jsonb,
  created_at           timestamptz not null default now()
);

-- Uma criança não ocupa dois lugares na mesma turma — mas cancelar e reservar
-- de novo tem de funcionar. Com uma unique comum, a reserva cancelada ficava
-- ocupando o par (turma, criança) para sempre e a família não conseguia voltar.
create unique index one_seat_per_child
  on bookings (session_id, child_id)
  where status <> 'cancelled';
create index bookings_guardian_idx on bookings (guardian_id);
create index bookings_session_idx on bookings (session_id);
create index bookings_activity_idx on bookings (activity_id);

create table reviews (
  id          uuid primary key default gen_random_uuid(),
  booking_id  uuid not null unique references bookings (id) on delete cascade,
  activity_id uuid not null references activities (id) on delete cascade,
  guardian_id uuid not null references guardians (id) on delete cascade,
  rating      smallint not null check (rating between 1 and 5),
  comment     text not null default '',
  created_at  timestamptz not null default now()
);
create index reviews_activity_idx on reviews (activity_id);

-- ---------------------------------------------------------------- repasse ---

-- O que cada parceiro recebe, por tipo de vaga. Vaga ociosa é outro produto e
-- por isso tem preço próprio — não é um desconto sobre a cheia.
create table payout_rates (
  partner_id    uuid not null references partners (id) on delete cascade,
  kind          slot_kind not null,
  amount_cents  integer not null check (amount_cents >= 0),
  updated_at    timestamptz not null default now(),
  primary key (partner_id, kind)
);

-- =====================================================================
-- 20260101000001_economy.sql
-- =====================================================================

-- Coins, XP e bônus.
--
-- Estas regras existem duas vezes: aqui e em `src/lib/{levels,bonus}.ts`. Não é
-- descuido. O banco precisa ser a autoridade — debitar coin fora da transação
-- da reserva deixa brecha para gastar duas vezes — e a tela precisa **prever**
-- o resultado antes de chamar (quanto vai custar, que nível vem depois). Quando
-- uma mudar, a outra muda junto; os testes em `supabase/tests` comparam as duas.

-- ----------------------------------------------------------------- níveis ---

-- XP para sair do nível n. Cresce a cada nível: o primeiro sai em 2 aulas, o
-- último exige 20.
create or replace function xp_to_leave_level(p_level int)
returns int language sql immutable as $$
  select case when p_level >= 25 then 0 else 150 + (p_level - 1) * 80 end;
$$;

create or replace function level_from_xp(p_xp int)
returns int language plpgsql immutable as $$
declare v_level int := 1; v_left int := p_xp; v_cost int;
begin
  loop
    v_cost := xp_to_leave_level(v_level);
    exit when v_cost = 0 or v_left < v_cost;
    v_left := v_left - v_cost;
    v_level := v_level + 1;
  end loop;
  return v_level;
end;
$$;

-- Bônus ganho ao alcançar um nível.
create or replace function bonus_for_level(p_level int)
returns int language sql immutable as $$
  select case
    when p_level <= 1  then 0
    when p_level >= 25 then 10
    when p_level <= 3  then 1
    when p_level <= 6  then 2
    when p_level <= 9  then 3
    when p_level <= 14 then 4
    when p_level <= 19 then 5
    else 6
  end;
$$;

-- ------------------------------------------------------------------ bônus ---

-- Saldo de bônus válido: lote vencido não conta.
create or replace function bonus_balance(p_child_id uuid)
returns int language sql stable as $$
  select coalesce(sum(remaining), 0)::int
    from bonus_grants
   where child_id = p_child_id and expires_at > now();
$$;

-- Consome bônus do lote que vence primeiro. Sem essa ordem, o lote curto
-- morreria no estoque enquanto o longo era gasto.
create or replace function consume_bonus(p_child_id uuid, p_amount int)
returns void language plpgsql as $$
declare v_left int := p_amount; v_lot record;
begin
  for v_lot in
    select id, remaining from bonus_grants
     where child_id = p_child_id and remaining > 0 and expires_at > now()
     order by expires_at asc
     for update
  loop
    exit when v_left <= 0;
    update bonus_grants
       set remaining = remaining - least(v_left, v_lot.remaining)
     where id = v_lot.id;
    v_left := v_left - least(v_left, v_lot.remaining);
  end loop;

  if v_left > 0 then
    raise exception 'insufficient_bonus' using errcode = 'P0001';
  end if;
end;
$$;

-- =====================================================================
-- 20260101000002_booking.sql
-- =====================================================================

-- Reserva e cancelamento.
--
-- A checagem de vaga **não pode** viver no cliente nem em duas queries soltas:
-- duas famílias tocam em "confirmar" no mesmo segundo e as duas leem
-- `slots_taken` antigo. Aqui a linha da turma é travada antes de contar.

create or replace function book_session(p_session_id uuid, p_child_id uuid)
returns bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_guardian  uuid := auth.uid();
  v_session   class_sessions%rowtype;
  v_activity  activities%rowtype;
  v_booking   bookings%rowtype;
  v_sub       subscriptions%rowtype;
  v_from_bonus int;
  v_from_sub   int;
begin
  if v_guardian is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  -- A criança é de quem está reservando? Sem isto, um id vazado permitiria
  -- reservar no nome de criança alheia.
  if not exists (
    select 1 from children
     where id = p_child_id and guardian_id = v_guardian
  ) then
    raise exception 'child_not_found' using errcode = 'P0002';
  end if;

  -- `for update` serializa quem chegar junto: o segundo só lê depois que o
  -- primeiro comitar, e aí enxerga o slots_taken já incrementado.
  select * into v_session
    from class_sessions
   where id = p_session_id
     for update;

  if not found then
    raise exception 'session_not_found' using errcode = 'P0002';
  end if;
  if v_session.starts_at <= now() then
    raise exception 'session_already_started' using errcode = 'P0001';
  end if;
  if v_session.slots_taken >= v_session.slots_open then
    raise exception 'session_full' using errcode = 'P0001';
  end if;

  select * into v_activity from activities where id = v_session.activity_id;

  -- O bônus entra antes da cota da assinatura porque ele expira; a cota volta
  -- ao cheio toda semana de qualquer jeito.
  v_from_bonus := least(bonus_balance(p_child_id), v_session.coin_cost);
  v_from_sub   := v_session.coin_cost - v_from_bonus;

  if v_from_sub > 0 then
    -- Aplica a virada de semana ANTES de olhar o saldo: uma reserva feita na
    -- segunda tem de usar a cota nova, e quem decide isso é o banco. Confiar no
    -- cliente para resetar deixaria um app que não recarrega gastando a cota da
    -- semana passada para sempre. (`roll_subscription_cycle` vive na migration
    -- 000005; plpgsql resolve o nome na chamada, não na criação.)
    v_sub := roll_subscription_cycle(v_guardian);
    if v_sub.guardian_id is null then
      raise exception 'no_subscription' using errcode = 'P0001';
    end if;
    if v_sub.coins_remaining < v_from_sub then
      raise exception 'insufficient_coins' using errcode = 'P0001';
    end if;
    update subscriptions
       set coins_remaining = coins_remaining - v_from_sub
     where guardian_id = v_guardian;
  end if;

  if v_from_bonus > 0 then
    perform consume_bonus(p_child_id, v_from_bonus);
  end if;

  update class_sessions
     set slots_taken = slots_taken + 1
   where id = p_session_id;

  insert into bookings (
    guardian_id, child_id, session_id, activity_id,
    scheduled_at, coin_cost, slot_kind, payment
  ) values (
    v_guardian, p_child_id, v_session.id, v_activity.id,
    v_session.starts_at, v_session.coin_cost, v_session.kind,
    jsonb_build_object('fromBonus', v_from_bonus, 'fromSubscription', v_from_sub,
                       'total', v_session.coin_cost)
  )
  returning * into v_booking;

  return v_booking;
end;
$$;

-- Cancelar devolve a vaga. Sem isto a turma "encheria" de reservas canceladas
-- e o parceiro perderia lugar que está livre.
create or replace function cancel_booking(p_booking_id uuid)
returns bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_guardian uuid := auth.uid();
  v_booking  bookings%rowtype;
begin
  select * into v_booking
    from bookings
   where id = p_booking_id and guardian_id = v_guardian
     for update;

  if not found then
    raise exception 'booking_not_found' using errcode = 'P0002';
  end if;
  if v_booking.status <> 'confirmed' then
    raise exception 'booking_not_cancellable' using errcode = 'P0001';
  end if;

  update class_sessions
     set slots_taken = greatest(0, slots_taken - 1)
   where id = v_booking.session_id;

  -- Devolve a cota da assinatura. O bônus não volta como lote novo: ele
  -- mantém a validade original, senão cancelar viraria uma forma de esticar o
  -- prazo de uma moeda que estava para vencer.
  if (v_booking.payment->>'fromSubscription')::int > 0 then
    update subscriptions
       set coins_remaining = coins_remaining + (v_booking.payment->>'fromSubscription')::int
     where guardian_id = v_booking.guardian_id;
  end if;

  if (v_booking.payment->>'fromBonus')::int > 0 then
    update bonus_grants
       set remaining = least(amount, remaining + (v_booking.payment->>'fromBonus')::int)
     where id = (
       select id from bonus_grants
        where child_id = v_booking.child_id and expires_at > now()
        order by expires_at asc limit 1
     );
  end if;

  update bookings
     set status = 'cancelled', check_in = null
   where id = p_booking_id
  returning * into v_booking;

  return v_booking;
end;
$$;

-- Extrato de repasse: o que o Kidoo deve a cada parceiro, separado por tipo de
-- vaga. É a visão que fecha o mês — e a que prova, para o parceiro, quanto a
-- vaga ociosa rendeu de receita que antes era zero.
create or replace view partner_payouts as
select
  a.partner_id,
  date_trunc('month', b.scheduled_at)      as month,
  b.slot_kind,
  count(*)                                  as check_ins,
  coalesce(r.amount_cents, 0)               as rate_cents,
  count(*) * coalesce(r.amount_cents, 0)    as total_cents
from bookings b
join activities a on a.id = b.activity_id
left join payout_rates r on r.partner_id = a.partner_id and r.kind = b.slot_kind
-- Só presença confirmada pelo parceiro gera repasse. "O app diz que veio" não
-- é presença; a leitura do código é. E reserva cancelada não paga, mesmo que
-- tenha sido confirmada antes — hoje as funções impedem essa combinação, mas a
-- view não deve depender disso para estar certa.
where b.partner_confirmed_at is not null
  and b.status <> 'cancelled'
group by a.partner_id, date_trunc('month', b.scheduled_at), b.slot_kind, r.amount_cents;

-- =====================================================================
-- 20260101000003_checkin.sql
-- =====================================================================

-- Check-in.
--
-- Precisa de função própria porque o responsável **não tem `update` em
-- `bookings`** — e isso é de propósito: se ele pudesse editar a reserva,
-- assinaria a própria presença. Aqui ele só consegue mudar o que esta função
-- deixa mudar.

-- Código de 6 dígitos, fácil de ditar em voz alta quando a câmera falha.
create or replace function generate_check_in_code()
returns text language sql volatile as $$
  select lpad((floor(random() * 1000000))::int::text, 6, '0');
$$;

create or replace function check_in_booking(
  p_booking_id uuid,
  p_distance_m int default null,
  p_mocked boolean default false
)
returns bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_guardian uuid := auth.uid();
  v_booking  bookings%rowtype;
  v_child    children%rowtype;
  v_before   int;
  v_after    int;
  v_bonus    int := 0;
  v_ticket   jsonb;
  v_lvl      int;
begin
  select * into v_booking from bookings
   where id = p_booking_id and guardian_id = v_guardian
     for update;
  if not found then
    raise exception 'booking_not_found' using errcode = 'P0002';
  end if;
  if v_booking.status = 'cancelled' then
    raise exception 'booking_cancelled' using errcode = 'P0001';
  end if;
  -- Presença já confirmada pelo parceiro está encerrada. Sem esta linha, um
  -- novo check-in na mesma reserva caía no caminho de baixo e creditava mais
  -- 100 de XP — repetindo, viraria uma fábrica de Kidoo Bônus.
  if v_booking.status = 'completed' then
    raise exception 'already_confirmed' using errcode = 'P0001';
  end if;

  -- Janela de horário: estar no local três horas antes não é chegar.
  if now() < v_booking.scheduled_at - interval '45 minutes' then
    raise exception 'check_in_too_early' using errcode = 'P0001';
  end if;
  if now() > v_booking.scheduled_at + interval '90 minutes' then
    raise exception 'check_in_too_late' using errcode = 'P0001';
  end if;

  -- Distância é recalculada pelo servidor a partir da coordenada do parceiro —
  -- o cliente manda onde acha que está, nunca "estou no local". Negamos com
  -- prova contra, nunca por falta de prova: sem leitura o check-in segue,
  -- marcado como não verificado, e quem confirma de fato é o parceiro.
  if p_distance_m is not null and not p_mocked and p_distance_m > 250 then
    raise exception 'too_far_from_venue' using errcode = 'P0001';
  end if;

  v_ticket := jsonb_build_object(
    'code', generate_check_in_code(),
    'issuedAt', now(),
    'expiresAt', now() + interval '30 minutes'
  );

  -- Repetir o check-in só reemite o código: não credita XP de novo.
  if v_booking.status = 'checked_in' then
    update bookings set check_in = v_ticket where id = p_booking_id
    returning * into v_booking;
    return v_booking;
  end if;

  select * into v_child from children where id = v_booking.child_id for update;
  v_before := level_from_xp(v_child.xp);
  v_after  := level_from_xp(v_child.xp + 100);

  update children set xp = xp + 100 where id = v_child.id;

  -- Subir de nível gera Kidoo Bônus, com validade de 30 dias.
  if v_after > v_before then
    for v_lvl in (v_before + 1)..v_after loop
      v_bonus := v_bonus + bonus_for_level(v_lvl);
    end loop;
    if v_bonus > 0 then
      insert into bonus_grants (child_id, amount, remaining, level, expires_at)
      values (v_child.id, v_bonus, v_bonus, v_after, now() + interval '30 days');
    end if;
  end if;

  update bookings
     set status = 'checked_in',
         checked_in_at = now(),
         check_in = v_ticket,
         check_in_proof = jsonb_build_object(
           'locationVerified', p_distance_m is not null and not p_mocked,
           'distanceM', p_distance_m,
           'mocked', p_mocked
         )
   where id = p_booking_id
  returning * into v_booking;

  return v_booking;
end;
$$;

-- Confirmação do parceiro: é isto que transforma "o app diz que veio" em
-- presença, e é o que libera o repasse.
create or replace function confirm_by_partner(p_booking_id uuid, p_code text)
returns bookings
language plpgsql
security definer
set search_path = public
as $$
declare v_booking bookings%rowtype;
begin
  select * into v_booking from bookings where id = p_booking_id for update;
  if not found then
    raise exception 'booking_not_found' using errcode = 'P0002';
  end if;

  if not is_partner_member((select partner_id from activities where id = v_booking.activity_id)) then
    raise exception 'not_this_partner' using errcode = '42501';
  end if;
  if v_booking.check_in is null then
    raise exception 'no_check_in' using errcode = 'P0001';
  end if;
  if (v_booking.check_in->>'code') <> p_code then
    raise exception 'wrong_code' using errcode = 'P0001';
  end if;
  -- Código eterno viraria passe livre: bastaria guardar a captura de tela.
  if (v_booking.check_in->>'expiresAt')::timestamptz < now() then
    raise exception 'code_expired' using errcode = 'P0001';
  end if;

  update bookings
     set partner_confirmed_at = now(), status = 'completed'
   where id = p_booking_id
  returning * into v_booking;

  return v_booking;
end;
$$;

-- =====================================================================
-- 20260101000004_rls.sql
-- =====================================================================

-- Row Level Security.
--
-- São dois públicos no mesmo banco: o responsável, no app, e o parceiro, no
-- painel. A regra é que **nenhum dos dois enxerga o que é do outro**, e que um
-- parceiro nunca enxerga outro parceiro. Sem RLS, um id vazado bastaria.

alter table guardians          enable row level security;
alter table children           enable row level security;
alter table partners           enable row level security;
alter table partner_members    enable row level security;
alter table activity_categories enable row level security;
alter table activities         enable row level security;
alter table class_sessions     enable row level security;
alter table subscriptions      enable row level security;
alter table bonus_grants       enable row level security;
alter table bookings           enable row level security;
alter table reviews            enable row level security;
alter table payout_rates       enable row level security;

-- Quem administra este parceiro?
create or replace function is_partner_member(p_partner_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from partner_members
     where partner_id = p_partner_id and user_id = auth.uid()
  );
$$;

-- --------------------------------------------------------------- catálogo ---
-- Catálogo é público: dá para explorar sem conta, e é assim que o app funciona
-- hoje para o visitante.

create policy catalog_read on partners            for select using (true);
create policy catalog_read on activity_categories for select using (true);
create policy catalog_read on activities          for select using (true);
create policy catalog_read on class_sessions      for select using (true);

-- Só o dono da turma mexe nela. É este policy que faz "o parceiro libera as
-- vagas" ser uma garantia do banco, e não uma promessa da interface.
create policy partner_writes_sessions on class_sessions
  for all
  using (is_partner_member((select partner_id from activities where id = activity_id)))
  with check (is_partner_member((select partner_id from activities where id = activity_id)));

create policy partner_writes_activities on activities
  for all using (is_partner_member(partner_id)) with check (is_partner_member(partner_id));

create policy partner_reads_own on partners
  for update using (is_partner_member(id)) with check (is_partner_member(id));

create policy member_reads_own on partner_members
  for select using (user_id = auth.uid());

-- ------------------------------------------------------------ responsável ---

create policy own_row on guardians
  for all using (id = auth.uid()) with check (id = auth.uid());

create policy own_children on children
  for all using (guardian_id = auth.uid()) with check (guardian_id = auth.uid());

create policy own_subscription on subscriptions
  for all using (guardian_id = auth.uid()) with check (guardian_id = auth.uid());

create policy own_bonus on bonus_grants
  for all
  using (exists (select 1 from children c where c.id = child_id and c.guardian_id = auth.uid()))
  with check (exists (select 1 from children c where c.id = child_id and c.guardian_id = auth.uid()));

-- ---------------------------------------------------------------- reserva ---
-- O responsável vê as próprias reservas. O parceiro vê as reservas das turmas
-- dele — precisa, para saber quem vem hoje e confirmar a presença.

create policy guardian_reads_bookings on bookings
  for select using (guardian_id = auth.uid());

create policy partner_reads_bookings on bookings
  for select using (is_partner_member((select partner_id from activities where id = activity_id)));

-- Ninguém escreve em `bookings` direto — nem o responsável, nem o parceiro.
-- Reservar, cancelar, fazer check-in e confirmar presença passam por funções
-- `security definer`, que travam a linha e controlam exatamente quais colunas
-- mudam. Uma policy de update aberta ao parceiro deixaria ele marcar
-- `partner_confirmed_at` sem código nenhum, e o repasse viraria autodeclaração
-- do outro lado.

-- ------------------------------------------------------------- avaliações ---

create policy reviews_public_read on reviews for select using (true);

create policy reviews_own_write on reviews
  for insert
  with check (
    guardian_id = auth.uid()
    and exists (
      select 1 from bookings b
       where b.id = booking_id
         and b.guardian_id = auth.uid()
         -- Só avalia quem foi: sem check-in não há o que avaliar.
         and b.status in ('checked_in', 'completed')
    )
  );

-- ---------------------------------------------------------------- repasse ---
-- Tabela de preço é contrato: o parceiro lê o próprio, ninguém edita pelo app.

create policy partner_reads_rate on payout_rates
  for select using (is_partner_member(partner_id));

-- ----------------------------------------------------------------- grants ---
-- RLS filtra linhas; GRANT decide se a tabela pode ser tocada. São camadas
-- diferentes, e sem a segunda o Postgres barra antes de a policy ser avaliada.
--
-- O Supabase concede isto por default privileges no schema public, mas depender
-- disso deixa a migration não reproduzível: num banco limpo o app inteiro
-- responde "permission denied", e o erro não menciona RLS em lugar nenhum.

-- Catálogo: leitura para quem nem tem conta — o app permite explorar como visitante.
grant select on partners, activity_categories, activities, class_sessions, reviews
  to anon, authenticated;

-- Dados do responsável. Quais linhas, quem decide é a policy acima.
grant select, insert, update, delete
  on guardians, children, subscriptions, bonus_grants, bookings, reviews
  to authenticated;

-- Painel do parceiro: publica turma, edita a atividade, confirma presença.
grant insert, update, delete on activities, class_sessions to authenticated;
grant update on partners to authenticated;
grant select on partner_members, payout_rates, partner_payouts to authenticated;

-- Reservar e cancelar só pelas funções: são elas que travam a vaga.
grant execute on function book_session(uuid, uuid) to authenticated;
grant execute on function cancel_booking(uuid) to authenticated;
grant execute on function is_partner_member(uuid) to anon, authenticated;
grant execute on function check_in_booking(uuid, int, boolean) to authenticated;
grant execute on function confirm_by_partner(uuid, text) to authenticated;

-- =====================================================================
-- 20260101000005_reads.sql
-- =====================================================================

-- Leituras do app e a virada da semana.
--
-- O adapter não pode montar `Activity` com N+1 nem confiar no cliente para
-- decidir preço e cota. Aqui ficam (a) as visões que já entregam os campos
-- derivados do domínio e (b) o reset semanal de coins, que até agora só existia
-- em `src/lib/subscription.ts` — ou seja, só no cliente.

-- ------------------------------------------------------------ modalidades ---
-- Lista fechada: espelha `ActivityCategoryId`. Estava só no mock, e sem ela um
-- banco novo não tem catálogo nenhum.

alter table activity_categories add column if not exists emoji text not null default '⭐';
-- A ordem é editorial (as mais procuradas primeiro), não alfabética: é assim
-- que a fila de chips aparece no Explorar.
alter table activity_categories add column if not exists sort_order smallint not null default 0;

insert into activity_categories (id, label, emoji, sort_order) values
  ('futebol','Futebol','⚽',1),   ('natacao','Natação','🏊',2), ('judo','Judô','🥋',3),
  ('danca','Dança','🩰',4),       ('ginastica','Ginástica','🤸',5), ('tenis','Tênis','🎾',6),
  ('basquete','Basquete','🏀',7), ('volei','Vôlei','🏐',8),     ('artes','Artes','🎨',9)
on conflict (id) do update set
  label = excluded.label, emoji = excluded.emoji, sort_order = excluded.sort_order;

-- ----------------------------------------------------------------- planos ---
-- A cota semanal precisa vir do servidor. Se `subscribe` recebesse
-- `coinsPerWeek` do cliente, qualquer um assinaria o Start pedindo 999 coins.

create table if not exists plans (
  id                   text primary key,
  name                 text not null,
  price_cents          integer not null check (price_cents >= 0),
  coins_per_week       smallint not null check (coins_per_week >= 0),
  activities_per_week  smallint not null,
  tagline              text not null default '',
  highlighted          boolean not null default false,
  perks                text[] not null default '{}',
  sort_order           smallint not null default 0
);

insert into plans (id, name, price_cents, coins_per_week, activities_per_week, tagline, highlighted, perks, sort_order) values
  ('start','Start', 7990,  8, 3, 'Ideal para começar', false,
   array['8 Kidoo Coins por semana','Cerca de 3 atividades semanais','Acesso a todos os parceiros','Cancelamento fácil'], 1),
  ('plus','Plus',  10990, 12, 4, 'Mais atividades e variedade', true,
   array['12 Kidoo Coins por semana','Cerca de 4 atividades semanais','Acesso a todos os parceiros','Cancelamento fácil','Suporte especializado'], 2),
  ('max','Max',    14990, 18, 6, 'Para famílias que amam explorar', false,
   array['18 Kidoo Coins por semana','Cerca de 6 atividades semanais','Ideal para mais de uma criança','Acesso a todos os parceiros','Prioridade em turmas concorridas'], 3)
on conflict (id) do update set
  name = excluded.name, price_cents = excluded.price_cents,
  coins_per_week = excluded.coins_per_week, activities_per_week = excluded.activities_per_week,
  tagline = excluded.tagline, highlighted = excluded.highlighted,
  perks = excluded.perks, sort_order = excluded.sort_order;

alter table plans enable row level security;
create policy plans_public_read on plans for select using (true);

-- ------------------------------------------------------- ciclo de coins ---

-- Segunda-feira 00:00 em Brasília, não em UTC: a promessa da tela é "a cota
-- volta ao cheio na segunda", e para quem mora aqui isso é meia-noite daqui.
-- Em UTC a virada cairia às 21h de domingo.
create or replace function week_start(p_at timestamptz)
returns timestamptz language sql stable as $$
  select date_trunc('week', p_at at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo';
$$;

-- Aplica a virada, se houver. Cota não acumula: o que sobrou da semana passada
-- é perdido, e por isso o reset escreve `coins_per_week`, não uma soma.
--
-- Isto tem de rodar no banco. Estava só no cliente, e um cliente que não
-- recarrega — ou que mente — gastaria coins da semana anterior indefinidamente.
create or replace function roll_subscription_cycle(p_guardian uuid)
returns subscriptions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sub   subscriptions%rowtype;
  v_start timestamptz := week_start(now());
begin
  select * into v_sub from subscriptions where guardian_id = p_guardian for update;
  if not found then
    return null;
  end if;

  if v_sub.cycle_started_at < v_start then
    update subscriptions
       set coins_remaining  = coins_per_week,
           cycle_started_at = v_start
     where guardian_id = p_guardian
    returning * into v_sub;
  end if;

  return v_sub;
end;
$$;

-- Leitura da assinatura já com a semana corrente aplicada.
create or replace function current_subscription()
returns subscriptions
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  return roll_subscription_cycle(auth.uid());
end;
$$;

-- Assinar um plano. O preço e a cota vêm da tabela, nunca do cliente.
create or replace function subscribe_plan(p_plan_id text)
returns subscriptions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_guardian uuid := auth.uid();
  v_plan     plans%rowtype;
  v_sub      subscriptions%rowtype;
begin
  if v_guardian is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select * into v_plan from plans where id = p_plan_id;
  if not found then
    raise exception 'plan_not_found' using errcode = 'P0002';
  end if;

  insert into subscriptions (guardian_id, plan_id, coins_per_week, coins_remaining,
                             cycle_started_at, renews_at)
  values (v_guardian, v_plan.id, v_plan.coins_per_week, v_plan.coins_per_week,
          week_start(now()), now() + interval '1 month')
  on conflict (guardian_id) do update set
    plan_id         = excluded.plan_id,
    coins_per_week  = excluded.coins_per_week,
    -- Trocar de plano no meio da semana não devolve o que já foi gasto: a cota
    -- nova entra descontada do que a família já usou.
    coins_remaining = greatest(0, least(excluded.coins_per_week,
                       excluded.coins_per_week - (subscriptions.coins_per_week - subscriptions.coins_remaining))),
    renews_at       = excluded.renews_at
  returning * into v_sub;

  return v_sub;
end;
$$;

-- ---------------------------------------------------------------- catálogo ---

-- Turmas ainda vendáveis. `slots_taken < slots_open` é comparação entre
-- colunas, que o PostgREST não expressa num filtro de query — por isso vive
-- aqui, e não no adapter.
create or replace view class_sessions_open as
select s.*, (s.slots_open - s.slots_taken) as slots_available
  from class_sessions s
 where s.slots_taken < s.slots_open
   and s.starts_at > now();

-- Atividade com os campos que o domínio deriva das turmas: o "a partir de" é o
-- menor custo entre as turmas abertas, e o próximo horário é a primeira delas.
-- Sem esta visão o app faria uma consulta de turmas por cartão da lista.
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

-- As views são `security invoker` a partir do PG 15: a RLS de quem consulta
-- continua valendo dentro delas.
alter view class_sessions_open set (security_invoker = true);
alter view activities_public   set (security_invoker = true);

grant select on plans, class_sessions_open, activities_public to anon, authenticated;
grant execute on function week_start(timestamptz) to anon, authenticated;
grant execute on function current_subscription() to authenticated;
grant execute on function subscribe_plan(text) to authenticated;

-- ------------------------------------------------------------- avaliações ---

-- O nome do autor é gravado na avaliação, e só o primeiro nome. Não dá para
-- buscá-lo por join: `guardians` é privado por RLS, então um join devolveria
-- nulo para toda avaliação alheia — exatamente as que a tela precisa mostrar.
alter table reviews add column if not exists author_name   text    not null default 'Responsável';
alter table reviews add column if not exists helpful_count integer not null default 0;

-- Só o servidor decide o nome exibido. Com insert direto, qualquer um assinaria
-- a avaliação como quiser — inclusive com o nome de outra família.
drop policy if exists reviews_own_write on reviews;
revoke insert, update, delete on reviews from authenticated;

create or replace function submit_review(p_booking_id uuid, p_rating int, p_comment text)
returns reviews
language plpgsql
security definer
set search_path = public
as $$
declare
  v_guardian uuid := auth.uid();
  v_booking  bookings%rowtype;
  v_name     text;
  v_review   reviews%rowtype;
begin
  if v_guardian is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select * into v_booking from bookings
   where id = p_booking_id and guardian_id = v_guardian;
  if not found then
    raise exception 'booking_not_found' using errcode = 'P0002';
  end if;
  -- Avalia quem foi. Sem presença não há aula para opinar sobre.
  if v_booking.status not in ('checked_in', 'completed') then
    raise exception 'review_before_check_in' using errcode = 'P0001';
  end if;
  if exists (select 1 from reviews where booking_id = p_booking_id) then
    raise exception 'already_reviewed' using errcode = 'P0001';
  end if;

  select split_part(name, ' ', 1) into v_name from guardians where id = v_guardian;

  insert into reviews (booking_id, activity_id, guardian_id, author_name, rating, comment)
  values (p_booking_id, v_booking.activity_id, v_guardian, coalesce(v_name, 'Responsável'),
          greatest(1, least(5, p_rating)), btrim(coalesce(p_comment, '')))
  returning * into v_review;

  -- A nota do cartão passa a sair das avaliações reais, não de um número solto.
  update activities a
     set rating = coalesce(agg.avg_rating, 0), review_count = agg.total
    from (select round(avg(rating)::numeric, 1) as avg_rating, count(*) as total
            from reviews where activity_id = v_booking.activity_id) agg
   where a.id = v_booking.activity_id;

  return v_review;
end;
$$;

grant execute on function submit_review(uuid, int, text) to authenticated;

-- ------------------------------------------------------------ novo perfil ---

-- O perfil do responsável nasce junto com a conta. Deixar isso a cargo do
-- cliente abre a janela em que o app cai depois do cadastro e a pessoa fica com
-- login válido e nenhum perfil — sem conseguir nem criar um, porque a policy
-- compara com uma linha que não existe.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into guardians (id, name, email)
  values (
    new.id,
    coalesce(nullif(btrim(new.raw_user_meta_data->>'name'), ''), split_part(new.email, '@', 1)),
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- --------------------------------------------------------------- check-in ---

-- Haversine em SQL puro. Não vale trazer PostGIS para calcular uma distância
-- entre dois pontos; e ela precisa existir no servidor, porque quem mede não
-- pode ser quem tem interesse no resultado.
create or replace function distance_m(
  lat1 double precision, lon1 double precision,
  lat2 double precision, lon2 double precision
)
returns double precision language sql immutable as $$
  select 2 * 6371000 * asin(least(1, sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2)
    + cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lon2 - lon1) / 2), 2)
  )));
$$;

-- Check-in do app.
--
-- Recebe a **leitura crua** do aparelho, não uma distância já pronta: uma
-- distância vinda do cliente é autodeclaração, e "estou a 10 m" seria só um
-- número que qualquer um edita. A coordenada entra no cálculo e vai embora —
-- o que fica gravado é a distância, nunca onde a família estava.
--
-- Devolve também o XP creditado e o nível novo. Deduzir isso no cliente
-- exigiria ler a criança antes e depois e torcer para nada mudar no meio.
create or replace function check_in(
  p_booking_id  uuid,
  p_latitude    double precision default null,
  p_longitude   double precision default null,
  p_accuracy_m  double precision default null,
  p_mocked      boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status      booking_status;
  v_xp_before   int;
  v_lat         double precision;
  v_lon         double precision;
  v_real_m      double precision := null;
  v_effective_m int := null;
  v_booking     bookings%rowtype;
  v_lvl_before  int;
  v_lvl_after   int;
  v_bonus       int := 0;
  v_lvl         int;
  v_earned      int := 0;
  v_level_up    jsonb := null;
begin
  select b.status, c.xp, p.latitude, p.longitude
    into v_status, v_xp_before, v_lat, v_lon
    from bookings b
    join children c   on c.id = b.child_id
    join activities a on a.id = b.activity_id
    join partners p   on p.id = a.partner_id
   where b.id = p_booking_id and b.guardian_id = auth.uid();
  if not found then
    raise exception 'booking_not_found' using errcode = 'P0002';
  end if;

  if p_latitude is not null and p_longitude is not null then
    v_real_m := distance_m(p_latitude, p_longitude, v_lat, v_lon);
    -- A margem de erro do aparelho conta a favor de quem está chegando, igual a
    -- `proximityTo` no cliente: "300 m, ±120 m" pode ser em cima do local.
    v_effective_m := round(greatest(0, v_real_m - greatest(0, coalesce(p_accuracy_m, 0))));
  end if;

  v_booking := check_in_booking(p_booking_id, v_effective_m, p_mocked);

  -- Para auditoria vale a distância medida, não a descontada: é ela que conta a
  -- história de um check-in feito de 12 km.
  -- Só na primeira entrada: reemitir o código não pode reescrever a prova do
  -- check-in original, que é o registro de auditoria daquela chegada.
  if v_status <> 'checked_in' and v_real_m is not null and v_booking.check_in_proof is not null then
    update bookings
       set check_in_proof = v_booking.check_in_proof || jsonb_build_object('distanceM', round(v_real_m))
     where id = p_booking_id
    returning * into v_booking;
  end if;

  -- Repetir o check-in só reemite o código. Nada de XP em dobro.
  if v_status <> 'checked_in' then
    v_earned     := 100;
    v_lvl_before := level_from_xp(v_xp_before);
    v_lvl_after  := level_from_xp(v_xp_before + v_earned);

    if v_lvl_after > v_lvl_before then
      for v_lvl in (v_lvl_before + 1)..v_lvl_after loop
        v_bonus := v_bonus + bonus_for_level(v_lvl);
      end loop;
      v_level_up := jsonb_build_object('from', v_lvl_before, 'to', v_lvl_after,
                                       'bonusEarned', v_bonus);
    end if;
  end if;

  return jsonb_build_object('booking', to_jsonb(v_booking),
                            'xpEarned', v_earned, 'levelUp', v_level_up);
end;
$$;

grant execute on function distance_m(double precision, double precision, double precision, double precision)
  to anon, authenticated;
grant execute on function check_in(uuid, double precision, double precision, double precision, boolean)
  to authenticated;

-- =====================================================================
-- 20260101000006_partner.sql
-- =====================================================================

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

-- =====================================================================
-- 20260101000007_xp_on_confirm.sql
-- =====================================================================

-- O XP passa a vir da confirmação do parceiro, não do check-in.
--
-- Como estava: `check_in_booking` creditava 100 de XP, e o portão de distância
-- deixa passar quem não tem leitura de GPS ("negamos com prova contra, nunca
-- por falta de prova"). Juntos, os dois formavam um caminho: negar a permissão
-- de localização e fazer check-in de qualquer lugar rendia XP; repetindo, subia
-- de nível; subindo de nível, ganhava Kidoo Bônus; com bônus, aula de graça.
--
-- O código de seis dígitos já fechava a fraude do lado do dinheiro — sem o
-- parceiro ler o código não há repasse, e para ler ele precisa estar na frente
-- da criança. Faltava o XP passar pelo mesmo portão.
--
-- Agora passa: quem diz que a criança veio é quem a recebeu.

-- O que a confirmação rendeu, guardado na reserva. Sem isto, a família nunca
-- veria a comemoração: ela acontece do outro lado do balcão, no painel, e o
-- app só descobre depois — precisa achar o resultado em algum lugar.
alter table bookings add column if not exists reward jsonb;

-- ------------------------------------------------------- check-in sem XP ---

create or replace function check_in_booking(
  p_booking_id uuid,
  p_distance_m int default null,
  p_mocked boolean default false
)
returns bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_guardian uuid := auth.uid();
  v_booking  bookings%rowtype;
  v_ticket   jsonb;
begin
  select * into v_booking from bookings
   where id = p_booking_id and guardian_id = v_guardian
     for update;
  if not found then
    raise exception 'booking_not_found' using errcode = 'P0002';
  end if;
  if v_booking.status = 'cancelled' then
    raise exception 'booking_cancelled' using errcode = 'P0001';
  end if;
  if v_booking.status = 'completed' then
    raise exception 'already_confirmed' using errcode = 'P0001';
  end if;

  -- Janela de horário: estar no local três horas antes não é chegar.
  if now() < v_booking.scheduled_at - interval '45 minutes' then
    raise exception 'check_in_too_early' using errcode = 'P0001';
  end if;
  if now() > v_booking.scheduled_at + interval '90 minutes' then
    raise exception 'check_in_too_late' using errcode = 'P0001';
  end if;

  -- Distância é recalculada pelo servidor a partir da coordenada do parceiro.
  -- Continuamos negando só com prova contra: sem leitura o check-in segue,
  -- marcado como não verificado. O que mudou é que isso não rende mais nada
  -- sozinho — o XP agora depende da confirmação de quem recebeu a criança.
  if p_distance_m is not null and not p_mocked and p_distance_m > 250 then
    raise exception 'too_far_from_venue' using errcode = 'P0001';
  end if;

  v_ticket := jsonb_build_object(
    'code', generate_check_in_code(),
    'issuedAt', now(),
    'expiresAt', now() + interval '30 minutes'
  );

  -- Repetir o check-in só reemite o código.
  if v_booking.status = 'checked_in' then
    update bookings set check_in = v_ticket where id = p_booking_id
    returning * into v_booking;
    return v_booking;
  end if;

  update bookings
     set status = 'checked_in',
         checked_in_at = now(),
         check_in = v_ticket,
         check_in_proof = jsonb_build_object(
           'locationVerified', p_distance_m is not null and not p_mocked,
           'distanceM', p_distance_m,
           'mocked', p_mocked
         )
   where id = p_booking_id
  returning * into v_booking;

  return v_booking;
end;
$$;

-- --------------------------------------------- confirmação, agora com XP ---

create or replace function confirm_by_partner(p_booking_id uuid, p_code text)
returns bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking    bookings%rowtype;
  v_child      children%rowtype;
  v_lvl_before int;
  v_lvl_after  int;
  v_bonus      int := 0;
  v_lvl        int;
  v_level_up   jsonb := null;
begin
  select * into v_booking from bookings where id = p_booking_id for update;
  if not found then
    raise exception 'booking_not_found' using errcode = 'P0002';
  end if;

  if not is_partner_member((select partner_id from activities where id = v_booking.activity_id)) then
    raise exception 'not_this_partner' using errcode = '42501';
  end if;
  -- Anular `check_in` na confirmação já barra a segunda tentativa (ela cai em
  -- `no_check_in`). Esta guarda é reforço, e existe pelo erro: "já confirmada"
  -- diz a verdade a quem está no balcão; "sem check-in" mandaria o parceiro
  -- procurar um problema que não existe.
  if v_booking.partner_confirmed_at is not null then
    raise exception 'already_confirmed' using errcode = 'P0001';
  end if;
  if v_booking.check_in is null then
    raise exception 'no_check_in' using errcode = 'P0001';
  end if;
  if (v_booking.check_in->>'code') <> p_code then
    raise exception 'wrong_code' using errcode = 'P0001';
  end if;
  -- Código eterno viraria passe livre: bastaria guardar a captura de tela.
  if (v_booking.check_in->>'expiresAt')::timestamptz < now() then
    raise exception 'code_expired' using errcode = 'P0001';
  end if;

  select * into v_child from children where id = v_booking.child_id for update;
  v_lvl_before := level_from_xp(v_child.xp);
  v_lvl_after  := level_from_xp(v_child.xp + 100);

  update children set xp = xp + 100 where id = v_child.id;

  -- Subir de nível gera Kidoo Bônus, com validade de 30 dias.
  if v_lvl_after > v_lvl_before then
    for v_lvl in (v_lvl_before + 1)..v_lvl_after loop
      v_bonus := v_bonus + bonus_for_level(v_lvl);
    end loop;
    if v_bonus > 0 then
      insert into bonus_grants (child_id, amount, remaining, level, expires_at)
      values (v_child.id, v_bonus, v_bonus, v_lvl_after, now() + interval '30 days');
    end if;
    v_level_up := jsonb_build_object('from', v_lvl_before, 'to', v_lvl_after,
                                     'bonusEarned', v_bonus);
  end if;

  update bookings
     set partner_confirmed_at = now(),
         status = 'completed',
         -- O código morre ao ser usado: não vale para uma segunda aula.
         check_in = null,
         reward = jsonb_build_object('xpEarned', 100, 'levelUp', v_level_up)
   where id = p_booking_id
  returning * into v_booking;

  return v_booking;
end;
$$;

-- ------------------------------------------------ o wrapper do app muda ---

-- `check_in` não tem mais XP para relatar: ele devolve a reserva e o aviso de
-- quanto entra depois. A comemoração migrou para quando a confirmação chega.
create or replace function check_in(
  p_booking_id  uuid,
  p_latitude    double precision default null,
  p_longitude   double precision default null,
  p_accuracy_m  double precision default null,
  p_mocked      boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status      booking_status;
  v_lat         double precision;
  v_lon         double precision;
  v_real_m      double precision := null;
  v_effective_m int := null;
  v_booking     bookings%rowtype;
begin
  select b.status, p.latitude, p.longitude
    into v_status, v_lat, v_lon
    from bookings b
    join activities a on a.id = b.activity_id
    join partners p   on p.id = a.partner_id
   where b.id = p_booking_id and b.guardian_id = auth.uid();
  if not found then
    raise exception 'booking_not_found' using errcode = 'P0002';
  end if;

  if p_latitude is not null and p_longitude is not null then
    v_real_m := distance_m(p_latitude, p_longitude, v_lat, v_lon);
    -- A margem de erro do aparelho conta a favor de quem está chegando.
    v_effective_m := round(greatest(0, v_real_m - greatest(0, coalesce(p_accuracy_m, 0))));
  end if;

  v_booking := check_in_booking(p_booking_id, v_effective_m, p_mocked);

  -- Para auditoria vale a distância medida, não a descontada. Só na primeira
  -- entrada: reemitir o código não reescreve a prova do check-in original.
  if v_status <> 'checked_in' and v_real_m is not null and v_booking.check_in_proof is not null then
    update bookings
       set check_in_proof = v_booking.check_in_proof || jsonb_build_object('distanceM', round(v_real_m))
     where id = p_booking_id
    returning * into v_booking;
  end if;

  return jsonb_build_object('booking', to_jsonb(v_booking), 'xpOnConfirm', 100);
end;
$$;

-- =====================================================================
-- 20260101000008_already_booked.sql
-- =====================================================================

-- Uma criança não reserva duas vezes a mesma turma.
--
-- A regra já existia no índice parcial `one_seat_per_child`, criado junto com a
-- tabela. O que faltava era falhar de um jeito legível: o PostgREST devolvia
-- `duplicate key value violates unique constraint`, o app caía no texto
-- genérico de erro desconhecido, e a família via "algo deu errado por aqui"
-- depois de tocar em Confirmar numa turma em que a criança já estava.

create or replace function book_session(p_session_id uuid, p_child_id uuid)
returns bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_guardian  uuid := auth.uid();
  v_session   class_sessions%rowtype;
  v_activity  activities%rowtype;
  v_booking   bookings%rowtype;
  v_sub       subscriptions%rowtype;
  v_from_bonus int;
  v_from_sub   int;
begin
  if v_guardian is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  -- A criança é de quem está reservando? Sem isto, um id vazado permitiria
  -- reservar no nome de criança alheia.
  if not exists (
    select 1 from children
     where id = p_child_id and guardian_id = v_guardian
  ) then
    raise exception 'child_not_found' using errcode = 'P0002';
  end if;

  -- `for update` serializa quem chegar junto: o segundo só lê depois que o
  -- primeiro comitar, e aí enxerga o slots_taken já incrementado.
  select * into v_session
    from class_sessions
   where id = p_session_id
     for update;

  if not found then
    raise exception 'session_not_found' using errcode = 'P0002';
  end if;
  if v_session.starts_at <= now() then
    raise exception 'session_already_started' using errcode = 'P0001';
  end if;
  -- Antes de olhar lotação: se esta criança já tem lugar nesta turma, o
  -- problema não é vaga. Responder 'turma cheia' a quem já está dentro seria
  -- mentira, e mandaria a família procurar outro horário sem necessidade.
  --
  -- Não substitui o índice `one_seat_per_child`, que continua sendo a garantia
  -- contra dois toques simultâneos: entre este `exists` e o `insert` ainda cabe
  -- uma segunda transação. Esta checagem existe para o caso comum — a pessoa
  -- tocou de novo — falhar com uma frase que dá para ler, em vez do
  -- `duplicate key value violates unique constraint` que o app não traduz.
  if exists (
    select 1 from bookings
     where session_id = p_session_id
       and child_id   = p_child_id
       and status <> 'cancelled'
  ) then
    raise exception 'already_booked' using errcode = 'P0001';
  end if;

  if v_session.slots_taken >= v_session.slots_open then
    raise exception 'session_full' using errcode = 'P0001';
  end if;

  select * into v_activity from activities where id = v_session.activity_id;

  -- O bônus entra antes da cota da assinatura porque ele expira; a cota volta
  -- ao cheio toda semana de qualquer jeito.
  v_from_bonus := least(bonus_balance(p_child_id), v_session.coin_cost);
  v_from_sub   := v_session.coin_cost - v_from_bonus;

  if v_from_sub > 0 then
    -- Aplica a virada de semana ANTES de olhar o saldo: uma reserva feita na
    -- segunda tem de usar a cota nova, e quem decide isso é o banco. Confiar no
    -- cliente para resetar deixaria um app que não recarrega gastando a cota da
    -- semana passada para sempre. (`roll_subscription_cycle` vive na migration
    -- 000005; plpgsql resolve o nome na chamada, não na criação.)
    v_sub := roll_subscription_cycle(v_guardian);
    if v_sub.guardian_id is null then
      raise exception 'no_subscription' using errcode = 'P0001';
    end if;
    if v_sub.coins_remaining < v_from_sub then
      raise exception 'insufficient_coins' using errcode = 'P0001';
    end if;
    update subscriptions
       set coins_remaining = coins_remaining - v_from_sub
     where guardian_id = v_guardian;
  end if;

  if v_from_bonus > 0 then
    perform consume_bonus(p_child_id, v_from_bonus);
  end if;

  update class_sessions
     set slots_taken = slots_taken + 1
   where id = p_session_id;

  insert into bookings (
    guardian_id, child_id, session_id, activity_id,
    scheduled_at, coin_cost, slot_kind, payment
  ) values (
    v_guardian, p_child_id, v_session.id, v_activity.id,
    v_session.starts_at, v_session.coin_cost, v_session.kind,
    jsonb_build_object('fromBonus', v_from_bonus, 'fromSubscription', v_from_sub,
                       'total', v_session.coin_cost)
  )
  returning * into v_booking;

  return v_booking;
end;
$$;

-- =====================================================================
-- 20260101000009_waitlist.sql
-- =====================================================================

-- Fila de espera: "me avise quando abrir vaga".
--
-- Duas coisas precisavam existir antes da funcionalidade:
--
-- 1. A turma lotada precisa ser VISÍVEL. `class_sessions_open` filtra
--    `slots_taken < slots_open`, então o app nunca soube que a turma cheia
--    existe — não dá para pedir aviso de algo que a tela não mostra.
-- 2. O aviso precisa de um lugar para esperar. A entrega (push) acontece fora
--    do banco, e uma chamada HTTP dentro da transação de `cancel_booking`
--    seguraria o lock da turma pelo tempo da rede. Daí a caixa de saída.

-- ---------------------------------------------------------------- visão ----
-- A view antiga continua existindo e continua significando "dá para reservar":
-- é dela que `activities_public` tira o "a partir de" e o próximo horário, e
-- anunciar no cartão uma turma que já encheu seria pior do que não anunciar.
create or replace view class_sessions_visible as
select s.*, greatest(0, s.slots_open - s.slots_taken) as slots_available
  from class_sessions s
 where s.starts_at > now();

alter view class_sessions_visible set (security_invoker = true);
grant select on class_sessions_visible to anon, authenticated;

-- ------------------------------------------------------------- a espera ----
create table if not exists session_waitlist (
  session_id  uuid not null references class_sessions (id) on delete cascade,
  child_id    uuid not null references children (id) on delete cascade,
  guardian_id uuid not null references guardians (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (session_id, child_id)
);

create index if not exists waitlist_guardian_idx on session_waitlist (guardian_id);

alter table session_waitlist enable row level security;

-- A família só enxerga e mexe na própria espera. A contagem de quantos estão
-- esperando é do parceiro, e sai por função, não por leitura da tabela: saber
-- que são sete não pode virar saber quem são as sete.
drop policy if exists waitlist_own on session_waitlist;
create policy waitlist_own on session_waitlist
  for all to authenticated
  using (guardian_id = auth.uid())
  with check (guardian_id = auth.uid());

-- --------------------------------------------------------- caixa de saída --
-- O aviso fica aqui até alguém entregar. Escrever numa tabela é instantâneo e
-- não pode falhar por rede; entregar é um segundo passo, que pode tentar de
-- novo sem desfazer nada do que já aconteceu na turma.
create table if not exists push_outbox (
  id          uuid primary key default gen_random_uuid(),
  guardian_id uuid not null references guardians (id) on delete cascade,
  title       text not null,
  body        text not null,
  data        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  sent_at     timestamptz,
  error       text
);

create index if not exists push_outbox_pendentes on push_outbox (created_at)
  where sent_at is null;

alter table push_outbox enable row level security;
-- Ninguém lê pelo PostgREST: quem entrega usa a chave de serviço, que ignora
-- RLS. Sem policy nenhuma, a tabela fica fechada para app e painel.

-- ------------------------------------------------------------- aparelhos ---
create table if not exists push_tokens (
  token      text primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  platform   text not null check (platform in ('ios','android','web')),
  updated_at timestamptz not null default now()
);

create index if not exists push_tokens_user_idx on push_tokens (user_id);

alter table push_tokens enable row level security;

drop policy if exists push_tokens_own on push_tokens;
create policy push_tokens_own on push_tokens
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ------------------------------------------------------------- entrar/sair -
create or replace function join_waitlist(p_session_id uuid, p_child_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_guardian uuid := auth.uid();
  v_session  class_sessions%rowtype;
begin
  if v_guardian is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if not exists (
    select 1 from children where id = p_child_id and guardian_id = v_guardian
  ) then
    raise exception 'child_not_found' using errcode = 'P0002';
  end if;

  select * into v_session from class_sessions where id = p_session_id;
  if not found then
    raise exception 'session_not_found' using errcode = 'P0002';
  end if;
  if v_session.starts_at <= now() then
    raise exception 'session_already_started' using errcode = 'P0001';
  end if;

  -- Esperar por uma turma que já é sua não faz sentido, e o aviso chegaria
  -- para quem já tem o lugar.
  if exists (
    select 1 from bookings
     where session_id = p_session_id and child_id = p_child_id and status <> 'cancelled'
  ) then
    raise exception 'already_booked' using errcode = 'P0001';
  end if;

  -- Turma com vaga não precisa de fila: é só reservar. Entrar na espera aqui
  -- deixaria a família aguardando um aviso que nunca vem, porque o gatilho só
  -- dispara na transição de cheia para com-vaga.
  if v_session.slots_taken < v_session.slots_open then
    raise exception 'session_has_room' using errcode = 'P0001';
  end if;

  insert into session_waitlist (session_id, child_id, guardian_id)
  values (p_session_id, p_child_id, v_guardian)
  on conflict (session_id, child_id) do nothing;
end;
$$;

create or replace function leave_waitlist(p_session_id uuid, p_child_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  delete from session_waitlist
   where session_id = p_session_id
     and child_id   = p_child_id
     and guardian_id = auth.uid();
end;
$$;

-- Em quais turmas esta família está esperando. Uma consulta só, porque a tela
-- da atividade precisa marcar várias turmas de uma vez.
create or replace function my_waitlist()
returns table (session_id uuid, child_id uuid, created_at timestamptz)
language sql
security definer
set search_path = public
as $$
  select w.session_id, w.child_id, w.created_at
    from session_waitlist w
   where w.guardian_id = auth.uid();
$$;

grant execute on function join_waitlist(uuid, uuid)  to authenticated;
grant execute on function leave_waitlist(uuid, uuid) to authenticated;
grant execute on function my_waitlist()              to authenticated;

-- ------------------------------------------------------- o aviso, enfileirado
alter table session_waitlist add column if not exists notified_at timestamptz;

-- Quem reservou não espera mais. Vale para a família que veio pelo aviso e
-- para a que estava na fila e conseguiu a vaga por outro caminho.
create or replace function drop_waitlist_on_booking()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from session_waitlist
   where session_id = new.session_id and child_id = new.child_id;
  return new;
end;
$$;

drop trigger if exists bookings_leave_waitlist on bookings;
create trigger bookings_leave_waitlist
  after insert on bookings
  for each row execute function drop_waitlist_on_booking();

/**
 * Vaga abriu: enfileira um aviso para cada família que estava esperando.
 *
 * Dispara na *transição* — de sem vaga para com vaga — e não a cada update.
 * Sem isso, cada reserva feita numa turma que ainda tem lugar mandaria aviso
 * para a fila inteira.
 *
 * `notified_at` volta a nulo quando a turma enche de novo, então a mesma
 * família é avisada uma vez por abertura, e não uma vez na vida: se a vaga
 * abrir na terça e ela não pegar, ela merece saber quando abrir de novo.
 */
create or replace function notify_waitlist_on_opening()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_antes  int := old.slots_open - old.slots_taken;
  v_depois int := new.slots_open - new.slots_taken;
  v_titulo text;
begin
  if new.starts_at <= now() then
    return new;
  end if;

  -- Encheu de novo: rearma o aviso para a próxima abertura.
  if v_antes > 0 and v_depois <= 0 then
    update session_waitlist set notified_at = null where session_id = new.id;
    return new;
  end if;

  if not (v_antes <= 0 and v_depois > 0) then
    return new;
  end if;

  select 'Vagou um lugar em ' || a.title into v_titulo
    from activities a where a.id = new.activity_id;

  insert into push_outbox (guardian_id, title, body, data)
  select w.guardian_id,
         coalesce(v_titulo, 'Vagou um lugar'),
         to_char(new.starts_at at time zone 'America/Sao_Paulo', 'DD/MM às HH24:MI')
           || ' — corre que é por ordem de chegada.',
         jsonb_build_object('sessionId', new.id, 'activityId', new.activity_id,
                            'childId', w.child_id)
    from session_waitlist w
   where w.session_id = new.id
     and w.notified_at is null;

  update session_waitlist
     set notified_at = now()
   where session_id = new.id and notified_at is null;

  return new;
end;
$$;

drop trigger if exists class_sessions_notify_waitlist on class_sessions;
create trigger class_sessions_notify_waitlist
  after update of slots_open, slots_taken on class_sessions
  for each row execute function notify_waitlist_on_opening();

-- ------------------------------------------------------------- aparelho ----
create or replace function register_push_token(p_token text, p_platform text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  -- O token é do aparelho, não da pessoa: quando duas contas usam o mesmo
  -- celular, o dono do token passa a ser quem entrou por último. Sem o
  -- `do update`, o aviso continuaria indo para a conta anterior.
  insert into push_tokens (token, user_id, platform, updated_at)
  values (p_token, auth.uid(), p_platform, now())
  on conflict (token) do update
    set user_id = excluded.user_id, platform = excluded.platform, updated_at = now();
end;
$$;

create or replace function forget_push_token(p_token text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from push_tokens where token = p_token and user_id = auth.uid();
end;
$$;

grant execute on function register_push_token(text, text) to authenticated;
grant execute on function forget_push_token(text)         to authenticated;

-- =====================================================================
-- 20260101000010_roster_local.sql
-- =====================================================================

-- O parceiro passa a ver se a chegada teve localização conferida.
--
-- Quem decide o repasse é ele: `partner_payouts` só conta reserva com
-- `partner_confirmed_at`. Mas até aqui ele digitava os seis dígitos sem saber
-- que aquele check-in podia ter vindo de 12 km — `session_roster` devolvia
-- nome, idade, status e se havia código, e nada sobre localização.
--
-- Nos cinco primeiros check-ins reais, cinco vieram sem coordenada nenhuma. A
-- regra do banco libera nesse caso de propósito (negamos com prova contra,
-- nunca por falta de prova, senão uma quadra coberta sem sinal travaria a
-- família na porta). O preço dessa escolha é que a única pessoa capaz de
-- perceber "essa criança não está aqui" precisa da informação — e é ela que
-- está no balcão, olhando para a criança.
--
-- Não é bloqueio nem acusação: é um dado a mais para quem já decide.

-- O Postgres não deixa trocar o tipo de retorno com `create or replace`, e a
-- coluna nova muda a assinatura: é preciso derrubar antes.
drop function if exists session_roster(uuid);

create function session_roster(p_session_id uuid)
returns table (
  booking_id           uuid,
  child_first_name     text,
  child_age            int,
  status               booking_status,
  checked_in_at        timestamptz,
  partner_confirmed_at timestamptz,
  slot_kind            slot_kind,
  has_code             boolean,
  location_verified    boolean
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
         b.check_in is not null,
         -- Três estados, e o nulo importa: `true` conferida, `false` o app
         -- tentou e não bateu ou não teve leitura, `null` ainda não houve
         -- check-in. Colapsar os dois últimos marcaria de suspeita toda
         -- criança que ainda não chegou.
         case
           when b.check_in_proof is null then null
           else coalesce((b.check_in_proof->>'locationVerified')::boolean, false)
         end
    from bookings b
    join children c   on c.id = b.child_id
    join activities a on a.id = b.activity_id
   where b.session_id = p_session_id
     and b.status <> 'cancelled'
     and is_partner_member(a.partner_id)
   order by c.name;
$$;

-- O `drop` levou o grant junto, então ele volta aqui.
--
-- Sendo honesto sobre o que esta linha faz: o Postgres já concede `execute` a
-- `PUBLIC` por padrão numa função nova, então sem ela o painel continuaria
-- funcionando. Ela existe para o privilégio ficar declarado, como está em
-- `partner_agenda` e nas demais — e para que uma futura revogação do `PUBLIC`
-- não derrube esta função junto, em silêncio.
--
-- A função é `security definer` e filtra por `is_partner_member(auth.uid())`:
-- quem chama sem ser do parceiro recebe zero linhas, não um erro.
grant execute on function session_roster(uuid) to authenticated;

commit;

-- Se chegou até aqui sem erro, o banco está pronto.
-- Próximo passo: `supabase/setup/02-primeiro-parceiro.sql`.
