-- =====================================================================
-- Kidoo — o prazo de cancelamento, e a falta que paga.
--
-- Para um banco que JÁ EXISTE, e DEPOIS da 20 e da 21. Cole inteiro no SQL
-- Editor do Supabase e clique em Run. É idempotente.
--
-- ATENÇÃO: esta migration muda dinheiro. Leia o que ela faz antes de rodar.
--
-- O que entra:
--   1. O prazo de cancelamento passa a EXISTIR no servidor. Até agora ele só
--      vivia na tela do app: `cancel_booking` nunca olhou a hora, então quem
--      chamasse a API direto cancelava um minuto antes da aula e recebia o
--      coin de volta.
--   2. Cinco horas é o corte. Antes: coin volta, vaga liberada, ninguém
--      recebe. Depois: o coin não volta e o PARCEIRO RECEBE pelo lugar que
--      segurou — inclusive quando ninguém apareceu e ninguém desmarcou.
--   3. O estado `no_show` e a coluna `natureza` no extrato, para o parceiro
--      ver separado o que foi presença e o que foi lugar não utilizado.
--
-- O efeito no caixa: a falta deixa de ser gratuita para o Kidoo. Se hoje uma
-- em cada sete reservas não é cumprida, o custo de repasse sobe na mesma
-- proporção. Era o parceiro que pagava essa conta até aqui.
-- =====================================================================

begin;

-- O prazo de cancelamento passa a existir no servidor — e a falta paga.
--
-- Duas coisas, e a primeira é um furo:
--
-- 1. **O prazo só existia na tela.** `cancel_booking` nunca olhou a hora:
--    quem chamasse a API direto cancelava um minuto antes da aula e recebia o
--    coin de volta. A regra das seis horas morava em `src/lib/cancellation.ts`,
--    do lado que não decide nada.
--
-- 2. **Faltar era de graça.** O repasse só saía na presença confirmada, então
--    a reserva não cumprida não custava nada ao Kidoo — e custava ao parceiro,
--    que segurou o lugar, pagou o professor e não recebeu por ele.
--
-- A regra nova tem um corte só, em cinco horas:
--
--   antes de 5h da aula   o coin volta, a vaga é liberada, ninguém recebe
--   depois disso          o coin não volta e o parceiro recebe
--   não apareceu          idem: o lugar foi segurado e a turma aconteceu
--
-- Cinco horas é o tempo de recolocar alguém: manhã para uma aula à tarde. O
-- mesmo número está em `shared/cancelamento.ts`, e `npm run test:prazo`
-- confere que os dois não se separaram.

-- ------------------------------------------------------------- o número -----

/**
 * O prazo, numa função, para não virar literal espalhado.
 *
 * `stable` e sem parâmetro: é constante. Existe como função para que o teste
 * de contrato consiga perguntar ao banco qual é o prazo, em vez de alguém
 * conferir de olho contra o TypeScript.
 */
create or replace function cancellation_cutoff()
returns interval
language sql
immutable
as $$ select interval '5 hours' $$;

grant execute on function cancellation_cutoff() to anon, authenticated;

-- ------------------------------------------------------- o estado novo ------

-- `no_show` é o cancelamento tardio e a falta: a reserva acabou sem presença,
-- mas com cobrança. Um estado próprio, e não `cancelled` com uma marca ao
-- lado, porque a diferença é justamente o dinheiro — e `cancelled` significa,
-- em todo lugar deste banco, "não custou nada a ninguém".
do $$ begin
  if not exists (
    select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid
     where t.typname = 'booking_status' and e.enumlabel = 'no_show'
  ) then
    alter type booking_status add value 'no_show';
  end if;
end $$;

-- --------------------------------------------------------- cancelar --------

/*
  Cancelar continua sendo sempre possível antes de a aula começar.

  Travar o botão depois do prazo — que era o efeito da regra antiga na tela —
  fazia a família que não ia poder ir simplesmente não avisar ninguém. Avisar
  tarde é melhor que não avisar: o parceiro fica sabendo, e é o que ele faz
  com a informação que decide o dia dele.

  O corpo é o da 000002 com o corte no meio; o resto é idêntico de propósito,
  porque `create or replace` substitui a função inteira e o que não for
  repetido some.
*/
create or replace function cancel_booking(p_booking_id uuid)
returns bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_guardian uuid := auth.uid();
  v_booking  bookings%rowtype;
  v_devolve  boolean;
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
  -- Depois de a aula começar não há mais o que desmarcar: ou a criança foi, e
  -- o check-in resolve, ou não foi, e a reserva já é uma falta.
  if v_booking.scheduled_at <= now() then
    raise exception 'session_already_started' using errcode = 'P0001';
  end if;

  v_devolve := v_booking.scheduled_at - now() >= cancellation_cutoff();

  if v_devolve then
    -- A vaga volta para a turma: dá tempo de alguém ocupá-la.
    update class_sessions
       set slots_taken = greatest(0, slots_taken - 1)
     where id = v_booking.session_id;

    -- Devolve a cota da assinatura. O bônus não volta como lote novo: ele
    -- mantém a validade original, senão cancelar viraria uma forma de esticar
    -- o prazo de uma moeda que estava para vencer.
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
  end if;

  /*
    Dentro do prazo a vaga NÃO é liberada, e não é esquecimento.

    O lugar foi comprado: o coin não volta e o parceiro recebe por ele. Soltar
    a vaga deixaria uma segunda família ocupar o mesmo lugar físico, e o Kidoo
    pagaria duas vezes pelo mesmo assento. Quem desmarca em cima da hora abre
    mão da aula, não do lugar.
  */

  update bookings
     set status = case when v_devolve then 'cancelled'::booking_status
                       else 'no_show'::booking_status end,
         check_in = null
   where id = p_booking_id
  returning * into v_booking;

  return v_booking;
