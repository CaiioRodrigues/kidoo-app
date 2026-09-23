-- =====================================================================
-- Kidoo — a família consegue denunciar uma imagem imprópria.
--
-- Para um banco que JÁ EXISTE, e DEPOIS da 31. Cole inteiro no SQL Editor do
-- Supabase e clique em Run. É idempotente.
--
-- Cobre o que a fila da 31 não cobre: a capa que já estava publicada antes
-- dela existir, e o julgamento que erra.
--
-- UMA denúncia tira a capa do ar, sem esperar uma segunda. É decisão, e a
-- conta é assimétrica: capa escondida por engano vira a foto genérica da
-- modalidade por alguns minutos e volta com um clique; imagem imprópria que
-- fica no ar está num app de criança.
-- =====================================================================

begin;

do $$ begin
  if not exists (select 1 from pg_type where typname = 'report_reason') then
    create type report_reason as enum ('imagem', 'descricao', 'seguranca', 'outro');
  end if;
end $$;

create table if not exists reports (
  id           uuid primary key default gen_random_uuid(),
  guardian_id  uuid not null references guardians (id) on delete cascade,
  activity_id  uuid not null references activities (id) on delete cascade,
  reason       report_reason not null,
  detail       text,
  created_at   timestamptz not null default now(),
  -- A capa que estava no ar quando a denúncia chegou. É o que permite
  -- desfazer: sem guardar aqui, "restaurar" seria pedir a imagem de volta ao
  -- parceiro, e o engano viraria trabalho dele.
  hidden_url   text,
  resolved_at  timestamptz,
  resolved_by  uuid references auth.users (id),
  resolution   text
);

-- Uma por família por atividade. Sem isto, uma conta sozinha derruba a mesma
-- capa quantas vezes quiser, e a fila de quem analisa vira ruído.
create unique index if not exists uma_denuncia_por_familia
  on reports (guardian_id, activity_id);

create index if not exists reports_abertas on reports (created_at)
  where resolved_at is null;

alter table reports enable row level security;

-- A família lê as próprias, e não escreve direto: quem cria é a função, que
-- também esconde a capa na mesma transação.
drop policy if exists reports_own on reports;
create policy reports_own on reports for select to authenticated
  using (guardian_id = auth.uid());

revoke insert, update, delete on reports from authenticated;
grant select on reports to authenticated;

-- --------------------------------------------------------- denunciar -------

/**
 * Denuncia uma atividade, e tira a capa do ar quando o motivo é a imagem.
 *
 * As duas coisas na mesma transação de propósito: registrar a denúncia e
 * deixar a imagem no ar por mais um instante seriam dois estados, e o instante
 * é justamente o que se quer evitar.
 */
create or replace function report_activity(
  p_activity_id uuid,
  p_reason      report_reason,
  p_detail      text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_guardian uuid := auth.uid();
  v_capa     text;
begin
  if v_guardian is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not exists (select 1 from activities where id = p_activity_id) then
    raise exception 'activity_not_found' using errcode = 'P0002';
  end if;
  if exists (select 1 from reports
              where guardian_id = v_guardian and activity_id = p_activity_id) then
    raise exception 'already_reported' using errcode = 'P0001';
  end if;

  if p_reason = 'imagem' then
    -- Guarda ANTES de apagar. Ler depois devolveria o nulo que acabamos de
    -- escrever, e "restaurar" não teria o que restaurar — o engano viraria
    -- trabalho do parceiro, que teria de mandar a imagem de novo.
    select image_url into v_capa from activities where id = p_activity_id for update;

    -- Sai do ar AGORA. O app cai na foto genérica da modalidade, que é o
    -- mesmo que ele mostra para atividade sem capa — ninguém vê buraco.
    update activities set image_url = null where id = p_activity_id;
  end if;

  insert into reports (guardian_id, activity_id, reason, detail, hidden_url)
  values (v_guardian, p_activity_id, p_reason, nullif(btrim(p_detail), ''), v_capa);
end;
$$;

-- ----------------------------------------------------------- quem analisa --

create or replace function pending_reports()
returns table (
  id          uuid,
  activity_id uuid,
  activity    text,
  partner     text,
  reason      report_reason,
  detail      text,
  hidden_url  text,
  created_at  timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select r.id, a.id, a.title, p.name, r.reason, r.detail, r.hidden_url, r.created_at
    from reports r
    join activities a on a.id = r.activity_id
    join partners   p on p.id = a.partner_id
   where r.resolved_at is null and is_kidoo_admin()
   order by r.created_at;
$$;

/**
 * Resolve uma denúncia.
 *
 * `p_restaurar` decide o destino da capa escondida: de volta ao ar, ou fora
 * para sempre. Não tem meio-termo, e é isso que a tela pergunta.
 */
create or replace function resolve_report(
  p_id         uuid,
  p_restaurar  boolean,
  p_resolution text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_rep reports%rowtype;
begin
  if not is_kidoo_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;

  select * into v_rep from reports where id = p_id for update;
  if not found then
    raise exception 'report_not_found' using errcode = 'P0002';
  end if;
  if v_rep.resolved_at is not null then
    raise exception 'already_resolved' using errcode = 'P0001';
  end if;

  -- Só restaura se ainda não houver capa: se o parceiro já mandou outra e ela
  -- foi aprovada enquanto a denúncia esperava, devolver a antiga desfaria uma
  -- decisão que já foi tomada.
  if p_restaurar and v_rep.hidden_url is not null then
    update activities set image_url = coalesce(image_url, v_rep.hidden_url)
     where id = v_rep.activity_id;
  end if;

  update reports
     set resolved_at = now(), resolved_by = auth.uid(),
         resolution  = nullif(btrim(p_resolution), '')
   where id = p_id;
end;
$$;

grant execute on function report_activity(uuid, report_reason, text) to authenticated;
grant execute on function pending_reports()                          to authenticated;
grant execute on function resolve_report(uuid, boolean, text)        to authenticated;

commit;

-- ---------------------------------------------------------- conferir -------

-- A tabela existe, fechada, e o cliente NÃO escreve nela.
select relrowsecurity as rls_ligada,
       has_table_privilege('authenticated', 'reports', 'select') as a_familia_le_as_suas,
       has_table_privilege('authenticated', 'reports', 'insert') as escreve_direto_NAO_PODE
  from pg_class where oid = 'reports'::regclass;

-- E as três funções existem.
select proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and proname in ('report_activity', 'pending_reports', 'resolve_report')
 order by proname;
