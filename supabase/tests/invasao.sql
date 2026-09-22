-- ========================================================================
-- Invasão: o que uma conta comum consegue fazer se tentar de propósito.
--
-- `rls.sql` testa o produto funcionando — reservar, cancelar, confirmar. Este
-- arquivo testa o produto sendo atacado: um token de família legítimo, e
-- todos os pedidos que a tela nunca faria.
--
-- Ele existe porque foi assim que se descobriu que, com UM `update`, qualquer
-- pessoa com conta destravava a própria assinatura e se dava 9999 coins. A
-- RLS estava certa o tempo todo: a policy diz "as SUAS linhas", e eram as
-- linhas dela. Quem estava aberto era o GRANT — e nenhum teste olhava para
-- grant, porque todos perguntavam "o app consegue?" e nenhum perguntava "o
-- que mais consegue?".
--
-- A diferença entre negar por falta de policy e negar por falta de grant
-- importa na hora de ler a falha: sem policy o Postgres devolve zero linhas
-- em silêncio; sem grant ele devolve `permission denied`. Os dois são
-- negação, e este arquivo aceita os dois — o que ele não aceita é a escrita
-- acontecer.
-- ========================================================================

\set ana  '11111111-1111-1111-1111-111111111111'
\set bruno '22222222-2222-2222-2222-222222222222'

set role authenticated;
select set_config('request.jwt.claim.sub', :'ana', false);

-- ------------------------------------------------------------------------
-- Escrever no que decide dinheiro.
-- ------------------------------------------------------------------------
do $$
declare
  r record;
  v_erro text;
  v_afetadas int;
  v_ataques text[][] := array[
    ['destravar a própria assinatura',
     $q$update subscriptions set status = 'ativa' where guardian_id = '11111111-1111-1111-1111-111111111111'$q$],
    ['se dar coins',
     $q$update subscriptions set coins_remaining = 9999 where guardian_id = '11111111-1111-1111-1111-111111111111'$q$],
    ['empurrar o vencimento para dez anos',
     $q$update subscriptions set renews_at = now() + interval '10 years' where guardian_id = '11111111-1111-1111-1111-111111111111'$q$],
    ['emitir Kidoo Bônus para si mesma',
     $q$insert into bonus_grants (child_id, amount, remaining, level, expires_at)
        select id, 500, 500, 25, now() + interval '10 years' from children
         where guardian_id = '11111111-1111-1111-1111-111111111111' limit 1$q$],
    ['esticar a validade do bônus que já tem',
     $q$update bonus_grants set expires_at = now() + interval '10 years'$q$],
    ['inventar XP para a criança',
     $q$update children set xp = 999999 where guardian_id = '11111111-1111-1111-1111-111111111111'$q$],
    ['cadastrar criança já com XP',
     $q$insert into children (guardian_id, name, birth_date, gender, xp)
        values ('11111111-1111-1111-1111-111111111111','Trapaça','2018-01-01','undisclosed',999999)$q$],
    ['trocar o e-mail e descolar do auth',
     $q$update guardians set email = 'outro@exemplo.com' where id = '11111111-1111-1111-1111-111111111111'$q$],
    ['confirmar a própria presença',
     $q$update bookings set partner_confirmed_at = now(), status = 'completed' where guardian_id = '11111111-1111-1111-1111-111111111111'$q$],
    ['apagar a própria reserva para sumir com o rastro',
     $q$delete from bookings where guardian_id = '11111111-1111-1111-1111-111111111111'$q$],
    ['virar sócia de um estabelecimento',
     $q$insert into partner_members (partner_id, user_id)
        values ('cccccccc-0000-0000-0000-00000000000a','11111111-1111-1111-1111-111111111111')$q$],
    ['virar admin do Kidoo',
     $q$insert into kidoo_admins (user_id) values ('11111111-1111-1111-1111-111111111111')$q$],
    ['se declarar estabelecimento verificado',
     $q$update partners set verified = true where id = 'cccccccc-0000-0000-0000-00000000000a'$q$],
    ['mudar o preço de uma turma',
     $q$update class_sessions set coin_cost = 0$q$],
    ['escrever avaliação no nome de outra pessoa',
     $q$insert into reviews (booking_id, activity_id, guardian_id, author_name, rating)
        select id, activity_id, '22222222-2222-2222-2222-222222222222', 'Outra Pessoa', 1 from bookings limit 1$q$]
  ];
