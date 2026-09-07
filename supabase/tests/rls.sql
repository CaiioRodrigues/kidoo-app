-- Isolamento entre responsáveis e entre parceiros, e as regras da reserva.
-- Falha alto: qualquer `assert` quebrado derruba o script inteiro.

\set ON_ERROR_STOP on
\set ana    '11111111-1111-1111-1111-111111111111'
\set bruno  '22222222-2222-2222-2222-222222222222'
\set arena  '33333333-3333-3333-3333-333333333333'

-- ---- responsável só enxerga o que é dele -----------------------------------
set role authenticated;
select set_config('request.jwt.claim.sub', :'ana', false);
do $$ begin
  assert (select count(*) from children)  = 1, 'Ana deveria ver só 1 filho';
  assert (select count(*) from guardians) = 1, 'Ana deveria ver só o próprio cadastro';
  assert (select count(*) from activities) = 2, 'catálogo deveria ser público';
end $$;

-- ---- parceiro não toca no que é de outro parceiro --------------------------
select set_config('request.jwt.claim.sub', :'arena', false);
do $$
declare alheias int; proprias int;
begin
  with u as (update class_sessions set slots_open = 99
              where id = 'eeeeeeee-0000-0000-0000-000000000002' returning 1)
  select count(*) into alheias from u;
  assert alheias = 0, 'Arena não pode alterar turma do Pampulha';

  with u as (update class_sessions set slots_open = 1
              where id = 'eeeeeeee-0000-0000-0000-000000000001' returning 1)
  select count(*) into proprias from u;
  assert proprias = 1, 'Arena precisa poder alterar a própria turma';
end $$;

-- ---- reserva e devolução da vaga -------------------------------------------
select set_config('request.jwt.claim.sub', :'ana', false);
do $$
declare v_booking bookings%rowtype;
begin
  v_booking := book_session('eeeeeeee-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000001');
  assert v_booking.slot_kind = 'ociosa', 'o tipo da vaga tem de ser congelado na reserva';
  assert (select slots_taken from class_sessions where id='eeeeeeee-0000-0000-0000-000000000001') = 1,
         'reservar precisa ocupar a vaga';

  -- turma sem vaga recusa antes de qualquer outra coisa
  begin
    perform book_session('eeeeeeee-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000001');
    assert false, 'turma cheia deveria recusar';
  exception when others then
    assert sqlerrm = 'session_full', 'esperado session_full, veio: ' || sqlerrm;
  end;

  perform cancel_booking(v_booking.id);
  assert (select slots_taken from class_sessions where id='eeeeeeee-0000-0000-0000-000000000001') = 0,
         'cancelar precisa devolver a vaga ao parceiro';

  -- e depois de cancelar, a mesma família precisa conseguir reservar de novo
  v_booking := book_session('eeeeeeee-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000001');
  assert v_booking.id is not null, 'cancelar não pode bloquear a turma para sempre';
  perform cancel_booking(v_booking.id);
end $$;

-- ---- uma criança, um lugar por turma (com vaga sobrando) --------------------
do $$
declare v_booking bookings%rowtype;
begin
  -- a turma do Pampulha tem 2 vagas: aqui quem barra é a unique, não a capacidade
  v_booking := book_session('eeeeeeee-0000-0000-0000-000000000002','aaaaaaaa-0000-0000-0000-000000000001');
  begin
    perform book_session('eeeeeeee-0000-0000-0000-000000000002','aaaaaaaa-0000-0000-0000-000000000001');
    assert false, 'a mesma criança não pode ocupar dois lugares na mesma turma';
  exception when unique_violation then null;
  end;
  perform cancel_booking(v_booking.id);
end $$;

-- ---- criança dos outros ----------------------------------------------------
do $$ begin
  begin
    perform book_session('eeeeeeee-0000-0000-0000-000000000002','bbbbbbbb-0000-0000-0000-000000000001');
    assert false, 'Ana não pode reservar no nome de criança do Bruno';
  exception when others then
    assert sqlerrm = 'child_not_found', 'erro esperado child_not_found, veio: ' || sqlerrm;
  end;
