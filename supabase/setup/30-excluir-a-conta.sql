-- =====================================================================
-- Kidoo — a família consegue apagar a própria conta.
--
-- Para um banco que JÁ EXISTE, e DEPOIS da 29. Cole inteiro no SQL Editor do
-- Supabase e clique em Run. É idempotente.
--
-- O Perfil prometia a exclusão "a qualquer momento, conforme a LGPD" e não
-- havia por onde pedir. Além de ser o que a lei garante, é exigência de loja:
-- o Google Play pede exclusão de conta feita de dentro do app.
--
-- MUDA AS CHAVES DE `bookings`. `guardian_id` e `child_id` passam a aceitar
-- nulo, e a chave vira `on delete set null` em vez de `on delete cascade`.
-- Sem isso, apagar a família levaria junto as aulas que já foram pagas a
-- parceiros de verdade, e o extrato de quem recebeu passaria a mentir.
-- =====================================================================

begin;

alter table bookings alter column guardian_id drop not null;
alter table bookings alter column child_id    drop not null;

do $$
begin
  -- Pelo nome que o Postgres dá às chaves criadas em `create table`.
  alter table bookings drop constraint if exists bookings_guardian_id_fkey;
  alter table bookings drop constraint if exists bookings_child_id_fkey;

  alter table bookings
    add constraint bookings_guardian_id_fkey
    foreign key (guardian_id) references guardians (id) on delete set null;
  alter table bookings
    add constraint bookings_child_id_fkey
    foreign key (child_id) references children (id) on delete set null;
end $$;

-- ----------------------------------------------------------- a exclusão ----

/**
 * Apaga a conta de quem chamou, e tudo que identifica a família.
 *
 * `security definer` porque precisa alcançar `auth.users`, que nenhum cliente
 * alcança — e porque a ordem importa: feito pela tela, tabela a tabela, uma
 * falha no meio deixaria a conta pela metade.
 *
 * Não recebe id. Recebe `auth.uid()`. Uma função de exclusão que aceita "qual
 * conta" é uma função de exclusão de contas alheias esperando o primeiro erro
 * de quem a chama.
 */
create or replace function delete_my_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  -- 1 · A vaga do que ainda não aconteceu volta para a turma.
  --
  -- `slots_taken` é contador, não contagem: apagar a linha da reserva sem
  -- mexer nele deixaria a turma ocupada para sempre por uma criança que não
  -- existe mais. Mesmo desconto que `cancel_booking` faz.
  update class_sessions s
     set slots_taken = greatest(0, s.slots_taken - 1)
    from bookings b
   where b.session_id = s.id
     and b.guardian_id = v_user
     and b.status = 'confirmed'
     and b.scheduled_at >= now()
     and b.partner_confirmed_at is null;

  -- 2 · Some o que NÃO é registro financeiro: o que foi cancelado e o que
  -- ainda não aconteceu. Nada disso gerou pagamento a ninguém.
  delete from reviews where guardian_id = v_user;
  delete from bookings
   where guardian_id = v_user
     and (status = 'cancelled'
          or (status = 'confirmed' and scheduled_at >= now()
              and partner_confirmed_at is null));

  -- 3 · O resto da família. As reservas que sobraram perdem o vínculo por
  -- `on delete set null` — não some linha nenhuma do extrato do parceiro.
  delete from session_waitlist where guardian_id = v_user;
  delete from push_tokens     where user_id     = v_user;
  delete from subscriptions   where guardian_id = v_user;
  delete from children        where guardian_id = v_user;
  delete from guardians       where id          = v_user;

  -- 4 · A conta. `guardians.id` referencia `auth.users` em cascata, então
  -- isto também cobre o caso de a linha acima já ter ido embora.
  delete from auth.users where id = v_user;
end;
$$;

grant execute on function delete_my_account() to authenticated;

commit;

-- ---------------------------------------------------------- conferir -------

-- As chaves de `bookings` passaram a anonimizar em vez de apagar em cascata.
select conname,
       confdeltype = 'n' as apaga_o_vinculo_e_nao_a_linha
  from pg_constraint
 where conrelid = 'bookings'::regclass
   and conname in ('bookings_guardian_id_fkey', 'bookings_child_id_fkey')
 order by conname;

-- E a função existe, alcançável por quem está logado.
select to_regprocedure('public.delete_my_account()') is not null as existe,
       has_function_privilege('authenticated', 'public.delete_my_account()', 'execute') as a_familia_chama;
