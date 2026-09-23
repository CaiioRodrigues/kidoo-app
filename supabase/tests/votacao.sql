-- ======================================================================
-- Votação com fotos: os estados, a cédula e a apuração.
--
-- O schema não sabe que a primeira votação é de fantasia de Halloween, e este
-- arquivo também não: se um dia for "melhor parceiro do ano", nada muda aqui.
--
-- O que importa provar:
--
--   1. a ordem dos estados, e que não dá para voltar;
--   2. um voto por categoria por votante, garantido pelo BANCO;
--   3. ninguém lê o placar antes da apuração — nem pela tabela, nem pela
--      função;
--   4. quem não é do Kidoo não abre nem fecha nada;
--   5. com papel numerado, a identidade é o NÚMERO: fora da faixa não vota,
--      "07" e "7" são a mesma pessoa, e quem organiza vê quais já votaram.
-- ======================================================================
\set admin '99999999-9999-9999-9999-999999999999'
\set ana   '11111111-1111-1111-1111-111111111111'

reset role;
insert into auth.users (id, email) values (:'admin', 'kidoo@exemplo.com') on conflict do nothing;
insert into kidoo_admins (user_id) values (:'admin') on conflict do nothing;

-- ---- quem não é do Kidoo não cria ------------------------------------
set role authenticated;
select set_config('request.jwt.claim.sub', :'ana', false);
do $$ begin
  begin
    perform create_poll('Festa da Ana', null, array['Melhor']);
    assert false, 'família não abre votação';
  exception when others then
    assert sqlerrm = 'not_admin', 'esperado not_admin, veio: ' || sqlerrm;
  end;
end $$;

-- ---- quem é do Kidoo cria, e já abre inscrições ----------------------
select set_config('request.jwt.claim.sub', :'admin', false);
do $$
declare v_id uuid;
begin
  begin
    perform create_poll('   ', null, array['Melhor']);
    assert false, 'votação sem título deveria falhar';
  exception when others then
    assert sqlerrm = 'title_required', 'esperado title_required, veio: ' || sqlerrm;
  end;

  begin
    perform create_poll('Festa', null, array[]::text[]);
    assert false, 'votação sem categoria não tem cédula';
  exception when others then
    assert sqlerrm = 'categories_required', 'esperado categories_required, veio: ' || sqlerrm;
  end;

  v_id := create_poll('Festa de Outubro', 'Vale tudo',
                      array['Melhor fantasia', 'Mais assustadora', 'Mais engraçada'],
                      'abobora');
  perform set_config('kidoo.poll', v_id::text, false);

  assert (select status from polls where id = v_id) = 'inscricoes',
         'criar já abre as inscrições: ninguém quer dois cliques para começar';
  assert (select count(*) from poll_categories where poll_id = v_id) = 3,
         'as três categorias entraram, na ordem que foram dadas';
end $$;

-- ---- qualquer um se inscreve, sem conta ------------------------------
reset role;
set role anon;
do $$
declare v_poll uuid := current_setting('kidoo.poll')::uuid;
begin
  perform submit_entry(v_poll, 'Bruxa da Ana',  'x/1.jpg');
  perform submit_entry(v_poll, 'Zumbi do Caio', 'x/2.jpg');
  perform submit_entry(v_poll, 'Palhaço da Bia','x/3.jpg');

  begin
    perform submit_entry(v_poll, '  ', 'x/4.jpg');
    assert false, 'inscrição sem nome deveria falhar';
  exception when others then
    assert sqlerrm = 'name_required', 'esperado name_required, veio: ' || sqlerrm;
  end;

  begin
    perform submit_entry(v_poll, 'Sem foto', '');
    assert false, 'a foto É a inscrição: sem ela não há o que votar';
  exception when others then
    assert sqlerrm = 'photo_required', 'esperado photo_required, veio: ' || sqlerrm;
  end;
end $$;

-- ---- votar antes da hora, não --------------------------------------
do $$
declare v_poll uuid := current_setting('kidoo.poll')::uuid;
begin
  begin
    perform cast_ballot(v_poll, 'aparelho-1', '{}'::jsonb, 'abobora');
    assert false, 'não dá para votar enquanto as inscrições estão abertas';
  exception when others then
    assert sqlerrm = 'voting_closed', 'esperado voting_closed, veio: ' || sqlerrm;
  end;
end $$;

-- ---- quem organiza libera a votação ---------------------------------
set role authenticated;
select set_config('request.jwt.claim.sub', :'ana', false);
do $$ begin
  begin
    perform advance_poll(current_setting('kidoo.poll')::uuid);
    assert false, 'família não libera votação';
  exception when others then
    assert sqlerrm = 'not_admin', 'esperado not_admin, veio: ' || sqlerrm;
  end;
