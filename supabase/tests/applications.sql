
-- ======================================================================
-- Cadastro do parceiro: o pedido, e quem pode transformá-lo em parceiro.
-- ======================================================================
\set dono '55555555-5555-5555-5555-555555555555'
\set admin '66666666-6666-6666-6666-666666666666'

reset role;
insert into auth.users (id, email) values
  (:'dono',  'novo@escolinha.com'),
  (:'admin', 'kidoo@exemplo.com')
on conflict do nothing;
insert into kidoo_admins (user_id) values (:'admin') on conflict do nothing;

set role authenticated;

-- ---- o pedido nasce como pedido, não como parceiro ---------------------
select set_config('request.jwt.claim.sub', :'dono', false);
do $$
declare v_id uuid; v_parceiros int;
begin
  select count(*) into v_parceiros from partners;

  insert into partner_applications
    (user_id, name, neighborhood, city, address, latitude, longitude, phone,
     categories, min_age, max_age, cnpj)
  values (auth.uid(), 'Escolinha do Bairro', 'Buritis', 'Belo Horizonte',
          'Rua Exemplo, 100', -19.97, -43.98, '31999990000',
          array['futebol','judo'], 4, 12, '12.345.678/0001-90')
  returning id into v_id;
  perform set_config('kidoo.pedido', v_id::text, false);

  assert (select count(*) from partners) = v_parceiros,
         'pedido não pode criar parceiro nenhum';
  assert (select status from partner_applications where id = v_id) = 'pendente',
         'todo pedido nasce pendente';
end $$;

-- ---- dois pedidos abertos, não ----------------------------------------
do $$ begin
  begin
    insert into partner_applications
      (user_id, name, neighborhood, city, address, latitude, longitude, phone,
       categories, min_age, max_age)
    values (auth.uid(), 'Outra', 'B', 'BH', 'R. 2', -19.9, -43.9, '319',
            array['futebol'], 4, 12);
    assert false, 'não pode haver dois pedidos abertos da mesma conta';
  exception when unique_violation then
    null;
  end;
end $$;

-- ---- ninguém aprova o próprio pedido ------------------------------------
do $$
declare v_id uuid := current_setting('kidoo.pedido')::uuid;
begin
  -- Pela função: o portão é `is_kidoo_admin`.
  begin
    perform approve_application(v_id);
    assert false, 'candidato não aprova o próprio pedido';
  exception when others then
    assert sqlerrm = 'not_admin', 'esperado not_admin, veio: ' || sqlerrm;
  end;

  -- E direto na tabela: a policy tem `with check (status = 'pendente')`, então
  -- o update passa sem erro e simplesmente não muda o status. O que importa é
  -- o resultado, não a mensagem.
  begin
    update partner_applications set status = 'aprovado' where id = v_id;
  exception when others then null;
  end;
  assert (select status from partner_applications where id = v_id) = 'pendente',
         'o dono do pedido não vira aprovado por conta própria';
end $$;

-- ---- o pedido de um não é visto pelo outro ------------------------------
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
do $$ begin
  assert (select count(*) from partner_applications) = 0,
         'pedido é do dono e de quem analisa, não de qualquer um';
  assert (select count(*) from pending_applications()) = 0,
         'e a fila de análise não abre para quem não é do Kidoo';
end $$;

-- ---- quem é do Kidoo vê a fila e aprova ---------------------------------
select set_config('request.jwt.claim.sub', :'admin', false);
do $$
declare
  v_id      uuid := current_setting('kidoo.pedido')::uuid;
  v_parceiro partners%rowtype;
  v_linha   record;
begin
  assert (select count(*) from pending_applications()) = 1, 'o pedido está na fila';
  select * into v_linha from pending_applications() limit 1;
  assert v_linha.email = 'novo@escolinha.com',
         'a fila traz o e-mail da conta, que não sai por PostgREST';

  v_parceiro := approve_application(v_id);
  assert v_parceiro.verified, 'aprovado nasce verificado';
  assert v_parceiro.name = 'Escolinha do Bairro', 'com o nome do pedido';
  perform set_config('kidoo.parceiro', v_parceiro.id::text, false);

  assert (select status from partner_applications where id = v_id) = 'aprovado';
  assert (select count(*) from pending_applications()) = 0, 'e sai da fila';

  -- Aprovar de novo criaria um segundo estabelecimento igual.
  begin
    perform approve_application(v_id);
    assert false, 'aprovar duas vezes deveria falhar';
  exception when others then
    assert sqlerrm = 'already_approved', 'esperado already_approved, veio: ' || sqlerrm;
  end;
