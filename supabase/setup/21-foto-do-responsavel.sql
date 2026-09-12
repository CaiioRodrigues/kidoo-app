-- =====================================================================
-- Kidoo — a foto do responsável.
--
-- Para um banco que JÁ EXISTE. Cole inteiro no SQL Editor do Supabase e
-- clique em Run. É idempotente.
--
-- O que entra:
--   1. `guardians.photo_url` — o CAMINHO da foto no bucket, nunca a URL:
--      o bucket é privado, e o link é assinado na hora de exibir.
--   2. O bucket `responsaveis`, privado, com a policy que limita cada um à
--      própria pasta.
--
-- Não mexe em nada que já existia.
-- =====================================================================

begin;

-- A foto de quem leva a criança.
--
-- A criança tem foto desde a 000011; o responsável nunca teve. No app ele é
-- duas letras num círculo colorido — e é o rosto que aparece no cabeçalho do
-- Perfil, ao lado do próprio nome.
--
-- A coluna se chama `photo_url` por simetria com `children.photo_url`, e as
-- duas guardam a mesma coisa: o CAMINHO dentro do bucket, nunca a URL. Guardar
-- a URL seria guardar algo que expira em uma hora — o bucket é privado, e a
-- imagem só sai por link assinado.

alter table guardians add column if not exists photo_url text;

comment on column guardians.photo_url is
  'Caminho da foto no bucket privado `responsaveis`, no formato bucket/pasta/arquivo. Nunca a URL: ela é assinada na hora de exibir e expira.';

-- ------------------------------------------------------------ o bucket -----

/*
  Um bucket novo, e não uma pasta dentro de `criancas`.

  A policy de `criancas` compara a primeira pasta com `auth.uid()`, então
  `criancas/<guardian_id>/perfil.jpg` passaria sem tocar em nada. Funcionaria —
  e seria exatamente o tipo de economia que se paga depois: o bucket chamado
  `criancas` existe porque foto de criança tem regra própria, e o dia em que
  alguém precisar apagar, exportar ou auditar "as fotos de criança" teria de
  saber, de cabeça, que uma parte do conteúdo não é de criança nenhuma.

  Privado pelo mesmo motivo que o outro: é foto de pessoa, não vitrine. O custo
  de assinar é irrelevante — é uma imagem por conta, no cabeçalho de uma tela.
*/
do $$
begin
  if to_regclass('storage.objects') is null then
    raise notice 'sem schema storage (Postgres local): pulando bucket e policy';
    return;
  end if;

  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('responsaveis', 'responsaveis', false, 5242880,
          array['image/jpeg','image/png','image/webp'])
  on conflict (id) do update
    set public = excluded.public,
        file_size_limit = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;

  -- Caminho: `responsaveis/<guardian_id>/perfil.jpg`. A pasta é o dono, e é só
  -- ela que a policy compara — mesma forma da de `criancas`, pelo mesmo motivo:
  -- a regra não depende de consultar outra tabela, então não herda a RLS dela.
  drop policy if exists responsaveis_do_dono on storage.objects;
  create policy responsaveis_do_dono on storage.objects
    for all to authenticated
    using (
      bucket_id = 'responsaveis'
      and (storage.foldername(name))[1] = auth.uid()::text
    )
    with check (
      bucket_id = 'responsaveis'
      and (storage.foldername(name))[1] = auth.uid()::text
    );

  raise notice 'bucket responsaveis (privado) pronto';
end $$;

commit;

-- ------------------------------------------------------------- conferência ---

-- A coluna existe?
select column_name
  from information_schema.columns
 where table_name = 'guardians' and column_name = 'photo_url';

-- O bucket existe e está PRIVADO? `public` tem de vir `false` — um bucket
-- público aqui seria um diretório de fotos de gente aberto na internet.
select id, public, file_size_limit
  from storage.buckets
 where id = 'responsaveis';

-- A policy está no lugar?
select policyname
  from pg_policies
 where schemaname = 'storage' and tablename = 'objects'
   and policyname = 'responsaveis_do_dono';
