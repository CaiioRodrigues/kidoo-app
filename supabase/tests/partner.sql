-- O painel do parceiro: o que ele pode e, principalmente, o que não pode.
-- Roda depois de rls.sql, no mesmo banco.

\set arena '33333333-3333-3333-3333-333333333333'
\set pampulha '44444444-4444-4444-4444-444444444444'
\set ana '11111111-1111-1111-1111-111111111111'

set role authenticated;

-- ---- o tipo da vaga não é do parceiro ---------------------------------------
-- Era: `kind` livre numa policy `for all`. Bastava marcar tudo como 'cheia'
-- para dobrar o próprio repasse sem mudar nada no mundo real.
select set_config('request.jwt.claim.sub', :'arena', false);
do $$
declare v_id uuid; v_kind slot_kind;
begin
  select id into v_id from class_sessions
   where activity_id = 'dddddddd-0000-0000-0000-00000000000a' limit 1;

  update class_sessions set kind = 'cheia' where id = v_id;
  select kind into v_kind from class_sessions where id = v_id;
  assert v_kind = 'ociosa',
         'turma com 7 matriculados é ociosa, o parceiro pediu ' || v_kind;

  -- e uma turma que só existe por nossa causa continua sendo cheia
  update class_sessions set enrolled = 0 where id = v_id;
  select kind into v_kind from class_sessions where id = v_id;
  assert v_kind = 'cheia', 'turma sem matriculados é cheia, veio ' || v_kind;

  update class_sessions set enrolled = 7 where id = v_id;
end $$;

-- ---- publicar turma ---------------------------------------------------------
do $$
declare v_session class_sessions%rowtype;
begin
  v_session := publish_session('dddddddd-0000-0000-0000-00000000000a',
                               now() + interval '3 days', 20, 9, 5, 2);
  assert v_session.kind = 'ociosa', 'derivada na inserção também';
  assert v_session.slots_open = 5, 'abriu 5 vagas';

  begin
    perform publish_session('dddddddd-0000-0000-0000-00000000000a',
                            now() - interval '1 hour', 20, 9, 5, 2);
    assert false, 'turma no passado deveria falhar';
  exception when others then
    assert sqlerrm = 'session_in_the_past', 'esperado session_in_the_past, veio: ' || sqlerrm;
  end;

  begin
    perform publish_session('dddddddd-0000-0000-0000-00000000000a',
                            now() + interval '3 days', 10, 8, 5, 2);
    assert false, 'abrir mais do que cabe deveria falhar';
  exception when others then
    assert sqlerrm = 'over_capacity', 'esperado over_capacity, veio: ' || sqlerrm;
  end;

  -- o custo sai do bolso da família: sem teto, dava para torrar a cota semanal
  begin
    perform publish_session('dddddddd-0000-0000-0000-00000000000a',
                            now() + interval '3 days', 20, 9, 5, 40);
    assert false, 'coin_cost fora da faixa deveria falhar';
  exception when check_violation then
    null;
  end;
end $$;

-- ---- turma de outro parceiro ------------------------------------------------
select set_config('request.jwt.claim.sub', :'pampulha', false);
do $$
declare v_id uuid;
begin
  select id into v_id from class_sessions
   where activity_id = 'dddddddd-0000-0000-0000-00000000000a' limit 1;

  begin
    perform set_slots_open(v_id, 1);
    assert false, 'Pampulha não pode mexer na turma da Arena';
  exception when others then
    assert sqlerrm = 'not_this_partner', 'esperado not_this_partner, veio: ' || sqlerrm;
  end;

  begin
    perform publish_session('dddddddd-0000-0000-0000-00000000000a',
                            now() + interval '2 days', 20, 9, 5, 2);
    assert false, 'Pampulha não pode publicar turma na atividade da Arena';
  exception when others then
    assert sqlerrm = 'not_this_partner', 'esperado not_this_partner, veio: ' || sqlerrm;
  end;

  assert (select count(*) from partner_agenda(now() - interval '1 day', now() + interval '30 days')
           where activity_title = 'Futebol Kids') = 0,
         'a agenda da Pampulha não mostra turma da Arena';

  assert (select count(*) from session_roster(v_id)) = 0,
         'a lista de presença da Arena não abre para a Pampulha';
