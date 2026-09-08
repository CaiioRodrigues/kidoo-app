-- =====================================================================
-- Kidoo — atualizar um banco que JÁ EXISTE.
--
-- O `01-banco.sql` é para a primeira subida e não pode ser rodado de novo:
-- ele tem `create table` sem `if not exists`, e a segunda execução falha na
-- primeira tabela. Este arquivo é o complemento — só o que veio depois.
--
-- Tudo aqui é idempotente (`create or replace`, `if not exists`,
-- `drop ... if exists`). Rodar duas vezes não faz mal, e por isso ele inclui
-- também migrations que talvez você já tenha aplicado: é melhor repetir do que
-- descobrir mais tarde que faltava uma.
--
-- Cole INTEIRO no SQL Editor do Supabase e clique em Run.
--
-- O que entra:
--   000007  o XP entra na confirmação do parceiro, não no check-in
--   000008  a mesma criança não reserva duas vezes a mesma turma
--   000009  fila de espera, caixa de saída de avisos e tokens de push
--   000010  o parceiro vê se a chegada teve localização conferida
--   000011  buckets do Storage: fotos de criança (privado) e de atividade
--   000012  publicar a mesma turma em várias datas (turma que se repete)
--
-- Sem a 000009 o app não lista turma nenhuma: ele lê os horários da visão
-- `class_sessions_visible`, que nasce ali.
-- =====================================================================

begin;


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

-- =====================================================================
-- 20260101000011_storage.sql
-- =====================================================================

-- Onde as fotos ficam.
--
-- Até aqui não havia lugar nenhum: a foto da criança era gravada como
-- `file:///data/user/0/...`, o caminho do arquivo dentro do aparelho que a
-- escolheu. Funcionava naquele celular, até a primeira limpeza de cache, e em
-- nenhum outro lugar do mundo — nem no aparelho da mãe, nem depois de
-- reinstalar. A imagem da atividade nem isso: era uma foto do Unsplash fixa
-- por modalidade, igual para toda escolinha de futebol do país.
--
-- Dois buckets, e a diferença entre eles é o ponto:
--
--   `atividades`  PÚBLICO. É a vitrine do parceiro, vista por qualquer
--                 família que abrir o app. Fosse privado, cada cartão da
--                 lista precisaria de uma URL assinada — dezenas de idas ao
--                 servidor para montar uma tela de catálogo.
--
--   `criancas`    PRIVADO, sem exceção. É foto de criança. Só sai por URL
--                 assinada, com validade curta, para quem é responsável por
--                 ela. Um bucket público aqui seria um diretório de fotos de
--                 crianças aberto na internet — e o custo de assinar é
--                 irrelevante: uma família tem duas, três crianças.
--
-- O schema `storage` só existe dentro do Supabase. O Postgres local dos
-- testes não o tem, e este arquivo precisa passar nos dois — daí a guarda.

do $$
begin
  if to_regclass('storage.objects') is null then
    raise notice 'sem schema storage (Postgres local): pulando buckets e policies';
    return;
  end if;

  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('atividades', 'atividades', true, 5242880,
          array['image/jpeg','image/png','image/webp'])
  on conflict (id) do update
    set public = excluded.public,
        file_size_limit = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;

  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('criancas', 'criancas', false, 5242880,
          array['image/jpeg','image/png','image/webp'])
  on conflict (id) do update
    set public = excluded.public,
        file_size_limit = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;

  -- ---------------------------------------------------------- atividades --
  -- Qualquer um lê (é vitrine). Escrever é do parceiro dono, e o caminho
  -- carrega o id dele: `atividades/<partner_id>/<activity_id>.jpg`. Sem o id
  -- no caminho, a policy não teria como saber de quem é o arquivo — e um
  -- parceiro poderia sobrescrever a foto do outro.
  drop policy if exists atividades_leitura on storage.objects;
  create policy atividades_leitura on storage.objects
    for select to anon, authenticated
    using (bucket_id = 'atividades');

  drop policy if exists atividades_escrita on storage.objects;
  create policy atividades_escrita on storage.objects
    for all to authenticated
    using (
      bucket_id = 'atividades'
      and is_partner_member(((storage.foldername(name))[1])::uuid)
    )
    with check (
      bucket_id = 'atividades'
      and is_partner_member(((storage.foldername(name))[1])::uuid)
    );

  -- ------------------------------------------------------------ crianças --
  -- Caminho: `criancas/<guardian_id>/<child_id>.jpg`. O responsável é a
  -- primeira pasta, e é só ela que a policy precisa comparar — nada de
  -- consultar `children`, que traria a RLS daquela tabela para dentro desta
  -- e tornaria a regra dependente de duas coisas em vez de uma.
  drop policy if exists criancas_do_responsavel on storage.objects;
  create policy criancas_do_responsavel on storage.objects
    for all to authenticated
    using (
      bucket_id = 'criancas'
      and (storage.foldername(name))[1] = auth.uid()::text
    )
    with check (
      bucket_id = 'criancas'
      and (storage.foldername(name))[1] = auth.uid()::text
    );

  raise notice 'buckets atividades (público) e criancas (privado) prontos';
