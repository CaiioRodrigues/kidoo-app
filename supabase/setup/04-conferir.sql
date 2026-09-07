-- Confere se a primeira subida do Kidoo ficou completa.
select
  (select count(*) from information_schema.tables
    where table_schema = 'public' and table_type = 'BASE TABLE')     as tabelas,
  (select count(*) from information_schema.views
    where table_schema = 'public')                                   as visoes,
  -- Só as nossas: funções que vêm de extensão (pgcrypto e afins) não contam,
  -- senão o número muda conforme onde a extensão foi instalada.
  (select count(*) from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and not exists (select 1 from pg_depend d
                       where d.objid = p.oid and d.deptype = 'e'))   as funcoes,
  (select count(*) from activity_categories)                         as modalidades,
  (select count(*) from plans)                                       as planos,
  (select count(*) from pg_tables
    where schemaname = 'public' and not rowsecurity)                 as tabelas_sem_rls;
