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
  -- Ana tem dois filhos e a Lia é do Bruno: a asserção prova que a RLS corta
  -- por responsável, e não que a tabela tem uma linha só.
  assert (select count(*) from children)  = 2, 'Ana deveria ver os 2 filhos dela, e só';
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

  -- Turma sem vaga recusa. Com a IRMÃ, não com a mesma criança: repetir o
  -- Joao aqui dispararia `already_booked` antes, e o teste passaria a medir a
  -- ordem das checagens em vez da lotação.
  begin
    perform book_session('eeeeeeee-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000002');
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
  -- a turma do Pampulha tem 2 vagas: aqui quem barra é a regra, não a capacidade
  v_booking := book_session('eeeeeeee-0000-0000-0000-000000000002','aaaaaaaa-0000-0000-0000-000000000001');
  begin
    perform book_session('eeeeeeee-0000-0000-0000-000000000002','aaaaaaaa-0000-0000-0000-000000000001');
    assert false, 'a mesma criança não pode ocupar dois lugares na mesma turma';
  exception when others then
    assert sqlerrm = 'already_booked', 'esperado already_booked, veio: ' || sqlerrm;
  end;

  -- A vaga não pode ser consumida pela tentativa recusada: `book_session`
  -- incrementa slots_taken antes do insert, e se a recusa acontecesse depois
  -- disso sem rollback, cada toque a mais comeria um lugar do parceiro.
  assert (select slots_taken from class_sessions where id='eeeeeeee-0000-0000-0000-000000000002') = 1,
         'tentativa recusada não pode consumir vaga';

  perform cancel_booking(v_booking.id);

  -- Depois de cancelar, o índice libera: a coluna status entra na condição
  -- parcial, e desistir de uma aula não pode trancar a turma para sempre.
  v_booking := book_session('eeeeeeee-0000-0000-0000-000000000002','aaaaaaaa-0000-0000-0000-000000000001');
  assert v_booking.id is not null, 'cancelada não pode contar como lugar ocupado';
  perform cancel_booking(v_booking.id);

  -- Irmãos na mesma turma: a regra é por criança, não por família. Se fosse por
  -- família, o segundo filho ficaria de fora da aula do primeiro.
  v_booking := book_session('eeeeeeee-0000-0000-0000-000000000002','aaaaaaaa-0000-0000-0000-000000000001');
  declare v_irma bookings%rowtype;
  begin
    v_irma := book_session('eeeeeeee-0000-0000-0000-000000000002','aaaaaaaa-0000-0000-0000-000000000002');
    assert v_irma.id is not null, 'dois irmãos podem ocupar dois lugares na mesma turma';
    perform cancel_booking(v_irma.id);
  end;
  perform cancel_booking(v_booking.id);
end $$;

-- ---- o índice, e não a função, é a garantia contra corrida ----------------
-- `book_session` checa antes de inserir, mas entre a checagem e o insert cabe
-- outra transação. Quem impede de verdade é `one_seat_per_child`. Provar isso
-- exige furar a RLS, que barraria o insert direto antes de a unique ser
-- consultada — daí o `reset role`.
reset role;
do $$
declare v_id uuid;
begin
  insert into bookings (guardian_id, child_id, session_id, activity_id,
                        scheduled_at, coin_cost, slot_kind, payment)
  values ('11111111-1111-1111-1111-111111111111','aaaaaaaa-0000-0000-0000-000000000001',
          'eeeeeeee-0000-0000-0000-000000000003','dddddddd-0000-0000-0000-00000000000a',
          now() + interval '10 minutes', 2, 'ociosa', '{}'::jsonb)
  returning id into v_id;

  begin
    insert into bookings (guardian_id, child_id, session_id, activity_id,
                          scheduled_at, coin_cost, slot_kind, payment)
    values ('11111111-1111-1111-1111-111111111111','aaaaaaaa-0000-0000-0000-000000000001',
            'eeeeeeee-0000-0000-0000-000000000003','dddddddd-0000-0000-0000-00000000000a',
            now() + interval '10 minutes', 2, 'ociosa', '{}'::jsonb);
    assert false, 'one_seat_per_child precisa barrar o segundo lugar';
  exception when unique_violation then null;
  end;

  -- Cancelada sai da condição parcial do índice: o mesmo par volta a caber.
  update bookings set status = 'cancelled' where id = v_id;
  insert into bookings (guardian_id, child_id, session_id, activity_id,
                        scheduled_at, coin_cost, slot_kind, payment)
  values ('11111111-1111-1111-1111-111111111111','aaaaaaaa-0000-0000-0000-000000000001',
          'eeeeeeee-0000-0000-0000-000000000003','dddddddd-0000-0000-0000-00000000000a',
          now() + interval '10 minutes', 2, 'ociosa', '{}'::jsonb)
  returning id into v_id;
  delete from bookings where session_id = 'eeeeeeee-0000-0000-0000-000000000003';
