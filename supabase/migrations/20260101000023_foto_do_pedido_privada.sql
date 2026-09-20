-- =====================================================================
-- A foto do pedido sai do bucket público.
-- =====================================================================
--
-- Ela subia para `atividades/pedidos/<user_id>/espaco`, e `atividades` é
-- público — a política `atividades_leitura` libera o bucket inteiro para
-- `anon`. A escrita estava protegida (só o dono da pasta), mas a leitura não:
-- quem tivesse a URL abria, sem login.
--
-- Não é dado de criança, é a foto do espaço de um negócio. Mas é material
-- enviado DURANTE a análise, por quem ainda não é parceiro, e ficar público
-- antes de haver decisão não é o que quem envia espera.
--
-- Bucket próprio, privado, com o caminho `<user_id>/espaco` — a pasta é o
-- dono, mesma forma de `criancas` e `responsaveis`, pelo mesmo motivo: a
-- regra não depende de consultar outra tabela, então não herda a RLS dela.
--
-- Quem analisa lê também. A foto existe para isso — `partner_applications`
-- já segue `user_id = auth.uid() or is_kidoo_admin()`, e a policy do arquivo
-- acompanha a da linha. Sem isso, a tela de análise nasceria sem conseguir
-- abrir a foto que ela existe para mostrar.
-- =====================================================================

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
