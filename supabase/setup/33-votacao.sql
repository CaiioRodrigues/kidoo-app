-- =====================================================================
-- Kidoo — votação com inscrição por foto, cédula e pódio.
--
-- Para um banco que JÁ EXISTE, e DEPOIS da 32. Cole inteiro no SQL Editor do
-- Supabase e clique em Run. É idempotente.
--
-- Não é do negócio de escolinha: é uma ferramenta de votação que mora no mesmo
-- banco. A primeira é de fantasia numa festa, e por isso nada aqui fala de
-- Halloween — a decoração mora na página pública, e o que está embaixo serve
-- para "melhor parceiro do ano" sem trocar uma linha.
--
-- O que ela garante, e onde:
--
--   * um voto por categoria por votante — índice único, não a tela;
--   * quem organiza abre as inscrições, libera o voto e manda contar, e mais
--     ninguém — `is_kidoo_admin()` dentro de cada função;
--   * ninguém lê a urna: `ballots` fica sem policy e sem grant, como a
--     `push_outbox`;
--   * o placar parcial não existe — `poll_results` só responde depois de
--     apurada, senão quem votasse por último votaria sabendo quem ganha.
--
-- O bucket `votacao` é PÚBLICO de propósito: a foto da fantasia é o objeto da
-- votação, e a página é aberta a quem tem o link. Nada de criança, nada de
-- documento.
-- =====================================================================

begin;

do $$ begin
  if not exists (select 1 from pg_type where typname = 'poll_status') then
    -- Os quatro estados são os quatro botões de quem organiza, nesta ordem.
    create type poll_status as enum ('rascunho', 'inscricoes', 'votacao', 'apurada');
  end if;
end $$;

create table if not exists polls (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  subtitle   text,
  status     poll_status not null default 'rascunho',
  /** A senha da festa. Nula quando a votação é aberta a qualquer um com o link. */
  passphrase text,
  created_at timestamptz not null default now()
);

create table if not exists poll_categories (
  id       uuid primary key default gen_random_uuid(),
  poll_id  uuid not null references polls (id) on delete cascade,
  label    text not null,
  position smallint not null default 0
);

create index if not exists poll_categories_da_votacao on poll_categories (poll_id, position);

create table if not exists poll_entries (
  id         uuid primary key default gen_random_uuid(),
  poll_id    uuid not null references polls (id) on delete cascade,
  name       text not null,
  /** Caminho no bucket `votacao`. A foto é a inscrição: sem ela não há o que votar. */
  photo_path text not null,
  created_at timestamptz not null default now()
);

create index if not exists poll_entries_da_votacao on poll_entries (poll_id, created_at);

create table if not exists ballots (
  id          uuid primary key default gen_random_uuid(),
  poll_id     uuid not null references polls (id) on delete cascade,
  category_id uuid not null references poll_categories (id) on delete cascade,
  entry_id    uuid not null references poll_entries (id) on delete cascade,
  /**
   * Quem votou, do jeito que der para saber.
   *
   * Hoje é um id que o navegador guarda. Amanhã pode ser um código impresso e
   * entregue na porta — o schema não muda, só quem gera a chave.
   */
  voter_key   text not null,
  created_at  timestamptz not null default now()
);

-- A garantia que importa. Um voto por categoria por chave, decidido pelo
-- banco: a tela pode falhar, o duplo clique acontece, e nada disso passa.
create unique index if not exists um_voto_por_categoria
  on ballots (category_id, voter_key);

alter table polls           enable row level security;
alter table poll_categories enable row level security;
alter table poll_entries    enable row level security;
alter table ballots         enable row level security;

-- ------------------------------------------------------------- leitura -----
--
-- A votação e os inscritos são públicos: é o que a cédula mostra. Os VOTOS
-- não são — ler `ballots` seria ver o placar antes da apuração, e saber em
-- quem cada aparelho votou.

drop policy if exists polls_publicas on polls;
create policy polls_publicas on polls for select to anon, authenticated using (true);

