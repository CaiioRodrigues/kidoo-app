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