end $$;

-- O que a aprovação criou. Conferido como dono do banco de propósito: quem
-- analisa não é membro do estabelecimento novo, então a RLS de
-- `partner_members` esconderia dele as linhas — e o teste mediria o silêncio
-- da policy em vez do efeito da função.
reset role;
do $$
declare v_p uuid := current_setting('kidoo.parceiro')::uuid;
begin
  assert (select role from partner_members where partner_id = v_p) = 'owner',
         'quem pediu vira dono do estabelecimento';
  assert (select count(*) from activities where partner_id = v_p) = 2,
         'uma atividade por modalidade pedida';
  assert (select count(*) from payout_rates where partner_id = v_p) = 2,
         'e o repasse padrão das duas espécies de vaga';
  assert (select amount_cents from payout_rates
           where partner_id = v_p and kind = 'ociosa') = 800,
         'o valor é o padrão da casa, não o que o candidato pediu';
end $$;
set role authenticated;

-- ---- o aprovado já opera o painel ---------------------------------------
select set_config('request.jwt.claim.sub', :'dono', false);
do $$
declare v_ativ uuid;
begin
  assert (select count(*) from partner_agenda(now(), now() + interval '30 days')) = 0,
         'estabelecimento novo começa sem turma';
  select id into v_ativ from activities a
   where exists (select 1 from partner_members m
                  where m.partner_id = a.partner_id and m.user_id = auth.uid())
   limit 1;
  perform publish_session(v_ativ, now() + interval '2 days', 20, 9, 5, 2);
  assert (select count(*) from partner_agenda(now(), now() + interval '30 days')) = 1,
         'e publica turma no dia seguinte à aprovação';
end $$;

-- ---- recusa exige motivo, e o motivo volta para quem pediu --------------
select set_config('request.jwt.claim.sub', :'dono', false);
do $$
declare v_id uuid;
begin
  insert into partner_applications
    (user_id, name, neighborhood, city, address, latitude, longitude, phone,
     categories, min_age, max_age)
  values (auth.uid(), 'Quadra sem nome', 'B', 'BH', 'R. 3', -19.9, -43.9, '319',
          array['futebol'], 4, 12)
  returning id into v_id;
  perform set_config('kidoo.pedido2', v_id::text, false);
end $$;

select set_config('request.jwt.claim.sub', :'admin', false);
do $$
declare v_id uuid := current_setting('kidoo.pedido2')::uuid;
begin
  begin
    perform reject_application(v_id, '   ');
    assert false, 'recusa sem motivo deveria falhar';
  exception when others then
    assert sqlerrm = 'reason_required', 'esperado reason_required, veio: ' || sqlerrm;
  end;

  perform reject_application(v_id, 'Endereço não confere com o CNPJ.');
end $$;

select set_config('request.jwt.claim.sub', :'dono', false);
do $$
declare v_id uuid := current_setting('kidoo.pedido2')::uuid;
begin
  assert (select reason from partner_applications where id = v_id)
         = 'Endereço não confere com o CNPJ.',
         'quem pediu lê por que foi recusado';
  -- E consegue corrigir e reenviar: sem isso a recusa seria um beco.
  update partner_applications
     set address = 'Rua Certa, 500', status = 'pendente' where id = v_id;
  assert (select status from partner_applications where id = v_id) = 'pendente',
         'corrigir e reenviar volta o pedido para a fila';
end $$;

-- ---- modalidade inventada não vira atividade ----------------------------
-- A modalidade é lista fechada: uma inventada viraria atividade que o app não
-- sabe desenhar — sem ícone, sem cor e fora de todo filtro.
--
-- (A troca de papel fica FORA do bloco: o psql não substitui `:variavel`
-- dentro de `$$ ... $$`, e a tentativa daria erro de sintaxe.)
select set_config('request.jwt.claim.sub', :'dono', false);
update partner_applications set categories = array['parkour-radical']
 where id = current_setting('kidoo.pedido2')::uuid;

select set_config('request.jwt.claim.sub', :'admin', false);
do $$
declare v_id uuid := current_setting('kidoo.pedido2')::uuid;
begin
  begin
    perform approve_application(v_id);
    assert false, 'modalidade fora da lista deveria falhar';
  exception when others then
    assert sqlerrm = 'unknown_category', 'esperado unknown_category, veio: ' || sqlerrm;
  end;
end $$;

reset role;
\echo 'cadastro do parceiro: todos os testes passaram'