end $$;

select set_config('request.jwt.claim.sub', :'admin', false);
do $$ begin
  assert advance_poll(current_setting('kidoo.poll')::uuid) = 'votacao',
         'de inscrições para votação';
end $$;

-- ---- a cédula --------------------------------------------------------
reset role;
set role anon;
do $$
declare
  v_poll uuid := current_setting('kidoo.poll')::uuid;
  v_cats uuid[];
  v_ents uuid[];
begin
  select array_agg(id order by position) into v_cats
    from poll_categories where poll_id = v_poll;
  select array_agg(id order by created_at) into v_ents
    from poll_entries where poll_id = v_poll;
  perform set_config('kidoo.cats', v_cats::text, false);
  perform set_config('kidoo.ents', v_ents::text, false);

  -- Senha errada não passa: é o que impede o link vazado de virar votação.
  begin
    perform cast_ballot(v_poll, 'aparelho-1',
      jsonb_build_object(v_cats[1]::text, v_ents[1]::text), 'errada');
    assert false, 'senha errada não vota';
  exception when others then
    assert sqlerrm = 'wrong_passphrase', 'esperado wrong_passphrase, veio: ' || sqlerrm;
  end;

  -- A cédula inteira de uma vez.
  perform cast_ballot(v_poll, 'aparelho-1', jsonb_build_object(
    v_cats[1]::text, v_ents[1]::text,
    v_cats[2]::text, v_ents[2]::text,
    v_cats[3]::text, v_ents[1]::text
  ), 'ABOBORA');  -- maiúscula: a senha não diferencia caixa
  assert has_voted(v_poll, 'aparelho-1'), 'a tela consegue saber que este aparelho já votou';
end $$;

-- ---- e o mesmo aparelho não vota de novo -----------------------------
do $$
declare
  v_poll uuid := current_setting('kidoo.poll')::uuid;
  v_cats uuid[] := current_setting('kidoo.cats')::uuid[];
  v_ents uuid[] := current_setting('kidoo.ents')::uuid[];
begin
  begin
    perform cast_ballot(v_poll, 'aparelho-1',
      jsonb_build_object(v_cats[1]::text, v_ents[2]::text), 'abobora');
    assert false, 'votar duas vezes na mesma categoria deveria falhar';
  exception when unique_violation then
    null;  -- quem barra é o índice, e é onde tem de ser
  end;
end $$;

-- ---- cédula forjada, com coisa de outra votação ----------------------
do $$
declare
  v_poll uuid := current_setting('kidoo.poll')::uuid;
  v_cats uuid[] := current_setting('kidoo.cats')::uuid[];
  v_outra uuid;
begin
  begin
    perform cast_ballot(v_poll, 'aparelho-9',
      jsonb_build_object(gen_random_uuid()::text, (current_setting('kidoo.ents')::uuid[])[1]::text),
      'abobora');
    assert false, 'categoria que não é desta votação não entra';
  exception when others then
    assert sqlerrm = 'category_not_in_poll', 'esperado category_not_in_poll, veio: ' || sqlerrm;
  end;

  begin
    perform cast_ballot(v_poll, 'aparelho-9',
      jsonb_build_object(v_cats[1]::text, gen_random_uuid()::text), 'abobora');
    assert false, 'inscrito que não é desta votação não recebe voto';
  exception when others then
    assert sqlerrm = 'entry_not_in_poll', 'esperado entry_not_in_poll, veio: ' || sqlerrm;
  end;
end $$;

-- ---- mais votos, de outros aparelhos ---------------------------------
do $$
declare
  v_poll uuid := current_setting('kidoo.poll')::uuid;
  v_cats uuid[] := current_setting('kidoo.cats')::uuid[];
  v_ents uuid[] := current_setting('kidoo.ents')::uuid[];
begin
  perform cast_ballot(v_poll, 'aparelho-2',
    jsonb_build_object(v_cats[1]::text, v_ents[1]::text), 'abobora');
  perform cast_ballot(v_poll, 'aparelho-3',
    jsonb_build_object(v_cats[1]::text, v_ents[2]::text), 'abobora');
end $$;

-- ---- ninguém vê o placar antes da apuração ---------------------------
do $$
declare v_poll uuid := current_setting('kidoo.poll')::uuid;
begin
  assert (select count(*) from poll_results(v_poll)) = 0,
         'placar parcial mudaria o voto de quem ainda não votou';

  begin
    perform count(*) from ballots;
    raise exception 'anon leu a urna: dá para saber em quem cada aparelho votou';
  exception when insufficient_privilege then
    null;
  end;
end $$;

