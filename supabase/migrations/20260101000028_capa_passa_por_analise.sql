-- =====================================================================
-- A capa da atividade passa a ser analisada antes de ir ao ar.
-- =====================================================================
--
-- A capa vai para o bucket `atividades`, que é PÚBLICO, e aparece no cartão
-- que toda família vê. Até aqui o parceiro trocava e a imagem estava no ar no
-- mesmo segundo, sem ninguém olhar — num app para crianças.
--
-- O que existia de verificação era técnica: o bucket recusa acima de 5 MB e
-- aceita só jpeg, png e webp. Isso impede um vídeo; não impede uma imagem
-- imprópria de 2 MB.
--
-- ---------------------------------------------------- por que não é só tela --
--
-- `partner_writes_activities` é `for all` e o `grant` da 000004 deu a tabela
-- inteira: hoje o parceiro escreve `image_url` direto, por um PATCH. Uma fila
-- que existisse só no painel seria teatro — bastaria não usar o painel.
--
-- Então a coluna sai da mão dele, como saiu a cota da assinatura na 000022.
-- A capa passa a mudar por função, e a função decide quem pode o quê.
-- =====================================================================

alter table activities add column if not exists pending_image_url text;
alter table activities add column if not exists pending_image_at  timestamptz;
-- Por que a última foi recusada. Fica na atividade, e não numa tabela de
-- histórico, porque quem precisa ler é o parceiro na tela dele — e sem o
-- motivo ele manda a mesma imagem de novo.
alter table activities add column if not exists pending_image_reason text;

comment on column activities.pending_image_url is
  'Capa enviada esperando análise. A que está no ar continua em image_url.';

-- ------------------------------------------------------- a torneira ---------

revoke insert, update, delete on activities from authenticated;
-- Nada volta. O painel só escrevia `image_url`, e é exatamente isso que passa
-- a ir por função. Criar atividade já era de `approve_application`.

-- --------------------------------------------------------- o parceiro ------

/**
 * O parceiro manda uma capa para análise.
 *
 * Recebe a URL porque o arquivo já subiu: o Storage tem policy própria, e a
 * pasta é o id do parceiro. O que esta função controla é o que vira CAPA —
 * que é outra coisa, e é a que aparece para a família.
 */
create or replace function submit_cover(p_activity_id uuid, p_url text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_partner uuid;
begin
  select partner_id into v_partner from activities where id = p_activity_id;
  if not found then
    raise exception 'activity_not_found' using errcode = 'P0002';
  end if;
  if not is_partner_member(v_partner) then
    raise exception 'not_this_partner' using errcode = '42501';
  end if;
  if coalesce(btrim(p_url), '') = '' then
    raise exception 'image_required' using errcode = 'P0001';
  end if;

  update activities
     set pending_image_url    = p_url,
         pending_image_at     = now(),
         -- O motivo da recusa anterior sai de cena: ele era sobre a imagem
         -- que acabou de ser substituída.
         pending_image_reason = null
   where id = p_activity_id;
end;
$$;

-- ----------------------------------------------------------- quem analisa --

/**
 * A fila de capas esperando análise.
 *
 * Traz a que está no ar junto com a pendente. Julgar uma capa sem ver a atual
 * é julgar metade: o que importa é se a nova pode substituir aquela.
 */
create or replace function pending_covers()
returns table (
  activity_id   uuid,
  activity      text,
  partner       text,
  category_id   text,
  current_url   text,
  pending_url   text,
  sent_at       timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select a.id, a.title, p.name, a.category_id,
         a.image_url, a.pending_image_url, a.pending_image_at
    from activities a
    join partners p on p.id = a.partner_id
   where a.pending_image_url is not null and is_kidoo_admin()
   order by a.pending_image_at;
$$;

/** Aprovar publica: a pendente vira a capa que a família vê. */
create or replace function approve_cover(p_activity_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_pendente text;
begin
  if not is_kidoo_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;

  select pending_image_url into v_pendente
    from activities where id = p_activity_id for update;
  if v_pendente is null then
    raise exception 'no_pending_cover' using errcode = 'P0002';
  end if;

  update activities
     set image_url            = v_pendente,
         pending_image_url    = null,
         pending_image_at     = null,
         pending_image_reason = null
   where id = p_activity_id;
end;
$$;

/**
 * Recusar, com motivo.
 *
 * Mesma regra da recusa de cadastro, pelo mesmo motivo: sem dizer o que está
 * errado, o parceiro reenvia a mesma imagem e alguém recusa de novo, para
 * sempre.
 */
create or replace function reject_cover(p_activity_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_kidoo_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;
  if coalesce(btrim(p_reason), '') = '' then
    raise exception 'reason_required' using errcode = 'P0001';
  end if;

  update activities
     set pending_image_url    = null,
         pending_image_at     = null,
         pending_image_reason = p_reason
   where id = p_activity_id and pending_image_url is not null;

  if not found then
    raise exception 'no_pending_cover' using errcode = 'P0002';
  end if;
end;
$$;

grant execute on function submit_cover(uuid, text)  to authenticated;
grant execute on function pending_covers()          to authenticated;
grant execute on function approve_cover(uuid)       to authenticated;
grant execute on function reject_cover(uuid, text)  to authenticated;
