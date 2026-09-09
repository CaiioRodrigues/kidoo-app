-- =====================================================================
-- Kidoo — por que o cadastro de parceiro não anda?
--
-- Três coisas diferentes se parecem com "não consigo cadastrar":
--
--   1. As tabelas do cadastro não existem neste banco (faltou o 10-atualizar).
--   2. A conta foi criada, mas parou na confirmação de e-mail que não chegou.
--   3. O pedido foi enviado e está esperando alguém aprovar — e ninguém pode,
--      porque nenhuma conta está em `kidoo_admins`.
--
-- Rode **um bloco de cada vez** e leia a resposta antes de ir ao próximo. O
-- editor do Supabase mostra só o resultado do último comando.
-- =====================================================================


-- --------------------------------------------------------------- 1 de 3 ---
-- As peças existem? Qualquer `false` aqui explica tudo sozinho: rode o
-- `10-atualizar.sql` inteiro e volte.

select 'partner_applications (tabela do pedido)' as peca,
       to_regclass('public.partner_applications') is not null as existe
union all
select 'kidoo_admins (quem pode aprovar)',
       to_regclass('public.kidoo_admins') is not null
union all
select 'approve_application()',
       exists (select 1 from pg_proc where proname = 'approve_application')
union all
select 'pending_applications()',
       exists (select 1 from pg_proc where proname = 'pending_applications')
union all
select 'class_sessions_visible (o app lê as turmas daqui)',
       to_regclass('public.class_sessions_visible') is not null
order by 1;


-- --------------------------------------------------------------- 2 de 3 ---
-- As contas chegaram até o fim? `PAROU NO E-MAIL` é conta criada cujo link de
-- confirmação nunca foi aberto — quase sempre porque o e-mail não chegou.

select email,
       created_at,
       email_confirmed_at,
       case when email_confirmed_at is null
            then 'PAROU NO E-MAIL'
            else 'confirmada' end as situacao
  from auth.users
 order by created_at desc
 limit 10;


-- --------------------------------------------------------------- 3 de 3 ---
-- Onde cada pedido parou, e se existe alguém para aprová-lo.
-- Sem linha em `kidoo_admins`, o pedido fica pendente para sempre: rode o
-- `13-quem-aprova.sql`.

select p.status,
       p.name,
       p.city,
       u.email as dono_do_pedido,
       p.created_at,
       (select count(*) from kidoo_admins) as admins_cadastrados
  from partner_applications p
  join auth.users u on u.id = p.user_id
 order by p.created_at desc
 limit 10;
