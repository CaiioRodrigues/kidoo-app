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
