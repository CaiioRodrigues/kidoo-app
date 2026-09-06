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

-- ---- responsável não escreve em reserva ------------------------------------
-- Confirmar presença é do parceiro. Se o responsável pudesse editar a própria
-- reserva, ele assinaria a própria presença e o repasse viraria autodeclaração.
do $$ begin
  perform book_session('eeeeeeee-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000001');
  update bookings set partner_confirmed_at = now();
  assert (select count(*) from bookings where partner_confirmed_at is not null) = 0,
         'responsável não pode confirmar a própria presença';
end $$;

-- ---- extrato: só presença confirmada pelo parceiro paga --------------------
select set_config('request.jwt.claim.sub', :'arena', false);
do $$
declare v_total int;
begin
  assert (select count(*) from partner_payouts) = 0, 'sem confirmação não há repasse';

  update bookings set partner_confirmed_at = now(), status = 'completed'
   where activity_id = 'dddddddd-0000-0000-0000-00000000000a' and status = 'confirmed';

  select total_cents into v_total from partner_payouts where slot_kind = 'ociosa';
  assert v_total = 800, 'vaga ociosa deveria render 800 centavos, veio ' || coalesce(v_total::text,'nulo');

  update bookings set status = 'cancelled' where partner_confirmed_at is not null;
  assert (select count(*) from partner_payouts) = 0, 'reserva cancelada não pode aparecer no extrato';
end $$;

reset role;
\echo 'todos os testes passaram'