begin
  for i in 1 .. array_length(v_ataques, 1) loop
    begin
      execute v_ataques[i][2];
      get diagnostics v_afetadas = row_count;
      if v_afetadas > 0 then
        raise exception 'ATAQUE PASSOU (% linha(s)): %', v_afetadas, v_ataques[i][1];
      end if;
    exception
      when insufficient_privilege then null;          -- negado pelo grant
      when check_violation then null;                 -- negado pela policy
      when others then
        v_erro := sqlerrm;
        if v_erro like 'ATAQUE PASSOU%' then raise; end if;
        if v_erro like '%row-level security%' or v_erro like '%permission denied%'
           or v_erro like '%does not exist%' then
          null;  -- negado, ou a coluna nem existe mais
        else
          raise exception 'ataque "%" falhou por outro motivo: %', v_ataques[i][1], v_erro;
        end if;
    end;
  end loop;
end $$;

-- ------------------------------------------------------------------------
-- Ler o que é de outra família.
-- ------------------------------------------------------------------------
do $$
declare
  v_tabela text;
  v_linhas int;
begin
  foreach v_tabela in array array['guardians','children','subscriptions','bonus_grants','bookings'] loop
    begin
      execute format(
        'select count(*) from %I where %s',
        v_tabela,
        case v_tabela
          when 'guardians' then 'id = ''22222222-2222-2222-2222-222222222222'''
          when 'bonus_grants' then 'child_id in (select id from children where guardian_id = ''22222222-2222-2222-2222-222222222222'')'
          else 'guardian_id = ''22222222-2222-2222-2222-222222222222'''
        end
      ) into v_linhas;
    exception when insufficient_privilege then
      v_linhas := 0;  -- sem grant é negação também
    end;
    if v_linhas > 0 then
      raise exception 'Ana leu % linha(s) de % que são do Bruno', v_linhas, v_tabela;
    end if;
  end loop;
end $$;

-- ------------------------------------------------------------------------
-- Abrir as caixas de saída.
-- ------------------------------------------------------------------------
/*
  `push_outbox` e `email_outbox` não são de ninguém: não têm `guardian_id` nem
  `user_id`, então não há policy de dono para escrever. Elas são fechadas por
  ausência — RLS ligada e policy nenhuma — e alcançáveis só pelo entregador,
  que usa a chave de serviço.

  Fechar por ausência é frágil de um jeito específico: um `grant` distraído em
  qualquer migration futura abre a tabela inteira, e nada na tela denuncia.
  `email_outbox` guarda endereço de e-mail e o motivo pelo qual um negócio foi
  recusado — não é dado de criança, mas é dado de gente que não escolheu
  publicá-lo.
*/
do $$
declare
  v_tabela text;
  v_linhas int;
begin
  foreach v_tabela in array array['push_outbox','email_outbox'] loop
    begin
      execute format('select count(*) from %I', v_tabela) into v_linhas;
    exception when insufficient_privilege then
      v_linhas := 0;  -- sem grant é negação também
    end;
    if v_linhas > 0 then
      raise exception 'Ana leu % linha(s) de %, que é da chave de serviço',
                      v_linhas, v_tabela;
    end if;
  end loop;

  -- E escrever é pior que ler: uma linha forjada aqui manda e-mail com o
  -- remetente do Kidoo para o endereço que o atacante escolher.
  begin
    insert into email_outbox (to_email, kind, data)
    values ('atacante@exemplo.com', 'pedido_aprovado', '{}'::jsonb);
    raise exception 'Ana enfileirou um e-mail em nome do Kidoo';
  exception
    when insufficient_privilege then null;
    when others then
      if sqlerrm like '%row-level security%' then null; else raise; end if;
  end;
end $$;

