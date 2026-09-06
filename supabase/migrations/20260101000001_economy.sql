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