end $$;
set role authenticated;
select set_config('request.jwt.claim.sub', :'ana', false);

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
  -- Guardado na sessão porque cada bloco `do` tem escopo próprio, e a
  -- conferência do crédito acontece só depois da confirmação do parceiro.
  perform set_config('kidoo.xp_antes', v_xp_antes::text, false);

  -- turma daqui a 10 min: dentro da janela
  v_booking := book_session('eeeeeeee-0000-0000-0000-000000000003','aaaaaaaa-0000-0000-0000-000000000001');
  v_booking := check_in_booking(v_booking.id, 40, false);
  assert v_booking.status = 'checked_in', 'o check-in deveria valer';
  assert (v_booking.check_in_proof->>'locationVerified')::boolean, 'leitura a 40 m é verificada';
  -- Chegar não vale XP. Quem diz que a criança veio é quem a recebeu — e
  -- sem isso, negar a permissão de GPS seria uma fábrica de Kidoo Bônus:
  -- o portão de distância deixa passar quem não tem leitura.
  assert (select xp from children where id = 'aaaaaaaa-0000-0000-0000-000000000001') = v_xp_antes,
         'o check-in NÃO credita XP; isso é da confirmação do parceiro';

  -- longe demais, com leitura confiável, é recusado
  begin
    perform check_in_booking(v_booking.id, 12000, false);
    assert false, 'a 12 km deveria recusar';
  exception when others then
    assert sqlerrm = 'too_far_from_venue', 'esperado too_far_from_venue, veio: ' || sqlerrm;
  end;
end $$;

-- ---- o check-in avisa quanto entra depois, e não credita nada --------------
do $$
declare v_id uuid; v_out jsonb;
begin
  select id into v_id from bookings
   where guardian_id = '11111111-1111-1111-1111-111111111111'
     and status = 'checked_in' limit 1;

  -- já entrou: reemite o código e não credita nada
  v_out := check_in(v_id, -19.9702, -43.9803, 15, false);
  assert (v_out->>'xpOnConfirm')::int = 100, 'o app precisa saber quanto entra na confirmação';
  assert v_out->'booking'->>'reward' is null, 'nada de recompensa antes de o parceiro confirmar';
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

  v_booking := confirm_by_partner(v_booking.id, v_booking.check_in->>'code');

  select total_cents into v_total from partner_payouts where slot_kind = 'ociosa';
  assert v_total = 800, 'vaga ociosa deveria render 800 centavos, veio ' || coalesce(v_total::text,'nulo');

  -- O parceiro não lê `children` — e não deve mesmo. O que ele enxerga é a
  -- recompensa gravada na reserva; o XP em si é conferido do lado da família,
  -- mais abaixo.
  assert (v_booking.reward->>'xpEarned')::int = 100,
         'a reserva guarda o que a confirmação rendeu, para o app comemorar depois';
  assert v_booking.check_in is null, 'o código morre ao ser usado';

  -- Anular o código já barraria a segunda tentativa; a guarda explícita existe
  -- para o erro dizer a verdade a quem está no balcão.
  begin
    perform confirm_by_partner(v_booking.id, '123456');
    assert false, 'confirmar duas vezes deveria falhar';
  exception when others then
    assert sqlerrm = 'already_confirmed', 'esperado already_confirmed, veio: ' || sqlerrm;
  end;
  -- e a recompensa gravada continua sendo a de uma confirmação só
  assert (select (reward->>'xpEarned')::int from bookings where id = v_booking.id) = 100,
         'a segunda tentativa não pode ter creditado nada';
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

  -- E o crédito que a confirmação gerou, conferido de quem tem direito a ver:
  -- 100 a mais que antes do check-in.
  assert v_xp = current_setting('kidoo.xp_antes')::int + 100,
         'a confirmação do parceiro creditou 100 de XP, veio ' || v_xp;
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
  -- Encher a turma aqui é fixture, não estado final: guardamos o que havia
  -- para devolver no fim. Sem isso, o próximo bloco herda turmas cheias sem
  -- reserva nenhuma por trás — um estado que o produto nunca produz, e que
  -- faz o teste seguinte falhar por um motivo que não é dele.
  create temp table if not exists slots_antes as
    select id, slots_taken from class_sessions
     where activity_id = 'dddddddd-0000-0000-0000-00000000000a';

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

  update class_sessions c
     set slots_taken = a.slots_taken
    from slots_antes a
   where c.id = a.id;
  drop table slots_antes;
