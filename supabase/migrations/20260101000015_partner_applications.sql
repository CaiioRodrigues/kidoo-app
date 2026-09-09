-- O estabelecimento pede para entrar, e alguém do Kidoo decide.
--
-- Até aqui todo parceiro nascia rodando SQL à mão. Isso não escala além de uma
-- pessoa cadastrando um por um — e é o gargalo que impede o modelo inteiro de
-- crescer, porque sem parceiro não há vaga e sem vaga não há produto.
--
-- **Por que pedido, e não cadastro direto.** "Parceiro verificado" é o que a
-- família lê antes de deixar uma criança num lugar que ela não conhece. Se
-- qualquer um se cadastra e já publica turma, o selo deixa de significar
-- alguma coisa no mesmo dia. E há o outro lado: o repasse. Um cadastro livre
-- seria um cadastro de gente pedindo dinheiro, com verificação nenhuma.
--
-- Então o pedido é um pedido: ele NÃO cria parceiro, não aparece no app, não
-- publica turma. Vira parceiro quando alguém do Kidoo aprova.

-- ---------------------------------------------------------- quem decide ---

-- Quem é do Kidoo. Uma tabela, e não uma coluna em `guardians`, porque isto
-- não é atributo de família: é papel de operação, e mistura de papéis num
-- campo só é como se ganha privilégio por engano.
create table if not exists kidoo_admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table kidoo_admins enable row level security;
-- Sem policy: ninguém lê nem escreve pelo PostgREST. Quem entra aqui entra
-- pelo SQL Editor, de propósito — é a lista de quem pode aprovar repasse.

create or replace function is_kidoo_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from kidoo_admins where user_id = auth.uid());
$$;

grant execute on function is_kidoo_admin() to authenticated;

-- ------------------------------------------------------------- o pedido ---

do $$ begin
  if not exists (select 1 from pg_type where typname = 'application_status') then
    create type application_status as enum ('pendente', 'aprovado', 'recusado');
  end if;
end $$;

