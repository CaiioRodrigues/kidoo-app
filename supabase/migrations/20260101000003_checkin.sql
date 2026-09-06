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
