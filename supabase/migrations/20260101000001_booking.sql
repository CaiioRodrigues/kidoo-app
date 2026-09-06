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

  update class_sessions
     set slots_taken = slots_taken + 1
   where id = p_session_id;

  insert into bookings (
    guardian_id, child_id, session_id, activity_id,
    scheduled_at, coin_cost, slot_kind
  ) values (
    v_guardian, p_child_id, v_session.id, v_activity.id,
    v_session.starts_at, v_session.coin_cost, v_session.kind
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