create table if not exists partner_applications (
  id            uuid primary key default gen_random_uuid(),
  -- Quem pediu. O e-mail vem da conta, não de um campo digitado: assim o
  -- contato do pedido é o mesmo que vai administrar o painel depois.
  user_id       uuid not null references auth.users (id) on delete cascade,

  -- o estabelecimento
  name          text not null,
  neighborhood  text not null,
  city          text not null,
  address       text not null,
  latitude      double precision not null,
  longitude     double precision not null,
  phone         text not null,

  -- o que ele oferece. `categories` referencia a lista fechada de modalidades;
  -- a checagem vai na função de aprovar, porque um `references` por elemento de
  -- array o Postgres não faz.
  categories    text[] not null check (cardinality(categories) between 1 and 8),
  min_age       smallint not null check (min_age >= 0),
  max_age       smallint not null check (max_age >= min_age),
  photo_path    text,

  -- para o repasse existir um dia. Hoje não há pagamento nenhum: isto é
  -- cadastro guardado, e pedir cedo evita ter que voltar em todo mundo depois.
  legal_name    text,
  cnpj          text,
  pix_key       text,

  status        application_status not null default 'pendente',
  reason        text,
  decided_at    timestamptz,
  decided_by    uuid references auth.users (id),
  -- O parceiro criado a partir deste pedido. Guardar o vínculo é o que impede
  -- aprovar duas vezes e criar dois estabelecimentos iguais.
  partner_id    uuid references partners (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists applications_pending_idx
  on partner_applications (created_at) where status = 'pendente';

-- Um pedido em aberto por conta. Sem isto, clicar duas vezes em "enviar"
-- criaria dois pedidos idênticos na fila de quem analisa — e recusar um
-- deixaria o outro vivo.
create unique index if not exists applications_one_open_per_user
  on partner_applications (user_id) where status = 'pendente';

alter table partner_applications enable row level security;

-- A pessoa vê e mexe no próprio pedido, e só enquanto ele está pendente:
-- editar um pedido já aprovado mudaria o cadastro do parceiro pelas costas.
drop policy if exists applications_own on partner_applications;
create policy applications_own on partner_applications
  for select to authenticated
  using (user_id = auth.uid() or is_kidoo_admin());

drop policy if exists applications_insert on partner_applications;
create policy applications_insert on partner_applications
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists applications_edit on partner_applications;
create policy applications_edit on partner_applications
  for update to authenticated
  using (user_id = auth.uid() and status <> 'aprovado')
  -- `with check` sobre o status impede o truque óbvio: o dono do pedido
  -- marcando o próprio pedido como aprovado.
  with check (user_id = auth.uid() and status = 'pendente');

-- A policy diz QUEM pode; o grant diz SE a tabela é alcançável. São duas
-- coisas, e vem antes a segunda: sem `grant`, o Postgres barra no privilégio e
-- a policy nem chega a ser avaliada. Já custou caro uma vez neste projeto, com
-- a caixa de saída dos avisos.
grant select, insert, update on partner_applications to authenticated;

-- ---------------------------------------------------------- a aprovação ---

/**
 * Aprovar cria o parceiro de verdade — e é a única porta para isso.
 *
 * `security definer` porque cria linha em `partners`, `partner_members`,
 * `activities` e `payout_rates`, e nenhuma dessas escritas pode ficar aberta
 * para o parceiro: quem define repasse é o Kidoo, não quem recebe.
 *
 * O valor do repasse entra aqui, no padrão da casa, e não vem do pedido de
 * propósito. Deixar o candidato sugerir o próprio repasse seria deixá-lo
 * emitir a própria nota.
 */
create or replace function approve_application(p_id uuid)
returns partners
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ped     partner_applications%rowtype;
  v_partner partners%rowtype;
  v_cat     text;
begin
  if not is_kidoo_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;

  select * into v_ped from partner_applications where id = p_id for update;
  if not found then
    raise exception 'application_not_found' using errcode = 'P0002';
  end if;
  if v_ped.status = 'aprovado' then
    raise exception 'already_approved' using errcode = 'P0001';
  end if;

  -- A modalidade é lista fechada. Um pedido com categoria inventada viraria
  -- atividade que o app não sabe desenhar — sem ícone, sem cor, sem filtro.
  foreach v_cat in array v_ped.categories loop
    if not exists (select 1 from activity_categories where id = v_cat) then
      raise exception 'unknown_category' using errcode = 'P0001';
    end if;
  end loop;

  insert into partners (name, neighborhood, city, verified, latitude, longitude)
  values (v_ped.name, v_ped.neighborhood, v_ped.city, true, v_ped.latitude, v_ped.longitude)
  returning * into v_partner;

  insert into partner_members (partner_id, user_id, role)
  values (v_partner.id, v_ped.user_id, 'owner');

  -- O repasse padrão da casa. Vaga ociosa vale menos porque a turma acontece
  -- de qualquer jeito; vaga cheia é turma que só existe por causa do Kidoo.
  insert into payout_rates (partner_id, kind, amount_cents) values
    (v_partner.id, 'ociosa',  800),
    (v_partner.id, 'cheia',  1800);

  -- Uma atividade por modalidade, com a faixa etária que ele declarou. É o
  -- esqueleto: título e descrição ele ajusta depois, no painel.
  insert into activities (partner_id, category_id, title, min_age, max_age, description)
  select v_partner.id, c.id, c.label || ' — ' || v_ped.name,
         v_ped.min_age, v_ped.max_age, ''
    from activity_categories c
   where c.id = any (v_ped.categories);

  update partner_applications
     set status = 'aprovado', decided_at = now(), decided_by = auth.uid(),
         partner_id = v_partner.id, reason = null, updated_at = now()
   where id = p_id;

  return v_partner;
end;
$$;

/**
 * Recusar, com motivo.
 *
 * O motivo não é gentileza: sem ele o candidato reenvia o mesmo pedido, e
 * quem analisa recusa o mesmo pedido de novo, para sempre.
 */
create or replace function reject_application(p_id uuid, p_reason text)
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

  update partner_applications
     set status = 'recusado', reason = p_reason, decided_at = now(),
         decided_by = auth.uid(), updated_at = now()
   where id = p_id and status <> 'aprovado';

  if not found then
    raise exception 'application_not_found' using errcode = 'P0002';
  end if;
end;
$$;

-- A fila de quem analisa. Vai por função para trazer o e-mail da conta junto,
-- que está em `auth.users` e não sai por PostgREST.
create or replace function pending_applications()
returns table (
  id           uuid,
  name         text,
  neighborhood text,
  city         text,
  address      text,
  phone        text,
  email        text,
  categories   text[],
  min_age      smallint,
  max_age      smallint,
  cnpj         text,
  created_at   timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select a.id, a.name, a.neighborhood, a.city, a.address, a.phone,
         u.email, a.categories, a.min_age, a.max_age, a.cnpj, a.created_at
    from partner_applications a
    join auth.users u on u.id = a.user_id
   where a.status = 'pendente' and is_kidoo_admin()
   order by a.created_at;
$$;

-- ------------------------------------------------------ a foto do espaço ---

-- A foto do pedido vai para uma pasta por candidato dentro do bucket que já
-- existe. Precisa ser assim porque, no momento do envio, o parceiro AINDA NÃO
-- EXISTE: não há `partner_id` para pôr no caminho, que é o que a policy das
-- capas compara.
--
-- Ela não vira capa de atividade automaticamente, e isso é decisão: esta foto
-- serve para quem analisa julgar o espaço. A capa que a família vê o parceiro
-- escolhe depois, no painel, por atividade — e ali ele já sabe qual imagem
-- vende cada turma.
do $$
begin
  if to_regclass('storage.objects') is null then
    raise notice 'sem schema storage (Postgres local): pulando a policy da foto';
    return;
  end if;

  drop policy if exists pedidos_propria_pasta on storage.objects;
  create policy pedidos_propria_pasta on storage.objects
    for all to authenticated
    using (
      bucket_id = 'atividades'
      and (storage.foldername(name))[1] = 'pedidos'
      and (storage.foldername(name))[2] = auth.uid()::text
    )
    with check (
      bucket_id = 'atividades'
      and (storage.foldername(name))[1] = 'pedidos'
      and (storage.foldername(name))[2] = auth.uid()::text
    );
end $$;

grant execute on function approve_application(uuid)      to authenticated;
grant execute on function reject_application(uuid, text) to authenticated;
grant execute on function pending_applications()         to authenticated;