drop policy if exists categorias_publicas on poll_categories;
create policy categorias_publicas on poll_categories
  for select to anon, authenticated using (true);

drop policy if exists inscritos_publicos on poll_entries;
create policy inscritos_publicos on poll_entries
  for select to anon, authenticated using (true);

grant select on polls, poll_categories, poll_entries to anon, authenticated;
-- `ballots` fica sem policy e sem grant: nem ler, nem escrever. Quem escreve
-- é a função, que confere o estado da votação antes.
revoke all on ballots from anon, authenticated;

-- ------------------------------------------------------- o que está no ar --

/**
 * A votação em andamento, com categorias e inscritos.
 *
 * Uma chamada, e não três, porque a tela mostra os três juntos: em três a
 * página teria três carregamentos e três erros possíveis para uma coisa só.
 */
create or replace function current_poll()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select to_jsonb(p) - 'passphrase' || jsonb_build_object(
           'protegida', p.passphrase is not null,
           'categories', coalesce((
             select jsonb_agg(jsonb_build_object('id', c.id, 'label', c.label)
                              order by c.position, c.label)
               from poll_categories c where c.poll_id = p.id), '[]'::jsonb),
           'entries', coalesce((
             select jsonb_agg(jsonb_build_object('id', e.id, 'name', e.name,
                                                 'photoPath', e.photo_path)
                              order by e.created_at)
               from poll_entries e where e.poll_id = p.id), '[]'::jsonb)
         )
    from polls p
   where p.status <> 'rascunho'
   order by p.created_at desc
   limit 1;
$$;

-- ------------------------------------------------------------ inscrever ----