end $$;

-- ---- check-in: só o responsável, e só na janela -------------------------
do $$
declare v_booking bookings%rowtype; v_code text; v_xp_antes int;
begin
  -- turma daqui a 2h: fora da janela de 45 min
  v_booking := book_session('eeeeeeee-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000001');
  begin
    perform check_in_booking(v_booking.id);
    assert false, 'check-in três horas antes deveria ser recusado';
  exception when others then
    assert sqlerrm = 'check_in_too_early', 'esperado check_in_too_early, veio: ' || sqlerrm;
  end;
  perform cancel_booking(v_booking.id);

  select xp into v_xp_antes from children where id = 'aaaaaaaa-0000-0000-0000-000000000001';

  -- turma daqui a 10 min: dentro da janela
  v_booking := book_session('eeeeeeee-0000-0000-0000-000000000003','aaaaaaaa-0000-0000-0000-000000000001');
  v_booking := check_in_booking(v_booking.id, 40, false);
  assert v_booking.status = 'checked_in', 'o check-in deveria valer';
  assert (v_booking.check_in_proof->>'locationVerified')::boolean, 'leitura a 40 m é verificada';
  assert (select xp from children where id = 'aaaaaaaa-0000-0000-0000-000000000001') = v_xp_antes + 100,
         'check-in credita 100 de XP';

  -- longe demais, com leitura confiável, é recusado
  begin
    perform check_in_booking(v_booking.id, 12000, false);
    assert false, 'a 12 km deveria recusar';
  exception when others then
    assert sqlerrm = 'too_far_from_venue', 'esperado too_far_from_venue, veio: ' || sqlerrm;
  end;
end $$;

-- ---- check-in devolve XP e nível, sem o cliente deduzir ---------------------
do $$
declare v_id uuid; v_out jsonb;
begin
  select id into v_id from bookings
   where guardian_id = '11111111-1111-1111-1111-111111111111'
     and status = 'checked_in' limit 1;

  -- já entrou: reemite o código e não credita nada
  v_out := check_in(v_id, -19.9702, -43.9803, 15, false);
  assert (v_out->>'xpEarned')::int = 0, 'repetir o check-in não credita XP de novo';
  assert v_out->'booking'->>'id' = v_id::text, 'a reserva volta junto com o resultado';
  assert (v_out->'booking'->'check_in'->>'code') is not null, 'o código é reemitido';
  assert (v_out->'booking'->'check_in_proof'->>'distanceM')::numeric < 100,
         'reemitir o código não reescreve a prova do check-in original';
end $$;

-- ---- a distância é do servidor, não do cliente ------------------------------
-- Arena Kids fica em (-19.9702, -43.9803). Uma reta de ~12 km a partir dela.
do $$
declare v_perto numeric; v_longe numeric;
begin
  v_perto := distance_m(-19.9705, -43.9806, -19.9702, -43.9803);
  v_longe := distance_m(-19.8551, -43.9797, -19.9702, -43.9803);
  assert v_perto < 60, 'poucos metros deveriam dar poucos metros, veio ' || round(v_perto);
  assert v_longe between 12000 and 13500,
         'Pampulha fica a ~12,8 km da Arena, veio ' || round(v_longe);
end $$;

-- ---- responsável não confirma a própria presença ---------------------------
do $$ begin
  update bookings set partner_confirmed_at = now();
  assert (select count(*) from bookings where partner_confirmed_at is not null) = 0,
         'responsável não pode confirmar a própria presença';
end $$;