-- ------------------------------------------------------------------------
-- Chamar as RPCs de administração sem ser administradora.
-- ------------------------------------------------------------------------
/*
  Negar tem duas formas aqui, e as duas valem.

  As RPCs que só leem filtram com `is_kidoo_admin()` dentro do `where`: quem
  não é admin recebe lista vazia. As que escrevem levantam `not_admin`. O que
  este bloco cobra não é a forma — é que nada volte. Minha primeira versão
  exigia a exceção, e reprovou o `pending_applications`, que estava certo.
*/
do $$
declare
  v_chamadas text[] := array[
    'select * from pending_applications()',
    'select * from admin_partners()',
    'select * from admin_subscriptions()',
    $q$select set_partner_active('cccccccc-0000-0000-0000-00000000000a', false)$q$,
    $q$select set_subscription_status('11111111-1111-1111-1111-111111111111', 'ativa')$q$
  ];
  v_linhas int;
begin
  for i in 1 .. array_length(v_chamadas, 1) loop
    begin
      execute format('select count(*) from (%s) t', v_chamadas[i]) into v_linhas;
      if v_linhas > 0 then
        raise exception 'RPC de admin devolveu % linha(s) a quem não é admin: %',
          v_linhas, v_chamadas[i];
      end if;
    exception when others then
      if sqlerrm like 'RPC de admin devolveu%' then raise; end if;
      if sqlerrm not like '%not_admin%' then
        raise exception 'esperado not_admin ou lista vazia em "%", veio: %',
          v_chamadas[i], sqlerrm;
      end if;
    end;
  end loop;
end $$;

-- ------------------------------------------------------------------------
-- Texto malicioso onde o app aceita texto.
--
-- Não há SQL dinâmico em função nenhuma do banco — todo parâmetro é variável
-- plpgsql dentro de instrução estática, então injeção em SQL é impossível por
-- construção. O que este bloco garante é que continua assim: se alguém um dia
-- montar SQL com `format()` sobre um parâmetro, estas cargas quebram.
-- ------------------------------------------------------------------------
reset role;
insert into auth.users (id, email) values
  ('dddddddd-0000-0000-0000-000000000001', 'invasor@exemplo.com') on conflict do nothing;
insert into guardians (id, name, email, city) values
  ('dddddddd-0000-0000-0000-000000000001', 'Invasor', 'invasor@exemplo.com', 'BH') on conflict do nothing;
set role authenticated;
select set_config('request.jwt.claim.sub', 'dddddddd-0000-0000-0000-000000000001', false);

do $$
declare
  v_carga text;
  v_cargas text[] := array[
    $q$'; drop table children; --$q$,
    $q$' or 1=1 --$q$,
    $q$x'); update subscriptions set coins_remaining = 9999; --$q$,
    $q$%' union select * from guardians --$q$,
    $q$<script>alert(1)</script>$q$
  ];
begin
  foreach v_carga in array v_cargas loop
    begin
      -- `submit_review` é a única RPC que aceita texto livre da família.
      perform submit_review('00000000-0000-0000-0000-000000000000', 5, v_carga);
    exception when others then
      -- Recusar é o esperado: a reserva não existe. O que não pode é a carga
      -- ter efeito colateral.
      null;
    end;
  end loop;

  if not exists (select 1 from information_schema.tables where table_name = 'children') then
    raise exception 'a tabela children sumiu: injeção em SQL funcionou';
  end if;
end $$;

-- ------------------------------------------------------------------------
-- O Storage: a foto da criança é de quem?
--
-- Estas policies existiam desde a migration 000011 e NUNCA tinham rodado num
-- teste: `run.sh` não criava o schema `storage`, as migrations checam
-- `to_regclass('storage.objects')` e voltavam sem criar nada. A regra que
-- impede um responsável de abrir a foto do filho de outra família era, até
-- aqui, uma regra que ninguém nunca executou.
--
-- O bloco tem as duas metades de propósito. Só negar passaria com uma policy
-- que nega tudo — inclusive o dono, que aí não conseguiria trocar a própria
-- foto e o app quebraria sem nenhum teste acusar.
-- ------------------------------------------------------------------------
reset role;
insert into storage.objects (bucket_id, name) values
  ('criancas',     '22222222-2222-2222-2222-222222222222/filho-do-bruno.jpg'),
  ('responsaveis', '22222222-2222-2222-2222-222222222222/perfil.jpg'),
  ('criancas',     '11111111-1111-1111-1111-111111111111/filha-da-ana.jpg'),
  -- A foto do pedido de outro candidato. Ela saiu do bucket público na
  -- migration 000023: enquanto esteve em `atividades`, qualquer um com a URL
  -- abria — sem login, sem policy no caminho.
  ('pedidos',      'eeee0000-0000-0000-0000-000000000001/espaco')
