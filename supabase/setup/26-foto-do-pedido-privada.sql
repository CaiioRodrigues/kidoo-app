-- =====================================================================
-- Kidoo — a foto do pedido sai do bucket público.
--
-- Para um banco que JÁ EXISTE, e DEPOIS da 25. Cole inteiro no SQL Editor do
-- Supabase e clique em Run. É idempotente.
--
-- DEPOIS DE RODAR, um passo à mão. Isto cria o bucket novo e reescreve a
-- coluna, mas NÃO move arquivo: o que já foi enviado continua no bucket
-- público, e bucket público serve por URL direta, sem passar por policy.
--
-- No Storage do Supabase, abra o bucket `atividades` e veja se existe a pasta
-- `pedidos/`. Se existir, apague-a: aquelas fotos estão abertas a qualquer um
-- com o endereço, e depois desta migration ninguém mais as lê pelo painel de
-- qualquer forma. Se não existir, não há nada a fazer — nenhum pedido chegou
-- com foto ainda.
-- =====================================================================

begin;

do $$
begin
  if to_regclass('storage.objects') is null then
    raise notice 'sem schema storage (Postgres local): pulando bucket e policy';
    return;
  end if;

  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('pedidos', 'pedidos', false, 5242880,
          array['image/jpeg','image/png','image/webp'])
  on conflict (id) do update
    set public = excluded.public,
        file_size_limit = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;

  drop policy if exists pedidos_do_dono on storage.objects;
  create policy pedidos_do_dono on storage.objects
    for all to authenticated
    using (
      bucket_id = 'pedidos'
      and ((storage.foldername(name))[1] = auth.uid()::text or is_kidoo_admin())
    )
    with check (
      -- Escrever é só do dono: quem analisa lê o pedido, não o reescreve.
      bucket_id = 'pedidos'
      and (storage.foldername(name))[1] = auth.uid()::text
    );

  -- A antiga, no bucket público, deixa de existir. Ela só regia escrita — a
  -- leitura era do `atividades_leitura`, e é essa que nunca deveria ter
  -- alcançado a foto de um pedido em análise.
  drop policy if exists pedidos_propria_pasta on storage.objects;

  raise notice 'bucket pedidos (privado) pronto';
end $$;

-- O caminho guardado perde o prefixo `pedidos/`, que agora é o nome do bucket
-- e não mais uma pasta dentro de `atividades`.
--
-- ATENÇÃO: isto reescreve a COLUNA, não move o ARQUIVO. O que já foi enviado
-- continua no bucket público até ser apagado à mão no Storage — bucket
-- público serve por URL direta, sem passar por policy nenhuma. O cabeçalho do
-- arquivo colável diz como conferir.
update partner_applications
   set photo_path = regexp_replace(photo_path, '^pedidos/', '')
 where photo_path like 'pedidos/%';

commit;

-- ---------------------------------------------------------- conferir -------

-- O bucket novo tem de vir `false` em `public`.
select id, public from storage.buckets where id in ('pedidos', 'atividades') order by id;

-- E a policy antiga, no bucket público, não pode mais existir.
select coalesce(
         (select string_agg(policyname, ', ') from pg_policies
           where schemaname = 'storage' and policyname in ('pedidos_do_dono','pedidos_propria_pasta')),
         'nenhuma') as policies_de_pedido;