-- ---- confirmação do parceiro e extrato -------------------------------------
select set_config('request.jwt.claim.sub', :'arena', false);
do $$
declare v_booking bookings%rowtype; v_total int;
begin
  select * into v_booking from bookings where status = 'checked_in' limit 1;

  begin
    perform confirm_by_partner(v_booking.id, '000000');
    assert false, 'código errado deveria falhar';
  exception when others then
    assert sqlerrm = 'wrong_code', 'esperado wrong_code, veio: ' || sqlerrm;
  end;

  assert (select count(*) from partner_payouts) = 0, 'sem confirmação não há repasse';

  perform confirm_by_partner(v_booking.id, v_booking.check_in->>'code');
  select total_cents into v_total from partner_payouts where slot_kind = 'ociosa';
  assert v_total = 800, 'vaga ociosa deveria render 800 centavos, veio ' || coalesce(v_total::text,'nulo');
end $$;

-- ---- presença confirmada não rende XP de novo -------------------------------
-- Sem a guarda de 'completed', bastava repetir o check-in de uma aula já
-- confirmada para fabricar XP — e, com ele, Kidoo Bônus.
select set_config('request.jwt.claim.sub', :'ana', false);
do $$
declare v_id uuid; v_xp int;
begin
  select id into v_id from bookings
   where guardian_id = '11111111-1111-1111-1111-111111111111'
     and status = 'completed' limit 1;
  select xp into v_xp from children where id = 'aaaaaaaa-0000-0000-0000-000000000001';

  begin
    perform check_in(v_id, -19.9702, -43.9803, 15, false);
    assert false, 'reserva já confirmada não deveria aceitar check-in';
  exception when others then
    assert sqlerrm = 'already_confirmed', 'esperado already_confirmed, veio: ' || sqlerrm;
  end;

  assert (select xp from children where id = 'aaaaaaaa-0000-0000-0000-000000000001') = v_xp,
         'nenhum XP pode ter sido creditado';
end $$;

-- ---- um parceiro não confirma presença de outro ----------------------------
select set_config('request.jwt.claim.sub', '44444444-4444-4444-4444-444444444444', false);
do $$
declare v_id uuid;
begin
  select id into v_id from bookings where status = 'completed' limit 1;
  if v_id is not null then
    begin
      perform confirm_by_partner(v_id, '123456');
      assert false, 'Pampulha não pode confirmar presença da Arena';
    exception when others then
      assert sqlerrm in ('not_this_partner','booking_not_found'),
             'esperado not_this_partner, veio: ' || sqlerrm;
    end;
  end if;
end $$;

-- ---- virada de semana da cota ----------------------------------------------
-- A regra "coins não acumulam" só vale se o banco a aplicar. Enquanto ela viveu
-- só no cliente, um app que não recarrega gastava a cota da semana passada.
select set_config('request.jwt.claim.sub', :'ana', false);
do $$
declare v_sub subscriptions%rowtype;
begin
  -- gasta um pouco e joga o ciclo para a semana anterior
  update subscriptions set coins_remaining = 1, cycle_started_at = week_start(now()) - interval '7 days'
   where guardian_id = '11111111-1111-1111-1111-111111111111';

  v_sub := current_subscription();
  assert v_sub.coins_remaining = v_sub.coins_per_week,
         'a cota deveria voltar ao cheio na virada, veio ' || v_sub.coins_remaining;
  assert v_sub.cycle_started_at = week_start(now()), 'o ciclo deveria apontar para esta semana';

  -- dentro da mesma semana, ler de novo não devolve coin nenhum
  update subscriptions set coins_remaining = 2
   where guardian_id = '11111111-1111-1111-1111-111111111111';
  v_sub := current_subscription();
  assert v_sub.coins_remaining = 2, 'leitura não pode recarregar no meio da semana';
end $$;

-- ---- trocar de plano não devolve o que já foi gasto -------------------------
do $$
declare v_sub subscriptions%rowtype;
begin
  update subscriptions set plan_id = 'start', coins_per_week = 8, coins_remaining = 3
   where guardian_id = '11111111-1111-1111-1111-111111111111';

  -- gastou 5 dos 8; no Plus (12) deve sobrar 7, não 12
  v_sub := subscribe_plan('plus');
  assert v_sub.coins_per_week = 12, 'a cota vem da tabela de planos';
  assert v_sub.coins_remaining = 7,
         'trocar de plano não devolve o já gasto, veio ' || v_sub.coins_remaining;

  begin
    perform subscribe_plan('plano-inventado');
    assert false, 'plano inexistente deveria falhar';
  exception when others then
    assert sqlerrm = 'plan_not_found', 'esperado plan_not_found, veio: ' || sqlerrm;
  end;