end $$;

-- ---- fila de espera e o aviso ----------------------------------------------
-- A turma da Arena tem 1 vaga. A Ana toma; Bruno e Maria entram na fila; a Ana
-- cancela. É a transição de cheia para com-vaga que precisa gerar o aviso.
select set_config('request.jwt.claim.sub', :'ana', false);
do $$
declare v_ana bookings%rowtype;
begin
  v_ana := book_session('eeeeeeee-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000001');
  perform set_config('kidoo.reserva_ana', v_ana.id::text, false);

  -- Quem já tem lugar não entra na fila: o aviso iria para quem não precisa.
  begin
    perform join_waitlist('eeeeeeee-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000001');
    assert false, 'quem já reservou não pode entrar na espera';
  exception when others then
    assert sqlerrm = 'already_booked', 'esperado already_booked, veio: ' || sqlerrm;
  end;

  -- Turma com vaga também não: a fila só é avisada na abertura, então esperar
  -- numa turma que já tem lugar é aguardar um aviso que nunca chega.
  begin
    perform join_waitlist('eeeeeeee-0000-0000-0000-000000000003','aaaaaaaa-0000-0000-0000-000000000002');
    assert false, 'turma com vaga não deveria aceitar espera';
  exception when others then
    assert sqlerrm = 'session_has_room', 'esperado session_has_room, veio: ' || sqlerrm;
  end;

  -- A irmã espera pela turma cheia: dois na fila é o que permite provar que
  -- reservar tira UM da fila e deixa o outro.
  perform join_waitlist('eeeeeeee-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000002');
end $$;

select set_config('request.jwt.claim.sub', :'bruno', false);
do $$ begin
  perform join_waitlist('eeeeeeee-0000-0000-0000-000000000001','bbbbbbbb-0000-0000-0000-000000000001');
  assert (select count(*) from my_waitlist()) = 1, 'o Bruno deveria estar esperando 1 turma';
end $$;

-- A espera é de quem a criou. Sem isto, a fila viraria uma lista aberta de
-- quem está de olho em qual horário.
select set_config('request.jwt.claim.sub', :'ana', false);
do $$ begin
  assert (select count(*) from my_waitlist()) = 1, 'Ana vê a própria espera, não a do Bruno';
  assert (select child_id from my_waitlist()) = 'aaaaaaaa-0000-0000-0000-000000000002',
         'e a que ela vê é a da filha dela';
end $$;

-- Sair da fila. Não havia teste nenhum aqui, e foi por um vizinho desse buraco
-- que o app passou a acusar "não foi possível sair da fila" DEPOIS de ter
-- saído: `leave_waitlist` não devolve nada, e o adapter tratava resposta vazia
-- como erro. O contrato cobre aquele lado; este cobre este.
select set_config('request.jwt.claim.sub', :'bruno', false);
do $$ begin
  -- Ninguém tira a espera de outra família: o delete filtra pelo responsável,
  -- então pedir a saída da criança da Ana não faz nada — e não falha, porque
  -- não há o que contar a Bruno sobre a fila dela.
  perform leave_waitlist('eeeeeeee-0000-0000-0000-000000000001',
                         'aaaaaaaa-0000-0000-0000-000000000002');
  assert (select count(*) from my_waitlist()) = 1,
         'e a própria espera do Bruno continua onde estava';

  perform leave_waitlist('eeeeeeee-0000-0000-0000-000000000001',
                         'bbbbbbbb-0000-0000-0000-000000000001');
  assert (select count(*) from my_waitlist()) = 0, 'Bruno saiu da fila';

  -- Sair de novo não é erro: o botão pode ser tocado duas vezes, e a segunda
  -- não pode virar uma tela vermelha.
  perform leave_waitlist('eeeeeeee-0000-0000-0000-000000000001',
                         'bbbbbbbb-0000-0000-0000-000000000001');
end $$;

select set_config('request.jwt.claim.sub', :'ana', false);
do $$ begin
  assert (select count(*) from my_waitlist()) = 1,
         'a espera da Ana sobreviveu à saída do Bruno';
end $$;

-- Bruno volta para a fila: os testes seguintes contam com dois esperando.
select set_config('request.jwt.claim.sub', :'bruno', false);
do $$ begin
  perform join_waitlist('eeeeeeee-0000-0000-0000-000000000001','bbbbbbbb-0000-0000-0000-000000000001');
