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
--   4. quem não é do Kidoo não abre nem fecha nada.
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

reset role;
\echo 'votação: todos os testes passaram'