end $$;

-- ---- fechar vaga já reservada -----------------------------------------------
select set_config('request.jwt.claim.sub', :'arena', false);
do $$
declare v_id uuid; v_session class_sessions%rowtype;
begin
  select session_id into v_id from bookings where status <> 'cancelled' limit 1;

  begin
    perform set_slots_open(v_id, 0);
    assert false, 'fechar abaixo do reservado deixaria família sem lugar';
  exception when others then
    assert sqlerrm = 'slots_already_taken', 'esperado slots_already_taken, veio: ' || sqlerrm;
  end;

  begin
    perform set_slots_open(v_id, 999);
    assert false, 'abrir mais do que cabe deveria falhar';
  exception when others then
    assert sqlerrm = 'over_capacity', 'esperado over_capacity, veio: ' || sqlerrm;
  end;

  -- reduzir até o que já foi reservado é permitido: é o parceiro parando de
  -- vender sem quebrar quem já reservou
  v_session := set_slots_open(v_id, (select slots_taken from class_sessions where id = v_id));
  assert v_session.slots_open = v_session.slots_taken, 'parou de vender, sem quebrar ninguém';
end $$;

-- ---- a lista de presença mostra o mínimo ------------------------------------
-- O parceiro precisa receber a criança na porta, não conhecer a família.
do $$
declare v_id uuid; v_linha record; v_colunas int;
begin
  select session_id into v_id from bookings where status <> 'cancelled' limit 1;
  select * into v_linha from session_roster(v_id) limit 1;

  assert v_linha.child_first_name = 'Joao', 'primeiro nome, veio ' || v_linha.child_first_name;
  assert v_linha.child_first_name not like '% %', 'só o primeiro nome, nunca o completo';
  assert v_linha.child_age between 5 and 12, 'idade em anos, veio ' || v_linha.child_age;

  -- o contrato da função é a garantia de privacidade: se alguém acrescentar uma
  -- coluna com dado da família, este teste quebra e obriga a decisão explícita.
  select count(*) into v_colunas
    from information_schema.routines r
    join information_schema.parameters p on p.specific_name = r.specific_name
   where r.routine_name = 'session_roster' and p.parameter_mode = 'OUT';
  assert v_colunas = 9, 'session_roster mudou de forma: ' || v_colunas || ' colunas';

  -- A nona coluna foi decidida assim: o parceiro recebe se a localização foi
  -- conferida, e NUNCA a distância. Saber "não conferida" é o que ele precisa
  -- para olhar a criança na frente dele; saber "estava a 12 km" é saber onde a
  -- família estava, e isso não é assunto dele. A distância continua só na
  -- reserva, para auditoria nossa.
  assert exists (
    select 1 from information_schema.routines r
      join information_schema.parameters p on p.specific_name = r.specific_name
     where r.routine_name = 'session_roster' and p.parameter_mode = 'OUT'
       and p.parameter_name = 'location_verified' and p.data_type = 'boolean'
  ), 'a coluna de localização precisa ser booleana';
  assert not exists (
    select 1 from information_schema.routines r
      join information_schema.parameters p on p.specific_name = r.specific_name
     where r.routine_name = 'session_roster' and p.parameter_mode = 'OUT'
       and (p.parameter_name ilike '%distance%' or p.parameter_name ilike '%distancia%'
            or p.parameter_name ilike '%latitude%' or p.parameter_name ilike '%longitude%')
  ), 'o parceiro não recebe distância nem coordenada da família';
end $$;

-- ---- os três estados da localização ----------------------------------------
-- Nulo importa: quem ainda não chegou não pode aparecer como suspeito.
--
-- O preparo do estado sai do papel de parceiro: a RLS de `bookings` não deixa
-- ele escrever direto, e um `update` filtrado pela RLS não falha — ele
-- simplesmente não faz nada, e o teste passaria medindo o valor antigo.
reset role;
do $$
declare v_reserva uuid;
begin
  select id into v_reserva from bookings
   where check_in_proof is not null and status <> 'cancelled' limit 1;
  perform set_config('kidoo.reserva_loc', coalesce(v_reserva::text, ''), false);