/** Entra na disputa: um nome e uma foto. */
create or replace function submit_entry(p_poll_id uuid, p_name text, p_photo_path text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status poll_status;
  v_id     uuid;
begin
  select status into v_status from polls where id = p_poll_id;
  if not found then
    raise exception 'poll_not_found' using errcode = 'P0002';
  end if;
  -- Inscrever durante a votação mudaria a cédula com gente no meio dela: quem
  -- votou antes não teria visto esta opção.
  if v_status <> 'inscricoes' then
    raise exception 'entries_closed' using errcode = 'P0001';
  end if;
  if coalesce(btrim(p_name), '') = '' then
    raise exception 'name_required' using errcode = 'P0001';
  end if;
  if coalesce(btrim(p_photo_path), '') = '' then
    raise exception 'photo_required' using errcode = 'P0001';
  end if;

  insert into poll_entries (poll_id, name, photo_path)
  values (p_poll_id, btrim(p_name), p_photo_path)
  returning id into v_id;
  return v_id;
end;
$$;

-- --------------------------------------------------------------- votar -----

/**
 * Registra a cédula inteira: uma escolha por categoria.
 *
 * Tudo numa transação de propósito. Votar categoria por categoria deixaria
 * cédula pela metade quando a rede cai no meio — e meia cédula conta para um
 * lado e não para o outro.
 *
 * `p_choices` é um objeto `{ "<category_id>": "<entry_id>" }`.
 */
create or replace function cast_ballot(
  p_poll_id    uuid,
  p_voter_key  text,
  p_choices    jsonb,
  p_passphrase text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_poll   polls%rowtype;
  v_cat    text;
  v_entry  uuid;
begin
  select * into v_poll from polls where id = p_poll_id;
  if not found then
    raise exception 'poll_not_found' using errcode = 'P0002';
  end if;
  if v_poll.status <> 'votacao' then
    raise exception 'voting_closed' using errcode = 'P0001';
  end if;
  -- A senha da festa. Não protege de quem está lá dentro; protege do link
  -- vazado, que é o problema real.
  if v_poll.passphrase is not null
     and lower(btrim(coalesce(p_passphrase, ''))) <> lower(btrim(v_poll.passphrase)) then
    raise exception 'wrong_passphrase' using errcode = '42501';
  end if;
  if coalesce(btrim(p_voter_key), '') = '' then
    raise exception 'voter_required' using errcode = 'P0001';
  end if;

  for v_cat, v_entry in
    select key, value::text::uuid from jsonb_each_text(p_choices)
  loop
    -- Categoria e inscrito têm de ser DESTA votação. Sem isto, uma cédula
    -- montada à mão votaria numa categoria de outra festa.
    if not exists (select 1 from poll_categories
                    where id = v_cat::uuid and poll_id = p_poll_id) then
      raise exception 'category_not_in_poll' using errcode = 'P0001';
    end if;
    if not exists (select 1 from poll_entries
                    where id = v_entry and poll_id = p_poll_id) then
      raise exception 'entry_not_in_poll' using errcode = 'P0001';
    end if;

    insert into ballots (poll_id, category_id, entry_id, voter_key)
    values (p_poll_id, v_cat::uuid, v_entry, btrim(p_voter_key));
  end loop;
end;
$$;

/** Já votou? A tela pergunta antes de mostrar a cédula. */
create or replace function has_voted(p_poll_id uuid, p_voter_key text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from ballots
                  where poll_id = p_poll_id and voter_key = btrim(p_voter_key));
$$;

-- ------------------------------------------------------------ apuração -----

/**
 * O pódio de cada categoria.
 *
 * Só depois de apurada. Enquanto a votação corre, devolver o placar parcial
 * mudaria o voto de quem ainda não votou — e a ideia é justamente a virada no
 * fim.
 */
create or replace function poll_results(p_poll_id uuid)
returns table (
  category_id uuid,
  category    text,
  place       int,
  entry_id    uuid,
  entry       text,
  photo_path  text,
  votes       bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with contagem as (
    select c.id as category_id, c.label, c.position,
           e.id as entry_id, e.name, e.photo_path,
           count(b.id) as votos
      from poll_categories c
      join polls p on p.id = c.poll_id and p.status = 'apurada'
      join poll_entries e on e.poll_id = c.poll_id
      left join ballots b on b.category_id = c.id and b.entry_id = e.id
     where c.poll_id = p_poll_id
     group by c.id, c.label, c.position, e.id, e.name, e.photo_path
  )
  select category_id, label,
         -- `rank`, e não `row_number`: empate em primeiro dá dois primeiros, e
         -- inventar uma ordem entre eles seria decidir no desempate o que a
         -- festa não decidiu.
         rank() over (partition by category_id order by votos desc)::int,
         entry_id, name, photo_path, votos
    from contagem
   where votos > 0
   order by position, rank() over (partition by category_id order by votos desc), name;
$$;

grant execute on function current_poll()                            to anon, authenticated;
grant execute on function submit_entry(uuid, text, text)            to anon, authenticated;
grant execute on function cast_ballot(uuid, text, jsonb, text)      to anon, authenticated;
grant execute on function has_voted(uuid, text)                     to anon, authenticated;
grant execute on function poll_results(uuid)                        to anon, authenticated;

-- ------------------------------------------------------- quem organiza -----
--
-- As quatro portas, na ordem em que a festa acontece: abrir inscrições, abrir
-- a votação, apurar. `is_kidoo_admin()` é o mesmo portão do resto do painel —
-- não há papel novo para isto.

/** Cria a votação com as categorias, e já abre as inscrições. */
create or replace function create_poll(
  p_title      text,
  p_subtitle   text,
  p_categories text[],
  p_passphrase text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id  uuid;
  v_cat text;
  v_i   smallint := 0;
begin
  if not is_kidoo_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;
  if coalesce(btrim(p_title), '') = '' then
    raise exception 'title_required' using errcode = 'P0001';
  end if;
  if coalesce(array_length(p_categories, 1), 0) = 0 then
    raise exception 'categories_required' using errcode = 'P0001';
  end if;

  insert into polls (title, subtitle, status, passphrase)
  values (btrim(p_title), nullif(btrim(coalesce(p_subtitle, '')), ''), 'inscricoes',
          nullif(btrim(coalesce(p_passphrase, '')), ''))
  returning id into v_id;

  foreach v_cat in array p_categories loop
    if btrim(v_cat) <> '' then
      insert into poll_categories (poll_id, label, position)
      values (v_id, btrim(v_cat), v_i);
      v_i := v_i + 1;
    end if;
  end loop;

  return v_id;
end;
$$;

/**
 * Empurra a votação para o próximo estado.
 *
 * Só para a frente, e um de cada vez. Voltar de `apurada` para `votacao`
 * republicaria uma urna já aberta, com o resultado conhecido — é a única
 * transição que ninguém deve poder fazer por engano.
 */
create or replace function advance_poll(p_poll_id uuid)
returns poll_status
language plpgsql
security definer
set search_path = public
as $$
declare v_status poll_status;
begin
  if not is_kidoo_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;

  select status into v_status from polls where id = p_poll_id for update;
  if not found then
    raise exception 'poll_not_found' using errcode = 'P0002';
  end if;

  v_status := case v_status
    when 'rascunho'  then 'inscricoes'
    when 'inscricoes' then 'votacao'
    when 'votacao'   then 'apurada'
    else raise_already_counted()
  end;

  update polls set status = v_status where id = p_poll_id;
  return v_status;
end;
$$;

/** Existe só para o `case` acima ter como recusar o quarto passo. */
create or replace function raise_already_counted()
returns poll_status
language plpgsql
as $$
begin
  raise exception 'already_counted' using errcode = 'P0001';
end;
$$;

/** Tudo o que quem organiza precisa ver, inclusive antes de apurar. */
create or replace function admin_polls()
returns table (
  id         uuid,
  title      text,
  status     poll_status,
  entries    bigint,
  voters     bigint,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.title, p.status,
         (select count(*) from poll_entries e where e.poll_id = p.id),
         -- Votantes, não votos: quem votou em três categorias é uma pessoa.
         (select count(distinct b.voter_key) from ballots b where b.poll_id = p.id),
         p.created_at
    from polls p
   where is_kidoo_admin()
   order by p.created_at desc;
$$;

grant execute on function create_poll(text, text, text[], text) to authenticated;
grant execute on function advance_poll(uuid)                     to authenticated;
grant execute on function admin_polls()                          to authenticated;

-- ----------------------------------------------------------- as fotos ------
--
-- Bucket próprio e público: a foto da inscrição existe para todo mundo ver na
-- cédula, e assinar uma URL por inscrito seria dezenas de idas ao servidor
-- para montar uma tela de lista.
--
-- Escrita aberta para `anon` é o preço de não ter login numa festa. Fica
-- limitado pelo que o bucket aceita — 5 MB e imagem — e pelo tempo: uma
-- votação dura uma noite.
do $$
begin
  if to_regclass('storage.objects') is null then
    raise notice 'sem schema storage (Postgres local): pulando bucket da votação';
    return;
  end if;

  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('votacao', 'votacao', true, 5242880,
          array['image/jpeg','image/png','image/webp'])
  on conflict (id) do update
    set public = excluded.public,
        file_size_limit = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;

  drop policy if exists votacao_leitura on storage.objects;
  create policy votacao_leitura on storage.objects
    for select to anon, authenticated using (bucket_id = 'votacao');

  drop policy if exists votacao_escrita on storage.objects;
  create policy votacao_escrita on storage.objects
    for insert to anon, authenticated with check (bucket_id = 'votacao');
end $$;

commit;

-- ---------------------------------------------------------- conferir -------

-- A urna é fechada: RLS ligada, e o cliente não lê nem escreve.
select relrowsecurity as rls_ligada,
       has_table_privilege('anon', 'ballots', 'select') as anon_le_NAO_PODE,
       has_table_privilege('authenticated', 'ballots', 'insert') as escreve_direto_NAO_PODE
  from pg_class where oid = 'ballots'::regclass;

-- Um voto por categoria por votante, dito pelo banco.
select indexname from pg_indexes
 where tablename = 'ballots' and indexname = 'um_voto_por_categoria';

-- E as funções existem.
select proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and proname in ('current_poll', 'submit_entry', 'cast_ballot', 'has_voted',
                   'poll_results', 'create_poll', 'advance_poll', 'admin_polls')
 order by proname;