end $$;


-- =====================================================================
-- 20260101000012_recurring.sql
-- =====================================================================

-- Publicar a mesma turma várias semanas de uma vez.
--
-- O parceiro real não tem "uma turma": ele tem terça e quinta às 18h, o ano
-- inteiro. Com `publish_session` uma a uma, abrir dois meses de agenda são
-- dezesseis idas ao formulário — e é por isso que a agenda de um parceiro de
-- verdade ficaria vazia depois da primeira semana.
--
-- **A recorrência não vira um conceito no banco.** Não há tabela de regra nem
-- `series_id`: o que se grava são turmas comuns, iguais às publicadas uma a
-- uma. É uma decisão, não uma economia: uma regra de recorrência só ganha da
-- lista de datas quando alguém quiser editar "todas as terças de uma vez", e
-- até lá ela cobraria o preço de manter turma gerada e turma real em dois
-- estados diferentes (o que acontece com a turma de terça que a família já
-- reservou quando a regra muda?). O dia em que "editar a série" for pedido,
-- este caminho continua válido — as turmas já existem.
--
-- **As datas vêm prontas do navegador**, e isso também é decisão. "Toda terça
-- às 18h" é 18h no relógio de quem está em Belo Horizonte; calcular aqui
-- exigiria carregar o fuso do parceiro e reproduzir o horário de verão de
-- cada país. O navegador dele já sabe disso. O banco recebe instantes.
create or replace function publish_sessions(
  p_activity_id uuid,
  p_starts_at   timestamptz[],
  p_capacity    int,
  p_enrolled    int,
  p_slots_open  int,
  p_coin_cost   int
)
returns table (
  quando     timestamptz,
  session_id uuid,
  -- null = publicada agora. Senão, o motivo de ter sido pulada.
  pulada     text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quando timestamptz;
  v_id     uuid;
begin
  if not is_partner_member((select partner_id from activities where id = p_activity_id)) then
    raise exception 'not_this_partner' using errcode = '42501';
  end if;
  if p_enrolled + p_slots_open > p_capacity then
    raise exception 'over_capacity' using errcode = 'P0001';
  end if;
  if coalesce(array_length(p_starts_at, 1), 0) = 0 then
    raise exception 'no_dates' using errcode = 'P0001';
  end if;
  -- Teto: isto é conveniência de balcão, não importação em massa. Sem ele, um
  -- laço na tela pediria dez mil turmas e o parceiro descobriria depois.
  if array_length(p_starts_at, 1) > 60 then
    raise exception 'too_many_dates' using errcode = 'P0001';
  end if;

  foreach v_quando in array p_starts_at loop
    -- Uma data no passado não derruba as outras. Quem publica "as próximas 8
    -- semanas" numa quinta à noite tem a quinta de hoje na lista, e perder as
    -- outras sete por causa dela seria pior do que pular.
    if v_quando <= now() then
      quando := v_quando; session_id := null; pulada := 'no_passado';
      return next;
      continue;
    end if;

    -- Republicar as mesmas semanas é o engano mais fácil de cometer aqui, e
    -- ele dobraria a agenda em silêncio: duas turmas idênticas, cada uma com
    -- metade das reservas. Não há unique em (activity_id, starts_at) porque
    -- turmas diferentes podem começar juntas de propósito — mas *da mesma
    -- atividade*, no mesmo instante, é sempre engano.
    select cs.id into v_id from class_sessions cs
     where cs.activity_id = p_activity_id and cs.starts_at = v_quando
     limit 1;
    if found then
      quando := v_quando; session_id := v_id; pulada := 'ja_existia';
      return next;
      continue;
    end if;

    insert into class_sessions (activity_id, starts_at, capacity, enrolled, slots_open, coin_cost)
    values (p_activity_id, v_quando, p_capacity, p_enrolled, p_slots_open, p_coin_cost)
    returning id into v_id;

    quando := v_quando; session_id := v_id; pulada := null;
    return next;
  end loop;
end;
$$;

-- Uma chamada, uma transação: ou as oito semanas entram, ou nenhuma entra. Com
-- oito chamadas do navegador, uma queda de rede na quinta deixaria meia série
-- publicada e ninguém saberia quais.
grant execute on function publish_sessions(uuid, timestamptz[], int, int, int, int) to authenticated;


commit;

-- =====================================================================
-- O que este arquivo deixou pronto.
--
-- Fica DEPOIS do commit e é a última instrução do arquivo de propósito: o
-- SQL Editor mostra o resultado da última consulta, então esta tabela
-- aparece sozinha ao clicar em Run. Sem ela, o editor diria só "Success" —
-- e "Success" é o que ele diz também quando nada foi feito.
--
-- Todas as linhas têm de vir "ok". Qualquer "FALTANDO" quer dizer que você
-- está rodando uma versão antiga deste arquivo, ou que algo falhou.
-- =====================================================================
create temp table if not exists kidoo_status (ordem int, item text, situacao text);
truncate kidoo_status;

do $status$
declare v_publico boolean;
begin
  insert into kidoo_status values
    (1, 'visão class_sessions_visible',
     case when to_regclass('public.class_sessions_visible') is null then 'FALTANDO' else 'ok' end),
    (2, 'tabela session_waitlist',
     case when to_regclass('public.session_waitlist') is null then 'FALTANDO' else 'ok' end),
    (3, 'tabela push_outbox',
     case when to_regclass('public.push_outbox') is null then 'FALTANDO' else 'ok' end),
    (4, 'tabela push_tokens',
     case when to_regclass('public.push_tokens') is null then 'FALTANDO' else 'ok' end),
    (5, 'coluna bookings.reward',
     case when exists (select 1 from information_schema.columns
                        where table_name='bookings' and column_name='reward')
          then 'ok' else 'FALTANDO' end),
    (6, 'session_roster com localização',
     case when exists (select 1 from information_schema.routines r
                         join information_schema.parameters p on p.specific_name = r.specific_name
                        where r.routine_name='session_roster'
                          and p.parameter_name='location_verified')
          then 'ok' else 'FALTANDO' end);

  insert into kidoo_status values
    (9, 'função publish_sessions (turma que se repete)',
     case when to_regproc('public.publish_sessions') is null then 'FALTANDO' else 'ok' end);

  -- Os buckets exigem SQL dinâmico: `storage.buckets` é resolvido no plano da
  -- consulta, então uma referência direta rebenta no Postgres local antes de
  -- qualquer `case` ser avaliado. E é justamente o caso que motivou esta
  -- tabela — a migration do Storage se pula sozinha quando não enxerga o
  -- schema, e no Supabase esse "pulei" saía como um `notice` que o editor não
  -- mostra: "Success" com nada feito.
  if to_regclass('storage.buckets') is null then
    insert into kidoo_status values
      (7, 'bucket criancas (privado)',   'SEM SCHEMA STORAGE'),
      (8, 'bucket atividades (público)', 'SEM SCHEMA STORAGE');
  else
    execute 'select public from storage.buckets where id = ''criancas''' into v_publico;
    insert into kidoo_status values (7, 'bucket criancas (privado)',
      case when v_publico is null then 'FALTANDO'
           when v_publico then 'ERRADO: está público'
           else 'ok' end);

    execute 'select public from storage.buckets where id = ''atividades''' into v_publico;
    insert into kidoo_status values (8, 'bucket atividades (público)',
      case when v_publico is null then 'FALTANDO'
           when v_publico then 'ok'
           else 'ERRADO: está privado' end);
  end if;
end $status$;

select item, situacao from kidoo_status order by ordem;
