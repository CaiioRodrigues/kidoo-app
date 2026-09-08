-- =====================================================================
-- Kidoo — atualizar um banco que JÁ EXISTE.
--
-- O `01-banco.sql` é para a primeira subida e não pode ser rodado de novo:
-- ele tem `create table` sem `if not exists`, e a segunda execução falha na
-- primeira tabela. Este arquivo é o complemento — só o que veio depois.
--
-- Tudo aqui é idempotente (`create or replace`, `if not exists`,
-- `drop ... if exists`), então rodar duas vezes não faz mal.
--
-- Cole INTEIRO no SQL Editor do Supabase e clique em Run.
--
-- O que entra:
--   000008  a mesma criança não reserva duas vezes a mesma turma
--   000009  fila de espera, caixa de saída de avisos e tokens de push
--   000010  o parceiro vê se a chegada teve localização conferida
--
-- Sem isto, o app novo quebra ao listar turmas: ele consulta a visão
-- `class_sessions_visible`, que nasce na 000009.
-- =====================================================================

begin;


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

-- Conferência rápida do que acabou de entrar:
--   select count(*) from class_sessions_visible;
--   select proname from pg_proc where proname in
--     ('join_waitlist','leave_waitlist','my_waitlist','register_push_token','session_roster');
