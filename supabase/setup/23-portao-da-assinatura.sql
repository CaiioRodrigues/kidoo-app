-- =====================================================================
-- Kidoo — o portão da assinatura.
--
-- Para um banco que JÁ EXISTE, e DEPOIS da 22. Cole inteiro no SQL Editor do
-- Supabase e clique em Run. É idempotente.
--
-- O QUE ESTAVA ABERTO: chamar `subscribe_plan` ERA ter o plano. Qualquer conta
-- criada saía com a cota cheia, para sempre, sem ninguém ter pago nada. E
-- `renews_at` era escrito e nunca lido — quem renovava a cota era a virada da
-- semana, então ela voltava ao cheio mesmo com o mês vencido há um ano.
--
-- Isso nunca custou nada enquanto não havia dinheiro saindo. Depois da 22 (a
-- falta paga o parceiro) virou furo de caixa: conta grátis, assinatura grátis,
-- reserva, não aparece — e o Kidoo paga de verdade.
--
-- O que entra:
--   1. `subscriptions.status`: aguardando / ativa / vencida.
--      AS ASSINATURAS QUE JÁ EXISTEM VIRAM `ativa`. Só as novas nascem
--      aguardando — fechar a porta com gente dentro é outra coisa.
--   2. `subscribe_plan` cria em `aguardando`. Trocar de plano preserva o
--      estado: quem está ativo não é trancado para fora por mudar de plano.
--   3. `roll_subscription_cycle` passa a olhar `renews_at`.
--   4. `book_session` exige `ativa`, antes de olhar saldo.
--   5. Duas funções para quem administra: listar e ligar/desligar.
--
-- ISTO NÃO É COBRANÇA. Ninguém paga nada aqui, nenhum cartão é guardado. É a
-- diferença entre "o sistema acha que você assinou" e "alguém confirmou que
-- você assinou" — e é onde o webhook do gateway vai encostar quando existir.
--
-- Depois de rodar, o painel de quem administra ganha a aba "Assinaturas".
-- =====================================================================

begin;

-- O portão da assinatura.
--
-- Até aqui, chamar `subscribe_plan` ERA ter o plano. Não existia estado entre
-- "escolhi" e "tenho": qualquer conta criada saía com a cota cheia, para
-- sempre, sem ninguém ter pago nada.
--
-- Três buracos, e o terceiro é o que dói agora:
--
--   1. `subscribe_plan` é o próprio ato de liberar.
--   2. `renews_at` é escrito e nunca lido. Quem renova a cota é
--      `roll_subscription_cycle`, e ela compara só a virada da semana — a cota
--      volta ao cheio toda segunda, mesmo com o mês vencido há um ano.
--   3. `book_session` pergunta se há saldo, e saldo há sempre, pelo item 2.
--
-- Depois da 000019 isso deixou de ser só um furo de acesso e virou um furo de
-- caixa: reserva não cumprida agora gera repasse ao parceiro. Conta grátis,
-- assinatura grátis, reserva, não aparece — e o Kidoo paga de verdade.
--
-- Isto NÃO é cobrança. Ninguém paga nada aqui, nenhum cartão é guardado. É a
-- diferença entre "o sistema acha que você assinou" e "alguém confirmou que
-- você assinou" — e é onde o webhook do gateway vai encostar quando existir.

-- --------------------------------------------------------------- o estado ---

do $$ begin
  if not exists (select 1 from pg_type where typname = 'subscription_status') then
    create type subscription_status as enum ('aguardando', 'ativa', 'vencida');
  end if;
end $$;

/*
  Novas nascem `aguardando`; as que já existem viram `ativa`.

  O padrão da coluna é `aguardando` — é o que vale para quem assinar de agora
  em diante. Mas aplicar isso às linhas existentes trancaria na hora quem já
  está usando o sistema, inclusive a conta de quem sobe esta migration. Quem
  entrou antes do portão entrou pela porta que estava aberta, e fechá-la com
  gente dentro é outra coisa.
*/
alter table subscriptions
  add column if not exists status subscription_status not null default 'aguardando';

update subscriptions set status = 'ativa' where status = 'aguardando';

comment on column subscriptions.status is
  'aguardando = escolheu o plano e ninguém confirmou o pagamento; ativa = pode reservar; vencida = passou de renews_at sem renovar.';

