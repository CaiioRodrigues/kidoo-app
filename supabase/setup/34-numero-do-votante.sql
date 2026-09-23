-- =====================================================================
-- Kidoo — o papel numerado da porta vira a identidade de quem vota.
--
-- Para um banco que JÁ EXISTE, e DEPOIS da 33. Cole inteiro no SQL Editor do
-- Supabase e clique em Run. É idempotente.
--
-- Quem organiza escolhe quantos papéis vai entregar (10 convidados, 60
-- convidados) e os números vão de 1 até esse total. Na hora de votar, a pessoa
-- digita o número que recebeu — e é ele que o índice único da 33 passa a
-- contar: um voto por PAPEL, não por aparelho.
--
-- Assim o mesmo celular serve a festa inteira, e quem organiza vê quais
-- números já votaram.
--
-- Deixar a faixa em branco mantém o jeito antigo (a chave é o navegador), que
-- é o que uma votação sem porta física precisa.
--
-- ATENÇÃO: número sequencial não é segredo. Quem tem o link e sabe o tamanho
-- da festa pode digitar 37 e votar no lugar de quem ainda não votou — a senha
-- da festa é o que fecha essa porta, e a tela passa a pedir as duas coisas.
-- =====================================================================

begin;

alter table polls add column if not exists voter_numbers int;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'faixa_de_papeis_plausivel') then
    -- Dois é o menor número que é uma faixa. O teto existe para um dedo
    -- escorregado em "600000" não virar uma grade impossível na tela de quem
    -- organiza.
    alter table polls add constraint faixa_de_papeis_plausivel
      check (voter_numbers is null or voter_numbers between 2 and 999);
  end if;
end $$;

/**
 * A chave do votante, conferida e normalizada.
 *
 * Sem faixa de papéis, a chave é o id do navegador e vale como veio.
 *
 * Com faixa, ela É o papel: precisa ser um inteiro dentro dela. E é
 * normalizada, porque "07" e "7" são a mesma pessoa — sem isto o mesmo papel
 * votaria duas vezes só mudando a escrita, e o índice único não veria nada de
 * errado.
 */
create or replace function poll_voter_key(p_poll_id uuid, p_voter_key text)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_max int;
  v_key text := btrim(coalesce(p_voter_key, ''));
begin
  if v_key = '' then
    raise exception 'voter_required' using errcode = 'P0001';
  end if;

  select voter_numbers into v_max from polls where id = p_poll_id;
  if v_max is null then
    return v_key;
  end if;

  if v_key !~ '^[0-9]{1,3}$' then
    raise exception 'invalid_number' using errcode = 'P0001';
  end if;
  if v_key::int < 1 or v_key::int > v_max then
    raise exception 'number_out_of_range' using errcode = 'P0001';
  end if;
  return v_key::int::text;
end;
$$;

-- ---------------------------------------------------------- votar ---------

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
  v_key    text;
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
  -- vazado, que é o problema real — e mais ainda agora, que o número do papel
  -- é adivinhável por quem souber o tamanho da festa.
  if v_poll.passphrase is not null
     and lower(btrim(coalesce(p_passphrase, ''))) <> lower(btrim(v_poll.passphrase)) then
    raise exception 'wrong_passphrase' using errcode = '42501';
  end if;

  -- Confere e normaliza antes de qualquer insert: cédula pela metade é o que
  -- a transação única existe para evitar.
  v_key := poll_voter_key(p_poll_id, p_voter_key);

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
    values (p_poll_id, v_cat::uuid, v_entry, v_key);
  end loop;
end;
$$;

/**
 * Já votou?
 *
 * Com número, a tela pergunta ASSIM QUE a pessoa digita o papel — antes de
 * mostrar a cédula. Descobrir que o número já votou depois de escolher em três
 * categorias é o tipo de tela que faz alguém achar que o sistema comeu o voto.
 *
 * E levanta o mesmo erro de `poll_voter_key`: número fora da faixa é resposta,
 * não silêncio.
 */
create or replace function has_voted(p_poll_id uuid, p_voter_key text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_key text := poll_voter_key(p_poll_id, p_voter_key);
begin
  return exists (select 1 from ballots
                  where poll_id = p_poll_id and voter_key = v_key);
end;
$$;

-- ------------------------------------------------------ o que está no ar --

-- `numeros` entra com nome próprio: o resto do objeto público já é assim
-- (`photoPath`, `protegida`), e a tela não deveria aprender o nome da coluna.
create or replace function current_poll()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select to_jsonb(p) - 'passphrase' || jsonb_build_object(
           'protegida', p.passphrase is not null,
           'numeros', p.voter_numbers,
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

-- -------------------------------------------------------- quem organiza ---

-- A assinatura ganha um parâmetro, então a antiga sai antes: com as duas de
-- pé, uma chamada de quatro argumentos fica ambígua e o Postgres recusa.
drop function if exists create_poll(text, text, text[], text);

/** Cria a votação com as categorias, e já abre as inscrições. */
create or replace function create_poll(
  p_title         text,
  p_subtitle      text,
  p_categories    text[],
  p_passphrase    text default null,
  p_voter_numbers int default null
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
  if p_voter_numbers is not null and (p_voter_numbers < 2 or p_voter_numbers > 999) then
    raise exception 'invalid_range' using errcode = 'P0001';
  end if;

  insert into polls (title, subtitle, status, passphrase, voter_numbers)
  values (btrim(p_title), nullif(btrim(coalesce(p_subtitle, '')), ''), 'inscricoes',
          nullif(btrim(coalesce(p_passphrase, '')), ''), p_voter_numbers)
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

-- Muda a tabela devolvida, e isso o `create or replace` não faz.
drop function if exists admin_polls();

/** Tudo o que quem organiza precisa ver, inclusive antes de apurar. */
create or replace function admin_polls()
returns table (
  id            uuid,
  title         text,
  status        poll_status,
  entries       bigint,
  voters        bigint,
  voter_numbers int,
  voted_numbers text[],
  created_at    timestamptz
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
         p.voter_numbers,
         -- Os papéis que já votaram — a pergunta que fez o papel existir.
         -- Só onde há papel: numa votação sem faixa isto seria uma lista de
         -- ids de navegador, que não diz nada a ninguém.
         case when p.voter_numbers is null then null else (
           select array_agg(distinct b.voter_key)
             from ballots b where b.poll_id = p.id
         ) end,
         p.created_at
    from polls p
   where is_kidoo_admin()
   order by p.created_at desc;
$$;

grant execute on function current_poll()                                  to anon, authenticated;
grant execute on function cast_ballot(uuid, text, jsonb, text)            to anon, authenticated;
grant execute on function has_voted(uuid, text)                           to anon, authenticated;
grant execute on function create_poll(text, text, text[], text, int)      to authenticated;
grant execute on function admin_polls()                                   to authenticated;

commit;

-- ---------------------------------------------------------- conferir -------

-- A coluna existe, com o limite de faixa.
select column_name, data_type from information_schema.columns
 where table_name = 'polls' and column_name = 'voter_numbers';

-- E quem organiza passa a receber a faixa e os números que já votaram.
select string_agg(t.nome, ', ' order by t.ordem) as colunas_de_admin_polls
  from pg_proc p, unnest(p.proargnames) with ordinality as t(nome, ordem)
 where p.proname = 'admin_polls';