end $$;

select set_config('request.jwt.claim.sub', :'ana', false);

-- O entregador precisa de privilégio na tabela, e não só de ignorar a RLS.
-- Ignorar RLS é uma coisa; ter `grant` é outra, e vem antes — sem ele o
-- Postgres barra no privilégio e a Edge Function nunca lê a caixa. Foi assim
-- que a fila encheu, o gatilho funcionou, a função rodou a cada cinco minutos
-- e nenhum aviso chegou, sem nada no banco parecer errado.
reset role;
do $$ begin
  assert has_table_privilege('service_role', 'push_outbox', 'select'),
         'o entregador precisa LER a caixa de saída';
  assert has_table_privilege('service_role', 'push_outbox', 'update'),
         'e MARCAR o que já saiu, senão reenviaria para sempre';
  assert has_table_privilege('service_role', 'push_tokens', 'select'),
         'e achar o aparelho de quem espera';
  assert has_table_privilege('service_role', 'push_tokens', 'delete'),
         'e apagar token de app desinstalado';

  -- E nada além disso: quem escreve aviso é o gatilho, quem registra aparelho
  -- é a família por `register_push_token`.
  assert not has_table_privilege('service_role', 'push_outbox', 'insert'),
         'o entregador não escreve aviso';
  assert not has_table_privilege('service_role', 'push_tokens', 'insert'),
         'nem registra aparelho';
end $$;
set role authenticated;

-- A caixa de saída é fechada para o app: quem entrega usa a chave de serviço.
do $$ begin
  begin
    perform count(*) from push_outbox;
    assert false, 'a caixa de saída não pode ser legível pelo app';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Mexer na turma SEM abrir vaga não avisa ninguém. É o que separa "avisar na
-- transição" de "avisar a cada update": aqui a fila está com notified_at nulo
-- e a turma continua cheia, então um gatilho sem a checagem dispararia.
select set_config('request.jwt.claim.sub', :'arena', false);
do $$ begin
  update class_sessions set slots_open = slots_open
   where id = 'eeeeeeee-0000-0000-0000-000000000001';
end $$;
reset role;
do $$ begin
  assert (select count(*) from push_outbox) = 0,
         'update que não abre vaga não pode gerar aviso';
end $$;
set role authenticated;

select set_config('request.jwt.claim.sub', :'ana', false);
do $$ begin
  perform cancel_booking(current_setting('kidoo.reserva_ana')::uuid);
end $$;

reset role;
do $$ begin
  assert (select count(*) from push_outbox) = 2,
         'a vaga abriu: os dois da fila precisam ser avisados';
  assert (select count(*) from push_outbox
           where guardian_id = '22222222-2222-2222-2222-222222222222') = 1,
         'o aviso vai para quem estava esperando, não para quem cancelou';
  assert (select bool_and(title like 'Vagou um lugar em %') from push_outbox),
         'o aviso precisa dizer de qual atividade se trata';
  assert (select bool_and(data->>'sessionId' = 'eeeeeeee-0000-0000-0000-000000000001')
            from push_outbox),
         'o aviso carrega a turma, para o toque abrir a tela certa';
  assert (select count(*) from session_waitlist where notified_at is null) = 0,
         'os dois precisam ficar marcados como avisados';
end $$;
set role authenticated;

-- Quem pega a vaga sai da fila; quem não pegou continua esperando.
select set_config('request.jwt.claim.sub', :'bruno', false);
do $$ begin
  perform book_session('eeeeeeee-0000-0000-0000-000000000001','bbbbbbbb-0000-0000-0000-000000000001');
  assert (select count(*) from my_waitlist()) = 0, 'reservar precisa tirar da fila';
end $$;

reset role;
do $$ begin
  assert (select count(*) from session_waitlist
           where session_id='eeeeeeee-0000-0000-0000-000000000001') = 1,
         'a espera da irmã não podia sumir com a reserva do Bruno';
  assert (select child_id from session_waitlist
           where session_id='eeeeeeee-0000-0000-0000-000000000001')
           = 'aaaaaaaa-0000-0000-0000-000000000002',
         'quem continua na fila é quem não reservou';
  assert (select notified_at from session_waitlist
           where session_id='eeeeeeee-0000-0000-0000-000000000001') is null,
         'encheu de novo: o aviso tem de rearmar para a próxima abertura';
  assert (select count(*) from push_outbox) = 2, 'encher a turma não avisa ninguém';
end $$;

reset role;
\echo 'todos os testes passaram'