end;
$$;

-- ---------------------------------------------------------- o repasse -------

/*
  O extrato passa a ter duas naturezas, e elas ficam separadas.

  Somar tudo em "presenças" seria mais simples e mentiria duas vezes: o
  parceiro não saberia quantas crianças de fato apareceram — que é o número que
  ele usa para dimensionar turma —, e perderia o incentivo de ler o código de
  check-in, já que receberia igual sem ler. A leitura continua importando: é
  ela que dá XP à criança.

  A falta é reconhecida por dedução, sem tarefa agendada: reserva que passou da
  hora, ninguém cancelou a tempo e ninguém confirmou presença. Somada ao estado
  `no_show`, que é o cancelamento tardio, dá "o lugar foi segurado e a turma
  aconteceu" — que é exatamente o que se paga.
*/
-- `drop` e `create`, e não `create or replace`: a coluna `natureza` entra no
-- meio, e `or replace` só sabe acrescentar no fim — o Postgres recusa com
-- "cannot change name of view column". A função que lê a visão cai antes, por
-- depender dela; as duas nascem de novo logo abaixo.
drop function if exists partner_statement(int);
drop view if exists partner_payouts;

create view partner_payouts as
select
  a.partner_id,
  date_trunc('month', b.scheduled_at)      as month,
  b.slot_kind,
  case
    when b.partner_confirmed_at is not null then 'presenca'
    else 'falta'
  end                                       as natureza,
  count(*)                                  as check_ins,
  coalesce(r.amount_cents, 0)               as rate_cents,
  count(*) * coalesce(r.amount_cents, 0)    as total_cents
from bookings b
join activities a on a.id = b.activity_id
left join payout_rates r on r.partner_id = a.partner_id and r.kind = b.slot_kind
where
  -- Presença confirmada pelo parceiro. "O app diz que veio" não é presença; a
  -- leitura do código é.
  (b.partner_confirmed_at is not null and b.status <> 'cancelled')
  -- Ou o lugar segurado sem presença: cancelamento tardio, ou ninguém apareceu
  -- e a aula já passou.
  or b.status = 'no_show'
  or (b.status = 'confirmed' and b.scheduled_at < now())
group by a.partner_id, date_trunc('month', b.scheduled_at), b.slot_kind,
         case when b.partner_confirmed_at is not null then 'presenca' else 'falta' end,
         r.amount_cents;

alter view partner_payouts set (security_invoker = true);
-- O `grant` morre junto com a visão derrubada. Ele vinha da 000004, e sem esta
-- linha o extrato inteiro responde "permission denied" — silenciosamente, para
-- todo parceiro, na primeira tela que ele abre depois de subir a migration.
grant select on partner_payouts to authenticated;

-- O extrato carrega a natureza junto. Já foi derrubado acima, com a visão.
create function partner_statement(p_months int default 6)
returns table (
  month       timestamptz,
  slot_kind   slot_kind,
  natureza    text,
  check_ins   bigint,
  rate_cents  integer,
  total_cents bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select p.month, p.slot_kind, p.natureza, p.check_ins, p.rate_cents, p.total_cents
    from partner_payouts p
   where is_partner_member(p.partner_id)
     and p.month >= date_trunc('month', now()) - make_interval(months => greatest(0, p_months))
   order by p.month desc, p.slot_kind, p.natureza;
$$;

grant execute on function partner_statement(int) to authenticated;

commit;

-- ------------------------------------------------------------- conferência ---

-- O prazo está lá, e é de cinco horas? Tem de bater com
-- `shared/cancelamento.ts` — `npm run test:prazo` confere isso no repositório.
select cancellation_cutoff();

-- O estado novo entrou no enum?
select enumlabel from pg_enum e join pg_type t on t.oid = e.enumtypid
 where t.typname = 'booking_status' order by e.enumsortorder;

-- `cancel_booking` ficou com TODAS as guardas? A lista tem de vir toda `true`.
-- `booking_not_cancellable` veio da 000002 e `session_already_started` entrou
-- agora — uma função reescrita perde o que não for repetido.
select unnest(array['cancellation_cutoff','booking_not_found','booking_not_cancellable',
                    'session_already_started','no_show']) as guarda,
       prosrc like '%' || unnest(array['cancellation_cutoff','booking_not_found',
                    'booking_not_cancellable','session_already_started','no_show']) || '%'
         as presente
  from pg_proc where proname = 'cancel_booking';

-- E o extrato voltou a ser legível para o parceiro? (vazio é normal num banco
-- sem reserva passada — o que não pode é dar erro de permissão)
select natureza, count(*) from partner_payouts group by natureza;
