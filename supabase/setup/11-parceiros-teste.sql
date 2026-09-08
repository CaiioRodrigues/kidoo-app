-- =====================================================================
-- Kidoo — parceiros a distâncias conhecidas, para testar o GPS de verdade.
--
-- O portão de proximidade nunca foi testado com uma leitura real. Testar
-- exige uma coisa que parceiro de mentira espalhado pela cidade não dá:
-- saber, antes de tocar no botão, se aquele check-in DEVERIA passar.
--
-- Então em vez de inventar endereços, este arquivo cria cinco parceiros a
-- deslocamentos medidos a partir de UM ponto que você escolhe — de onde
-- você vai estar quando testar. Aí cada toque tem resposta esperada:
--
--   Teste GPS 0 m     → tem de PASSAR
--   Teste GPS 150 m   → tem de PASSAR
--   Teste GPS 400 m   → PODE IR DOS DOIS JEITOS (leia o porquê abaixo)
--   Teste GPS 900 m   → tem de BLOQUEAR "Você ainda não chegou no local"
--   Teste GPS 15 km   → tem de BLOQUEAR (o caso "fiz de casa")
--
-- Por que 400 m não tem resposta certa, e 900 tem:
--
-- O raio é de 250 m, mas a regra não compara a distância crua. Ela desconta
-- a margem de erro antes — `distância − precisão > 250` — e essa margem é
-- grande de propósito: a precisão que o aparelho declara (50 a 100 m com
-- `Accuracy.Balanced`) mais 80 m do arredondamento que fazemos ao guardar a
-- coordenada, para nunca ter a posição exata da família no aparelho.
--
-- Somando, a margem fica entre 130 e 180 m. A 400 m sobram de 220 a 270 m
-- efetivos, e o portão está exatamente em 250: com sinal bom bloqueia, com
-- sinal ruim passa. Isso é o desenho funcionando (a dúvida conta a favor de
-- quem está chegando), não defeito. A 900 m sobram no mínimo 620 m, e aí não
-- tem margem de erro que salve.
--
-- As turmas começam daqui a 10 minutos, dentro da janela de check-in (que
-- abre 45 min antes e fecha 90 min depois). Ou seja: dá para testar agora.
--
-- Para APAGAR tudo isto depois, no fim do arquivo tem o comando.
-- =====================================================================

do $$
declare
  -- ------------------------------------------------------------------
  -- EDITE DAQUI
  -- ------------------------------------------------------------------
  -- Onde VOCÊ vai estar na hora do teste. Google Maps: botão direito sobre
  -- o ponto, e copie os dois números.
  v_latitude   double precision := -19.9702;
  v_longitude  double precision := -43.9803;

  -- A conta de parceiro que vai confirmar os códigos no painel. Use a mesma
  -- do 02-primeiro-parceiro.sql — sem isto os parceiros existem para o app
  -- da família, mas ninguém consegue fechar o ciclo confirmando a presença.
  v_email      text := 'parceiro@exemplo.com';
  -- ------------------------------------------------------------------
  -- ATÉ AQUI
  -- ------------------------------------------------------------------

  -- Um grau de latitude são ~111.320 m em qualquer longitude. Deslocar só a
  -- latitude evita a correção por cosseno e deixa a conta exata o bastante
  -- para um raio de 250 m.
  METRO_EM_GRAUS constant double precision := 1.0 / 111320.0;

  v_user_id     uuid;
  v_partner_id  uuid;
  v_activity_id uuid;
  v_medido      int;
  v_caso        record;
begin
  select id into v_user_id from auth.users where lower(email) = lower(v_email);
  if v_user_id is null then
    raise exception
      'Não existe usuário com o e-mail %. Crie em Authentication → Users, ou ajuste v_email.',
      v_email;
  end if;

  for v_caso in
    select * from (values
      (    0, 'Teste GPS 0 m',   'PASSAR'),
      (  150, 'Teste GPS 150 m', 'PASSAR'),
      (  400, 'Teste GPS 400 m', 'DEPENDER DO SINAL'),
      (  900, 'Teste GPS 900 m', 'BLOQUEAR'),
      (15000, 'Teste GPS 15 km', 'BLOQUEAR')
    ) as t(metros, nome, esperado)
  loop
    insert into partners (name, neighborhood, city, verified, latitude, longitude)
    values (v_caso.nome, 'Teste', 'Belo Horizonte', true,
            v_latitude + v_caso.metros * METRO_EM_GRAUS, v_longitude)
    returning id into v_partner_id;

    insert into partner_members (partner_id, user_id, role)
    values (v_partner_id, v_user_id, 'owner');

    insert into payout_rates (partner_id, kind, amount_cents) values
      (v_partner_id, 'ociosa', 800),
      (v_partner_id, 'cheia',  1800);

    insert into activities (partner_id, category_id, title, min_age, max_age, description, tags)
    values (v_partner_id, 'futebol', v_caso.nome, 3, 12,
            'Parceiro de teste a ' || v_caso.metros || ' m do ponto escolhido. '
            || 'O check-in aqui deve ' || v_caso.esperado || '.',
            array['teste'])
    returning id into v_activity_id;

    -- Três turmas: uma agora (para testar já) e duas nos próximos dias, para
    -- a tira de dias ter o que mostrar.
    insert into class_sessions (activity_id, starts_at, capacity, enrolled, slots_open, coin_cost)
    values
      (v_activity_id, now() + interval '10 minutes', 20, 11, 5, 1),
      (v_activity_id, (current_date + 2) + time '17:00' at time zone 'America/Sao_Paulo',
       20, 11, 5, 1),
      (v_activity_id, (current_date + 4) + time '09:00' at time zone 'America/Sao_Paulo',
       20, 11, 5, 1);

    -- A conferência que importa: a distância medida pela MESMA função que o
    -- check-in usa. Se ela não bater com o rótulo, o problema é aqui e não no
    -- aparelho — e é bem melhor descobrir agora do que na calçada.
    select round(distance_m(v_latitude, v_longitude,
                            v_latitude + v_caso.metros * METRO_EM_GRAUS, v_longitude))
      into v_medido;

    raise notice '% → esperado % m, o banco mede % m (check-in deve %)',
      rpad(v_caso.nome, 16), v_caso.metros, v_medido, v_caso.esperado;
  end loop;

  raise notice '---';
  raise notice 'Pronto. No app, busque por "Teste GPS" no Explorar.';
  raise notice 'Reserve nas cinco, vá até o ponto que você escolheu e tente o check-in em cada uma.';
  raise notice 'Depois, a prova de que a leitura chegou:';
  raise notice '  select a.title, b.check_in_proof->>''distanceM'' as medido,';
  raise notice '         b.check_in_proof->>''locationVerified'' as conferido';
  raise notice '    from bookings b join activities a on a.id = b.activity_id';
  -- `%` é placeholder do raise: dentro do texto ele precisa ser dobrado.
  raise notice '   where a.title like ''Teste GPS%%'' order by b.checked_in_at desc;';
end $$;

-- =====================================================================
-- Para apagar tudo depois (uma linha, roda numa query separada):
--
--   delete from partners where name like 'Teste GPS%';
--
-- As atividades, turmas e reservas somem junto por cascade.
-- =====================================================================
