-- Onde as fotos ficam.
--
-- Até aqui não havia lugar nenhum: a foto da criança era gravada como
-- `file:///data/user/0/...`, o caminho do arquivo dentro do aparelho que a
-- escolheu. Funcionava naquele celular, até a primeira limpeza de cache, e em
-- nenhum outro lugar do mundo — nem no aparelho da mãe, nem depois de
-- reinstalar. A imagem da atividade nem isso: era uma foto do Unsplash fixa
-- por modalidade, igual para toda escolinha de futebol do país.
--
-- Dois buckets, e a diferença entre eles é o ponto:
--
--   `atividades`  PÚBLICO. É a vitrine do parceiro, vista por qualquer
--                 família que abrir o app. Fosse privado, cada cartão da
--                 lista precisaria de uma URL assinada — dezenas de idas ao
--                 servidor para montar uma tela de catálogo.
--
--   `criancas`    PRIVADO, sem exceção. É foto de criança. Só sai por URL
--                 assinada, com validade curta, para quem é responsável por
--                 ela. Um bucket público aqui seria um diretório de fotos de
--                 crianças aberto na internet — e o custo de assinar é
--                 irrelevante: uma família tem duas, três crianças.
--
-- O schema `storage` só existe dentro do Supabase. O Postgres local dos
-- testes não o tem, e este arquivo precisa passar nos dois — daí a guarda.

do $$
begin
  if to_regclass('storage.objects') is null then
    raise notice 'sem schema storage (Postgres local): pulando buckets e policies';
    return;
  end if;

  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('atividades', 'atividades', true, 5242880,
          array['image/jpeg','image/png','image/webp'])
  on conflict (id) do update
    set public = excluded.public,
        file_size_limit = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;

  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('criancas', 'criancas', false, 5242880,
          array['image/jpeg','image/png','image/webp'])
  on conflict (id) do update
    set public = excluded.public,
        file_size_limit = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;

  -- ---------------------------------------------------------- atividades --
  -- Qualquer um lê (é vitrine). Escrever é do parceiro dono, e o caminho
  -- carrega o id dele: `atividades/<partner_id>/<activity_id>.jpg`. Sem o id
  -- no caminho, a policy não teria como saber de quem é o arquivo — e um
  -- parceiro poderia sobrescrever a foto do outro.
  drop policy if exists atividades_leitura on storage.objects;
  create policy atividades_leitura on storage.objects
    for select to anon, authenticated
    using (bucket_id = 'atividades');

  drop policy if exists atividades_escrita on storage.objects;
  create policy atividades_escrita on storage.objects
    for all to authenticated
    using (
      bucket_id = 'atividades'
      and is_partner_member(((storage.foldername(name))[1])::uuid)
    )
    with check (
      bucket_id = 'atividades'
      and is_partner_member(((storage.foldername(name))[1])::uuid)
    );

  -- ------------------------------------------------------------ crianças --
  -- Caminho: `criancas/<guardian_id>/<child_id>.jpg`. O responsável é a
  -- primeira pasta, e é só ela que a policy precisa comparar — nada de
  -- consultar `children`, que traria a RLS daquela tabela para dentro desta
  -- e tornaria a regra dependente de duas coisas em vez de uma.
  drop policy if exists criancas_do_responsavel on storage.objects;
  create policy criancas_do_responsavel on storage.objects
    for all to authenticated
    using (
      bucket_id = 'criancas'
      and (storage.foldername(name))[1] = auth.uid()::text
    )
    with check (
      bucket_id = 'criancas'
      and (storage.foldername(name))[1] = auth.uid()::text
    );

  raise notice 'buckets atividades (público) e criancas (privado) prontos';
end $$;