-- --------------------------------------------------- escolher não é ter -----

/*
  `subscribe_plan` passa a criar em `aguardando`.

  Na troca de plano o estado é PRESERVADO, e não redefinido: quem já está ativo
  e muda de plano não pode ser trancado para fora por causa disso. Com cobrança
  de verdade a troca gera um cobrança nova — e é ali que o estado volta a
  `aguardando`, decidido pelo gateway, não aqui.

  O corpo é o da 000005 com o `status` a mais; o resto é idêntico de propósito,
  porque `create or replace` substitui a função inteira.
*/
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
                             cycle_started_at, renews_at, status)
  values (v_guardian, v_plan.id, v_plan.coins_per_week, v_plan.coins_per_week,
          week_start(now()), now() + interval '1 month', 'aguardando')
  on conflict (guardian_id) do update set
    plan_id         = excluded.plan_id,
    coins_per_week  = excluded.coins_per_week,
    -- Trocar de plano no meio da semana não devolve o que já foi gasto: a cota
    -- nova entra descontada do que a família já usou.
    coins_remaining = greatest(0, least(excluded.coins_per_week,
                       excluded.coins_per_week - (subscriptions.coins_per_week - subscriptions.coins_remaining))),
    renews_at       = excluded.renews_at,
    status          = subscriptions.status
  returning * into v_sub;

  return v_sub;
end;
$$;

-- ------------------------------------------------- o vencimento existe ------

/*
  `roll_subscription_cycle` passa a olhar `renews_at`.

  O campo era escrito desde o primeiro dia e nunca lido. Agora ele decide: mês
  vencido não renova a cota, e a assinatura cai para `vencida`. A queda é feita
  aqui, na leitura, e não por tarefa agendada — assim não depende de cron
  nenhum estar de pé, e a conta que ninguém abre não precisa mesmo ser
  atualizada.

  Uma assinatura `aguardando` também não renova: ela nunca chegou a valer.
*/
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

  if v_sub.status = 'ativa' and v_sub.renews_at <= now() then
    update subscriptions set status = 'vencida'
     where guardian_id = p_guardian
    returning * into v_sub;
  end if;

  if v_sub.status = 'ativa' and v_sub.cycle_started_at < v_start then
    update subscriptions
       set coins_remaining  = coins_per_week,
           cycle_started_at = v_start
     where guardian_id = p_guardian
    returning * into v_sub;
  end if;

  return v_sub;
end;
$$;

-- ------------------------------------------------- reservar exige ativa -----

/*
  A checagem entra ANTES da divisão do pagamento, e não junto do saldo.

  Uma aula paga inteira com Kidoo Bônus não toca a assinatura — o caminho de
  `v_from_sub > 0` nem roda. Mas o bônus veio da assinatura, então deixá-lo
  passar por fora do portão seria uma porta dos fundos com estoque próprio:
  quem subiu de nível antes de vencer continuaria reservando de graça.

  O corpo é o da 000019 com essa checagem a mais, e nada além.
*/
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
  v_partner   partners%rowtype;
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

  -- O portão. `roll_subscription_cycle` é quem derruba para `vencida` quando o
  -- mês passou, então a leitura aqui já vem atualizada.
  v_sub := roll_subscription_cycle(v_guardian);
  if v_sub.guardian_id is null then
    raise exception 'no_subscription' using errcode = 'P0001';
  end if;
  if v_sub.status <> 'ativa' then
    raise exception 'subscription_inactive' using errcode = 'P0001';
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
  -- real contra duas requisições simultâneas: entre este `exists` e o `insert`
  -- ainda cabe outra transação. Esta checagem existe para o caso comum — a
  -- pessoa tocou de novo — falhar com uma frase que dá para ler.
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
  select * into v_partner  from partners   where id = v_activity.partner_id;

  -- As duas recusas são separadas porque a família merece frases diferentes:
  -- "esta turma saiu do ar" tem outra atividade ao lado; "este lugar não faz
  -- mais parte do Kidoo" não tem.
  if not v_activity.active then
    raise exception 'activity_inactive' using errcode = 'P0001';
  end if;
  if not v_partner.active then
    raise exception 'partner_inactive' using errcode = 'P0001';
  end if;

  -- O bônus entra antes da cota da assinatura porque ele expira; a cota volta
  -- ao cheio toda semana de qualquer jeito.
  v_from_bonus := least(bonus_balance(p_child_id), v_session.coin_cost);
  v_from_sub   := v_session.coin_cost - v_from_bonus;

  if v_from_sub > 0 then
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