end $$;
set role authenticated;
select set_config('request.jwt.claim.sub', :'arena', false);

do $$
declare v_sessao uuid; v_reserva uuid; v_valor boolean;
begin
  -- Sem check-in: desconhecido, e não "não conferido". Colapsar os dois
  -- marcaria de suspeita toda criança que ainda não chegou.
  select b.session_id, b.id into v_sessao, v_reserva
    from bookings b
    join activities a on a.id = b.activity_id
   where b.check_in_proof is null and b.status <> 'cancelled'
     and is_partner_member(a.partner_id)
   limit 1;
  if found then
    select location_verified into v_valor from session_roster(v_sessao)
     where booking_id = v_reserva;
    assert v_valor is null, 'sem check-in, a localização é desconhecida, não falsa';
  end if;
end $$;

reset role;
do $$
declare v_reserva uuid := nullif(current_setting('kidoo.reserva_loc', true), '')::uuid;
begin
  if v_reserva is not null then
    update bookings set check_in_proof = jsonb_build_object('locationVerified', false)
     where id = v_reserva;
  end if;
end $$;
set role authenticated;
select set_config('request.jwt.claim.sub', :'arena', false);
do $$
declare v_reserva uuid := nullif(current_setting('kidoo.reserva_loc', true), '')::uuid;
  v_sessao uuid; v_valor boolean; v_achou boolean := false;
begin
  if v_reserva is null then return; end if;
  select session_id into v_sessao from bookings where id = v_reserva;
  select location_verified, true into v_valor, v_achou
    from session_roster(v_sessao) where booking_id = v_reserva;
  assert v_achou, 'a reserva preparada precisa estar na lista deste parceiro';
  assert v_valor = false, 'check-in sem localização aparece como não conferido';
end $$;

reset role;
do $$
declare v_reserva uuid := nullif(current_setting('kidoo.reserva_loc', true), '')::uuid;
begin
  if v_reserva is not null then
    update bookings
       set check_in_proof = jsonb_build_object('locationVerified', true, 'distanceM', 40)
     where id = v_reserva;
  end if;
end $$;
set role authenticated;
select set_config('request.jwt.claim.sub', :'arena', false);
do $$
declare v_reserva uuid := nullif(current_setting('kidoo.reserva_loc', true), '')::uuid;
  v_sessao uuid; v_valor boolean;
begin
  if v_reserva is null then return; end if;
  select session_id into v_sessao from bookings where id = v_reserva;
  select location_verified into v_valor from session_roster(v_sessao)
   where booking_id = v_reserva;
  assert v_valor = true, 'check-in com localização aparece como conferido';
end $$;

-- ---- a agenda conta o que o parceiro precisa saber --------------------------
do $$
declare v_linha record;
begin
  select * into v_linha from partner_agenda(now() - interval '1 day', now() + interval '30 days')
   where confirmed > 0 limit 1;
  assert found, 'a agenda deveria mostrar a turma com presença confirmada';
  assert v_linha.checked_in >= v_linha.confirmed,
         'confirmado é um subconjunto de quem fez check-in';
end $$;

-- ---- extrato ----------------------------------------------------------------
do $$
declare v_total bigint;
begin
  select total_cents into v_total from partner_statement(6) where slot_kind = 'ociosa';
  assert v_total = 800, 'o extrato deveria trazer 800 centavos, veio ' || coalesce(v_total::text,'nulo');
end $$;

-- ---- responsável não tem painel ---------------------------------------------
select set_config('request.jwt.claim.sub', :'ana', false);
do $$
declare v_id uuid;
begin
  select session_id into v_id from bookings limit 1;
  assert (select count(*) from session_roster(v_id)) = 0,
         'responsável não lista a turma inteira, nem a que ele reservou';
  assert (select count(*) from partner_agenda(now() - interval '30 days', now() + interval '30 days')) = 0,
         'responsável não tem agenda de parceiro';
  assert (select count(*) from partner_statement(6)) = 0,
         'responsável não vê extrato de repasse';
end $$;

reset role;
\echo 'painel do parceiro: todos os testes passaram'
