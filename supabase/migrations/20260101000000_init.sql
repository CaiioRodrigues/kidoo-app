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