on conflict do nothing;

set role authenticated;
select set_config('request.jwt.claim.sub', :'ana', false);

do $$
declare v_linhas int;
begin
  -- Ler a foto da criança de outra família.
  select count(*) into v_linhas from storage.objects
   where bucket_id = 'criancas'
     and name like '22222222-2222-2222-2222-222222222222/%';
  if v_linhas > 0 then
    raise exception 'Ana enxerga % foto(s) de criança de outra família', v_linhas;
  end if;

  -- Ler a foto do responsável de outra família.
  select count(*) into v_linhas from storage.objects
   where bucket_id = 'responsaveis'
     and name like '22222222-2222-2222-2222-222222222222/%';
  if v_linhas > 0 then
    raise exception 'Ana enxerga % foto(s) de responsável de outra família', v_linhas;
  end if;

  -- Ler a foto do espaço de um candidato a parceiro.
  select count(*) into v_linhas from storage.objects
   where bucket_id = 'pedidos'
     and name like 'eeee0000-0000-0000-0000-000000000001/%';
  if v_linhas > 0 then
    raise exception 'Ana enxerga a foto do pedido de um candidato a parceiro';
  end if;

  -- E a própria, que TEM de aparecer: policy que nega tudo também passaria
  -- nos testes acima, e quebraria a troca de foto no app.
  select count(*) into v_linhas from storage.objects
   where bucket_id = 'criancas'
     and name like '11111111-1111-1111-1111-111111111111/%';
  if v_linhas <> 1 then
    raise exception 'Ana deveria ver a foto da própria filha, veio %', v_linhas;
  end if;
end $$;

do $$
declare v_ataques text[][] := array[
    ['escrever na pasta de outra família',
     $q$insert into storage.objects (bucket_id, name)
        values ('criancas', '22222222-2222-2222-2222-222222222222/invadida.jpg')$q$],
    ['trocar a foto de outra família',
     $q$update storage.objects set name = 'roubada.jpg'
        where bucket_id = 'criancas'
          and name like '22222222-2222-2222-2222-222222222222/%'$q$],
    ['subir imagem na pasta de um estabelecimento que não é seu',
     $q$insert into storage.objects (bucket_id, name)
        values ('atividades', 'cccccccc-0000-0000-0000-00000000000a/falsa.jpg')$q$],
    ['escrever na pasta de pedido de outro candidato',
     $q$insert into storage.objects (bucket_id, name)
        values ('pedidos', 'eeee0000-0000-0000-0000-000000000001/espaco')$q$],
    ['apagar a foto de outra família',
     $q$delete from storage.objects
        where bucket_id = 'responsaveis'
          and name like '22222222-2222-2222-2222-222222222222/%'$q$]
  ];
  v_afetadas int;
begin
  for i in 1 .. array_length(v_ataques, 1) loop
    begin
      execute v_ataques[i][2];
      get diagnostics v_afetadas = row_count;
      if v_afetadas > 0 then
        raise exception 'ATAQUE PASSOU no Storage (% linha(s)): %', v_afetadas, v_ataques[i][1];
      end if;
    exception
      when insufficient_privilege then null;
      when check_violation then null;
      when others then
        if sqlerrm like 'ATAQUE PASSOU%' then raise; end if;
        if sqlerrm not like '%row-level security%' and sqlerrm not like '%permission denied%' then
          raise exception 'ataque "%" falhou por outro motivo: %', v_ataques[i][1], sqlerrm;
        end if;
    end;
  end loop;
end $$;

reset role;
\echo 'invasão: nenhum ataque passou'