-- ----------------------------------------------------- quem abre o portão ---

/**
 * Liga e desliga uma assinatura. Só quem administra o Kidoo.
 *
 * É o lugar do webhook do gateway, antes de ele existir: quando o pagamento
 * aprovado chegar, o que ele faz é exatamente isto. Enquanto não chega, a
 * pessoa que confirma é alguém do Kidoo, olhando o comprovante.
 *
 * Ativar empurra `renews_at` um mês para a frente a partir de agora. Sem isso,
 * ativar uma assinatura vencida a deixaria vencida no instante seguinte — e o
 * sintoma seria "ativei e não funcionou".
 */
create or replace function set_subscription_status(p_guardian uuid, p_status subscription_status)
returns subscriptions
language plpgsql
security definer
set search_path = public
as $$
declare v_sub subscriptions%rowtype;
begin
  if not is_kidoo_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;

  update subscriptions
     set status    = p_status,
         renews_at = case when p_status = 'ativa' then now() + interval '1 month'
                          else renews_at end,
         -- Ativar devolve a cota da semana corrente: quem acabou de pagar não
         -- deveria começar com o saldo zerado pelo tempo em que esperou.
         coins_remaining  = case when p_status = 'ativa' then coins_per_week
                                 else coins_remaining end,
         cycle_started_at = case when p_status = 'ativa' then week_start(now())
                                 else cycle_started_at end
   where guardian_id = p_guardian
  returning * into v_sub;

  if not found then
    raise exception 'no_subscription' using errcode = 'P0002';
  end if;
  return v_sub;
end;
$$;

grant execute on function set_subscription_status(uuid, subscription_status) to authenticated;

/**
 * As assinaturas, para quem administra.
 *
 * Traz o e-mail porque é por ele que se cruza com o comprovante de pagamento —
 * é o único identificador que a família também conhece. `guardians` é privado
 * por RLS; esta função é `security definer` e só responde a quem está em
 * `kidoo_admins`.
 */
create or replace function admin_subscriptions()
returns table (
  guardian_id uuid,
  name text,
  email text,
  plan_id text,
  status subscription_status,
  coins_remaining smallint,
  coins_per_week smallint,
  renews_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_kidoo_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;

  return query
    select s.guardian_id, g.name, g.email, s.plan_id, s.status,
           s.coins_remaining, s.coins_per_week, s.renews_at
      from subscriptions s
      join guardians g on g.id = s.guardian_id
     -- Quem espera primeiro: é a fila que alguém precisa olhar.
     order by (s.status = 'aguardando') desc, g.name;
end;
$$;

grant execute on function admin_subscriptions() to authenticated;

-- `current_subscription` continua igual: ela só delega para o ciclo, que agora
-- devolve o `status` junto por ser `returns subscriptions`.

commit;

-- ------------------------------------------------------------- conferência ---

-- Como está a fila? Nenhuma assinatura que já existia pode ter virado
-- `aguardando` — isso trancaria para fora quem já estava usando.
select status, count(*) from subscriptions group by status;

-- `book_session` ficou com TODAS as guardas? A lista tem de vir toda `true`.
-- `already_booked`, `partner_inactive` e `activity_inactive` vieram de outras
-- migrations — uma função reescrita perde o que não for repetido.
select unnest(array['subscription_inactive','already_booked','partner_inactive',
                    'activity_inactive','session_full','insufficient_coins']) as guarda,
       prosrc like '%' || unnest(array['subscription_inactive','already_booked',
                    'partner_inactive','activity_inactive','session_full',
                    'insufficient_coins']) || '%' as presente
  from pg_proc where proname = 'book_session';

-- E `roll_subscription_cycle` passou a olhar o vencimento?
select prosrc like '%renews_at%' as olha_o_vencimento
  from pg_proc where proname = 'roll_subscription_cycle';