end $$;

-- ---- avaliação: só quem foi, uma vez, com nome dado pelo servidor ---------
select set_config('request.jwt.claim.sub', :'ana', false);
do $$
declare v_id uuid; v_review reviews%rowtype; v_pendente uuid;
begin
  select id into v_id from bookings
   where guardian_id = '11111111-1111-1111-1111-111111111111'
     and status in ('checked_in','completed') limit 1;

  v_review := submit_review(v_id, 5, '  Turma pequena, adoramos.  ');
  assert v_review.author_name = 'Ana', 'o nome vem do servidor, veio ' || v_review.author_name;
  assert v_review.comment = 'Turma pequena, adoramos.', 'o comentário chega sem espaços nas pontas';
  assert (select review_count from activities where id = v_review.activity_id) = 1,
         'a avaliação atualiza a contagem do cartão';

  begin
    perform submit_review(v_id, 4, 'de novo');
    assert false, 'a mesma aula não pode ser avaliada duas vezes';
  exception when others then
    assert sqlerrm = 'already_reviewed', 'esperado already_reviewed, veio: ' || sqlerrm;
  end;

  -- reserva sem check-in não rende avaliação
  select id into v_pendente from bookings
   where guardian_id = '11111111-1111-1111-1111-111111111111' and status = 'confirmed' limit 1;
  if v_pendente is not null then
    begin
      perform submit_review(v_pendente, 5, 'nem fui');
      assert false, 'sem check-in não deveria avaliar';
    exception when others then
      assert sqlerrm = 'review_before_check_in', 'esperado review_before_check_in, veio: ' || sqlerrm;
    end;
  end if;

  -- e escrever direto na tabela não é opção: sem isso o nome seria do cliente
  begin
    insert into reviews (booking_id, activity_id, guardian_id, author_name, rating)
    values (v_id, v_review.activity_id, '11111111-1111-1111-1111-111111111111', 'Outra Pessoa', 1);
    assert false, 'insert direto em reviews deveria ser negado';
  exception when insufficient_privilege then
    null;
  end;
end $$;

-- ---- visões do catálogo ----------------------------------------------------
do $$
declare v_row activities_public%rowtype;
begin
  select * into v_row from activities_public
   where id = 'dddddddd-0000-0000-0000-00000000000a';
  assert v_row.partner_name = 'Arena Kids', 'a visão traz o parceiro junto';
  assert v_row.coin_cost = 2, 'o "a partir de" é o menor custo entre as turmas abertas';
  assert v_row.open_sessions > 0, 'a Arena tem turma aberta';
end $$;

-- Quem fecha a vaga é o parceiro: como Ana, o update nem chega a acontecer —
-- a RLS filtra a linha e o `update` some sem erro. É exatamente a garantia que
-- queremos, e por isso o teste troca de identidade em vez de contornar.
select set_config('request.jwt.claim.sub', :'arena', false);
do $$
declare v_row activities_public%rowtype;
begin
  update class_sessions set slots_taken = slots_open
   where activity_id = 'dddddddd-0000-0000-0000-00000000000a';

  select * into v_row from activities_public
   where id = 'dddddddd-0000-0000-0000-00000000000a';
  assert v_row.coin_cost is null and v_row.open_sessions = 0,
         'sem turma aberta a atividade não tem "a partir de"';

  -- e a turma do outro parceiro continua à venda: o filtro é por turma
  assert (select open_sessions from activities_public
           where id = 'dddddddd-0000-0000-0000-00000000000b') > 0,
         'fechar a Arena não pode fechar a Pampulha';
end $$;

reset role;
\echo 'todos os testes passaram'
