-- =====================================================================
-- Kidoo — o que já está neste banco.
--
-- Não muda nada. Cole no SQL Editor do Supabase e clique em Run: cada
-- linha é um dos arquivos de atualização, e `ja_rodou` diz se ele já
-- passou por aqui.
--
--   t = já rodou, não precisa rodar de novo
--   f = falta
--
-- Rode a partir do primeiro `f`, em ordem. Os arquivos são idempotentes,
-- então repetir um que já rodou não quebra nada — só gasta tempo.
--
-- Existe porque "qual eu já rodei?" é uma pergunta que se faz semanas
-- depois, e a resposta estava espalhada em dez blocos de conferência
-- diferentes, um no fim de cada arquivo.
--
-- Cada linha procura a MARCA do arquivo: a coluna, o tipo, o bucket ou o
-- `grant` que só existe depois dele. Não há tabela de controle de
-- migration aqui, e criar uma agora mentiria sobre os bancos que já
-- existem — eles não teriam registro nenhum do que já rodou.
--
-- ATENÇÃO, arquivo novo em `supabase/setup/`: acrescente a linha dele
-- aqui. Sem isso, esta consulta continua respondendo — e passa a mentir
-- por omissão, que é pior do que não existir.
-- =====================================================================

select '19-endereco-e-telefone' as arquivo,
       exists (select 1 from information_schema.columns
                where table_name = 'partners' and column_name = 'address') as ja_rodou

union all select '20-parceiro-fora',
       exists (select 1 from information_schema.columns
                where table_name = 'partners' and column_name = 'active')

union all select '21-foto-do-responsavel',
       exists (select 1 from information_schema.columns
                where table_name = 'guardians' and column_name = 'photo_url')

union all select '22-prazo-e-falta',
       (to_regprocedure('public.cancellation_cutoff()') is not null
        and exists (select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid
                     where t.typname = 'booking_status' and e.enumlabel = 'no_show'))

union all select '23-portao-da-assinatura',
       exists (select 1 from pg_type where typname = 'subscription_status')

-- A marca aqui é uma AUSÊNCIA: o arquivo tirou `guardian_id` do `select`
-- de quem não está logado. Procurar o que sobrou seria procurar o que
-- não mudou.
union all select '24-avaliacao-sem-dono',
       not exists (select 1 from information_schema.column_privileges
                    where table_name = 'reviews' and grantee = 'anon'
                      and privilege_type = 'SELECT' and column_name = 'guardian_id')

-- Idem: o cliente perdeu o direito de escrever no que decide dinheiro.
union all select '25-torneiras-fechadas',
       not has_table_privilege('authenticated', 'subscriptions', 'insert')

union all select '26-foto-do-pedido-privada',
       exists (select 1 from storage.buckets where id = 'pedidos' and public = false)

union all select '27-foto-na-analise',
       coalesce((select pg_get_function_result(p.oid) like '%photo_path%'
                   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                  where n.nspname = 'public' and p.proname = 'pending_applications'), false)

union all select '28-email-da-decisao',
       to_regclass('public.email_outbox') is not null

union all select '29-vencida-volta-para-a-fila',
       coalesce((select prosrc like '%vencida%'
                   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                  where n.nspname = 'public' and p.proname = 'subscribe_plan'), false)

union all select '30-excluir-a-conta',
       to_regprocedure('public.delete_my_account()') is not null

union all select '31-capa-passa-por-analise',
       to_regprocedure('public.submit_cover(uuid, text)') is not null

order by arquivo;

-- ---------------------------------------------------------------------
-- Um passo que nenhuma consulta vê.
--
-- Depois da 26: no Storage, abra o bucket `atividades` e veja se existe a
-- pasta `pedidos/`. Se existir, apague. A migration reescreve a coluna,
-- mas não move arquivo — e bucket público serve por URL direta, sem
-- passar por policy nenhuma.
-- ---------------------------------------------------------------------
