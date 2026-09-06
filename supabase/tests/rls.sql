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

reset role;
\echo 'todos os testes passaram'