-- ---- apurar ----------------------------------------------------------
set role authenticated;
select set_config('request.jwt.claim.sub', :'admin', false);
do $$
declare v_poll uuid := current_setting('kidoo.poll')::uuid;
begin
  assert advance_poll(v_poll) = 'apurada', 'de votação para apurada';

  -- E não dá para reabrir uma urna cujo resultado já se conhece.
  begin
    perform advance_poll(v_poll);
    assert false, 'votação apurada não volta';
  exception when others then
    assert sqlerrm = 'already_counted', 'esperado already_counted, veio: ' || sqlerrm;
  end;
end $$;

-- ---- o pódio ---------------------------------------------------------
reset role;
set role anon;
do $$
declare
  v_poll uuid := current_setting('kidoo.poll')::uuid;
  v_cats uuid[] := current_setting('kidoo.cats')::uuid[];
  v_linha record;
begin
  assert (select count(*) from poll_results(v_poll)) > 0, 'apurada, o resultado aparece';

  select * into v_linha from poll_results(v_poll)
   where category_id = v_cats[1] and place = 1;
  assert v_linha.votes = 2, 'a Bruxa teve dois votos em Melhor fantasia, veio ' || v_linha.votes;
  assert v_linha.entry = 'Bruxa da Ana', 'e é ela em primeiro, veio ' || v_linha.entry;

  -- Quem não recebeu voto nenhum fica de fora: pódio não é lista de chamada.
  assert (select count(*) from poll_results(v_poll) where category_id = v_cats[1]) = 2,
         'só os votados entram no pódio';
end $$;

-- ======================================================================
-- Segunda votação: com papel sorteado na porta.
--
-- O papel diz `MORCEGO 84`, e é isso que a pessoa digita. O número dele
-- continua sendo a identidade por baixo — é o que mantém o índice único, a
-- grade de quem organiza e a apuração intactos.
-- ======================================================================
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub', :'admin', false);

do $$
declare v_poll uuid;
begin
  begin
    perform create_poll('Festa numerada', null, array['Melhor'], 'senha', 1);
    assert false, 'faixa de um papel não é faixa';
  exception when others then
    assert sqlerrm = 'invalid_range', 'esperado invalid_range, veio: ' || sqlerrm;
  end;

  v_poll := create_poll('Festa com papel', 'dez convidados',
                        array['Melhor fantasia'], 'abobora', 10);
  perform set_config('kidoo.poll2', v_poll::text, false);
end $$;

-- A tabela dos papéis é fechada até para quem organiza — ele chega por
-- função. Estas conferências são sobre o SORTEIO, então rodam como dono.
reset role;
do $$
declare v_poll uuid := current_setting('kidoo.poll2')::uuid;
begin
  assert (select count(*) from poll_tickets where poll_id = v_poll) = 10,
         'dez papéis, um por convidado';
  -- Código repetido seriam duas pessoas com a mesma chave. O índice único
  -- garante, e isto confere que o sorteio não depende da sorte para isso.
  assert (select count(distinct word) from poll_tickets where poll_id = v_poll) = 10,
         'e os dez códigos são diferentes';
  assert (select count(*) from poll_tickets
           where poll_id = v_poll and label ~ '^[A-ZÁÂÃÉÊÍÓÔÕÚÇ]+ [0-9]{2}$') = 10,
         'o papel sai no formato PALAVRA 00';

  -- Os dois códigos que o teste de quem vota vai usar.
  perform set_config('kidoo.papel1',
    (select label from poll_tickets where poll_id = v_poll and number = 3), false);
  perform set_config('kidoo.papel2',
    (select label from poll_tickets where poll_id = v_poll and number = 7), false);
end $$;

-- ---- inscrever e liberar ---------------------------------------------
reset role;
set role anon;
do $$
declare v_e1 uuid;
begin
  v_e1 := submit_entry(current_setting('kidoo.poll2')::uuid, 'Múmia do João', 'votacao/m.jpg');
  perform set_config('kidoo.ent2', v_e1::text, false);
end $$;

reset role;
set role authenticated;
select set_config('request.jwt.claim.sub', :'admin', false);
do $$
declare v_linha record;
begin
  perform advance_poll(current_setting('kidoo.poll2')::uuid);

  -- Quem organiza vê os papéis para imprimir, e nenhum votou ainda.
  select count(*) filter (where not voted) as faltam, count(*) as total
    into v_linha from poll_tickets_admin(current_setting('kidoo.poll2')::uuid);
  assert v_linha.total = 10 and v_linha.faltam = 10, 'dez papéis, nenhum usado';
end $$;

