-- =====================================================================
-- Kidoo — zerar o teste e preparar uma aula nova.
--
-- Apaga as reservas da família de teste, devolve o XP e os coins ao
-- ponto de partida, libera as vagas e cria uma turma começando daqui a
-- 25 minutos — já dentro da janela de check-in, que abre 45 minutos
-- antes e fecha 90 depois.
--
-- NÃO use isto num banco com família de verdade: ele apaga reservas.
-- =====================================================================

do $$
declare
  -- ------------------------------------------------------------------
  -- EDITE: o e-mail da conta de FAMÍLIA que você usou para testar
  -- (não o teste@kidoo.app, que é o do parceiro)
  -- ------------------------------------------------------------------
  v_email text := 'familia@exemplo.com';
  -- ------------------------------------------------------------------

  v_guardian    uuid;
  v_activity_id uuid;
  v_quando      timestamptz := now() + interval '25 minutes';
  v_apagadas    int;
  v_criancas    int;
begin
  select id into v_guardian from auth.users where lower(email) = lower(v_email);
  if v_guardian is null then
    raise exception 'Não existe conta com o e-mail %. Confira em Authentication → Users.', v_email;
  end if;

  -- As vagas voltam para as turmas de onde saíram.
  update class_sessions s
     set slots_taken = greatest(0, s.slots_taken - reservas.quantas)
    from (select session_id, count(*) as quantas
            from bookings
           where guardian_id = v_guardian and status <> 'cancelled'
           group by session_id) as reservas
   where s.id = reservas.session_id;

  delete from bookings where guardian_id = v_guardian;
  get diagnostics v_apagadas = row_count;

  -- XP e bônus ao ponto de partida. O bônus é lote datado: apagar é mais
  -- honesto do que zerar o saldo e deixar lotes vazios no extrato.
  delete from bonus_grants g
   using children c
   where g.child_id = c.id and c.guardian_id = v_guardian;

  update children set xp = 0 where guardian_id = v_guardian;
  get diagnostics v_criancas = row_count;

  -- Cota semanal cheia de novo.
  update subscriptions
     set coins_remaining = coins_per_week, cycle_started_at = week_start(now())
   where guardian_id = v_guardian;

  -- E uma turma nova, começando já.
  select a.id into v_activity_id
    from activities a join partners p on p.id = a.partner_id
   where p.name = 'Academia Arena Kids'
   order by a.created_at limit 1;

  if v_activity_id is null then
    raise exception 'Não achei a atividade da Academia Arena Kids.';
  end if;

  insert into class_sessions (activity_id, starts_at, capacity, enrolled, slots_open, coin_cost)
  values (v_activity_id, v_quando, 20, 11, 5, 2);

  raise notice 'Pronto: % reserva(s) apagada(s), % criança(s) com XP zerado, cota cheia.',
    v_apagadas, v_criancas;
  raise notice 'Turma nova às %. Check-in aberto agora, fecha às %.',
    to_char(v_quando at time zone 'America/Sao_Paulo', 'HH24:MI'),
    to_char((v_quando + interval '90 minutes') at time zone 'America/Sao_Paulo', 'HH24:MI');
end $$;