-- ---- o código é a identidade ------------------------------------------
reset role;
set role anon;
do $$
declare
  v_poll  uuid := current_setting('kidoo.poll2')::uuid;
  v_ent   uuid := current_setting('kidoo.ent2')::uuid;
  v_cat   uuid := (select id from poll_categories where poll_id = v_poll);
  v_ced   jsonb;
  v_papel text := current_setting('kidoo.papel1');
begin
  v_ced := jsonb_build_object(v_cat::text, v_ent::text);

  -- Quem vota não lê a lista de códigos. Se lesse, teria os papéis de todos.
  begin
    perform count(*) from poll_tickets;
    raise exception 'anon leu os papéis: teria a chave de todo mundo';
  exception when insufficient_privilege then
    null;
  end;

  -- Adivinhar deixou de ser contar até dez.
  begin
    perform cast_ballot(v_poll, '7', v_ced, 'abobora');
    assert false, 'o número sozinho não abre mais a urna';
  exception when others then
    assert sqlerrm = 'invalid_ticket', 'esperado invalid_ticket, veio: ' || sqlerrm;
  end;
  begin
    perform cast_ballot(v_poll, 'palavra que ninguem sorteou', v_ced, 'abobora');
    assert false, 'código que não existe não vota';
  exception when others then
    assert sqlerrm = 'invalid_ticket', 'esperado invalid_ticket, veio: ' || sqlerrm;
  end;

  -- E digitar do jeito que sai no celular às duas da manhã funciona: sem
  -- acento, sem espaço, em qualquer caixa.
  perform cast_ballot(v_poll, '  ' || lower(replace(v_papel, ' ', '-')) || ' ', v_ced, 'abobora');
  assert has_voted(v_poll, v_papel), 'o papel ' || v_papel || ' votou';
  assert not has_voted(v_poll, current_setting('kidoo.papel2')), 'e o outro não';

  -- O mesmo papel não vota de novo, escrito de outro jeito.
  begin
    perform cast_ballot(v_poll, upper(v_papel), v_ced, 'abobora');
    assert false, 'o mesmo papel não vota duas vezes';
  exception when unique_violation then
    null;
  end;

  -- Outro papel no MESMO aparelho: a festa toda vota no celular de quem tem
  -- bateria. Um voto por papel, não por telefone.
  perform cast_ballot(v_poll, current_setting('kidoo.papel2'), v_ced, 'abobora');
end $$;

-- ---- quem organiza vê quais papéis votaram ----------------------------
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub', :'admin', false);
do $$
declare
  v_poll  uuid := current_setting('kidoo.poll2')::uuid;
  v_linha record;
begin
  select * into v_linha from admin_polls() where id = v_poll;
  assert v_linha.voter_numbers = 10, 'a faixa aparece para quem organiza';
  assert v_linha.voters = 2, 'dois papéis votaram, veio ' || v_linha.voters;
  assert v_linha.voted_numbers @> array['3', '7'],
         'e são o 3 e o 7, veio ' || array_to_string(v_linha.voted_numbers, ',');

  -- A folha de impressão marca os mesmos dois.
  assert (select array_agg(number order by number) from poll_tickets_admin(v_poll) where voted)
         = array[3, 7], 'a folha de papéis marca quem já votou';

  select * into v_linha from admin_polls() where id = current_setting('kidoo.poll')::uuid;
  assert v_linha.voted_numbers is null, 'sem faixa, sem lista de números';
end $$;

-- ======================================================================
-- Terceira votação: a numerada de antes, que já teve papel impresso.
--
-- Papel entregue não se recolhe. Uma festa criada antes desta migration
-- continua valendo pelo número — e é por isso que o caminho antigo fica.
-- ======================================================================
reset role;
do $$
declare
  v_poll uuid;
  v_cat  uuid;
  v_ent  uuid;
begin
  insert into polls (title, status, voter_numbers) values ('Festa antiga', 'votacao', 10)
  returning id into v_poll;
  insert into poll_categories (poll_id, label) values (v_poll, 'Melhor') returning id into v_cat;
  insert into poll_entries (poll_id, name, photo_path) values (v_poll, 'Alguém', 'x.jpg')
  returning id into v_ent;

  perform cast_ballot(v_poll, '07', jsonb_build_object(v_cat::text, v_ent::text));
  assert has_voted(v_poll, '7'), 'sem papéis sorteados, o número continua valendo';

  begin
    perform cast_ballot(v_poll, '11', jsonb_build_object(v_cat::text, v_ent::text));
    assert false, 'e a faixa continua conferida';
  exception when others then
    assert sqlerrm = 'number_out_of_range', 'esperado number_out_of_range, veio: ' || sqlerrm;
  end;
end $$;

reset role;
\echo 'votação: todos os testes passaram'
