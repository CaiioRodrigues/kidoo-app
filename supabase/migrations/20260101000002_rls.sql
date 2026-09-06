-- Row Level Security.
--
-- São dois públicos no mesmo banco: o responsável, no app, e o parceiro, no
-- painel. A regra é que **nenhum dos dois enxerga o que é do outro**, e que um
-- parceiro nunca enxerga outro parceiro. Sem RLS, um id vazado bastaria.

alter table guardians          enable row level security;
alter table children           enable row level security;
alter table partners           enable row level security;
alter table partner_members    enable row level security;
alter table activity_categories enable row level security;
alter table activities         enable row level security;
alter table class_sessions     enable row level security;
alter table subscriptions      enable row level security;
alter table bonus_grants       enable row level security;
alter table bookings           enable row level security;
alter table reviews            enable row level security;
alter table payout_rates       enable row level security;

-- Quem administra este parceiro?
create or replace function is_partner_member(p_partner_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from partner_members
     where partner_id = p_partner_id and user_id = auth.uid()
  );
$$;

-- --------------------------------------------------------------- catálogo ---
-- Catálogo é público: dá para explorar sem conta, e é assim que o app funciona
-- hoje para o visitante.

create policy catalog_read on partners            for select using (true);
create policy catalog_read on activity_categories for select using (true);
create policy catalog_read on activities          for select using (true);
create policy catalog_read on class_sessions      for select using (true);

-- Só o dono da turma mexe nela. É este policy que faz "o parceiro libera as
-- vagas" ser uma garantia do banco, e não uma promessa da interface.
create policy partner_writes_sessions on class_sessions
  for all
  using (is_partner_member((select partner_id from activities where id = activity_id)))
  with check (is_partner_member((select partner_id from activities where id = activity_id)));

create policy partner_writes_activities on activities
  for all using (is_partner_member(partner_id)) with check (is_partner_member(partner_id));

create policy partner_reads_own on partners
  for update using (is_partner_member(id)) with check (is_partner_member(id));

create policy member_reads_own on partner_members
  for select using (user_id = auth.uid());

-- ------------------------------------------------------------ responsável ---

create policy own_row on guardians
  for all using (id = auth.uid()) with check (id = auth.uid());

create policy own_children on children
  for all using (guardian_id = auth.uid()) with check (guardian_id = auth.uid());

create policy own_subscription on subscriptions
  for all using (guardian_id = auth.uid()) with check (guardian_id = auth.uid());

create policy own_bonus on bonus_grants
  for all
  using (exists (select 1 from children c where c.id = child_id and c.guardian_id = auth.uid()))
  with check (exists (select 1 from children c where c.id = child_id and c.guardian_id = auth.uid()));

-- ---------------------------------------------------------------- reserva ---
-- O responsável vê as próprias reservas. O parceiro vê as reservas das turmas
-- dele — precisa, para saber quem vem hoje e confirmar a presença.

create policy guardian_reads_bookings on bookings
  for select using (guardian_id = auth.uid());

create policy partner_reads_bookings on bookings
  for select using (is_partner_member((select partner_id from activities where id = activity_id)));

-- Confirmar presença é do parceiro. A escrita é restrita a este caminho: criar
-- e cancelar reserva passam pelas funções, que travam a vaga.
create policy partner_confirms_presence on bookings
  for update
  using (is_partner_member((select partner_id from activities where id = activity_id)))
  with check (is_partner_member((select partner_id from activities where id = activity_id)));

-- ------------------------------------------------------------- avaliações ---

create policy reviews_public_read on reviews for select using (true);

create policy reviews_own_write on reviews
  for insert
  with check (
    guardian_id = auth.uid()
    and exists (
      select 1 from bookings b
       where b.id = booking_id
         and b.guardian_id = auth.uid()
         -- Só avalia quem foi: sem check-in não há o que avaliar.
         and b.status in ('checked_in', 'completed')
    )
  );

-- ---------------------------------------------------------------- repasse ---
-- Tabela de preço é contrato: o parceiro lê o próprio, ninguém edita pelo app.

create policy partner_reads_rate on payout_rates
  for select using (is_partner_member(partner_id));

-- ----------------------------------------------------------------- grants ---
-- RLS filtra linhas; GRANT decide se a tabela pode ser tocada. São camadas
-- diferentes, e sem a segunda o Postgres barra antes de a policy ser avaliada.
--
-- O Supabase concede isto por default privileges no schema public, mas depender
-- disso deixa a migration não reproduzível: num banco limpo o app inteiro
-- responde "permission denied", e o erro não menciona RLS em lugar nenhum.

-- Catálogo: leitura para quem nem tem conta — o app permite explorar como visitante.
grant select on partners, activity_categories, activities, class_sessions, reviews
  to anon, authenticated;

-- Dados do responsável. Quais linhas, quem decide é a policy acima.
grant select, insert, update, delete
  on guardians, children, subscriptions, bonus_grants, bookings, reviews
  to authenticated;

-- Painel do parceiro: publica turma, edita a atividade, confirma presença.
grant insert, update, delete on activities, class_sessions to authenticated;
grant update on partners to authenticated;
grant select on partner_members, payout_rates, partner_payouts to authenticated;

-- Reservar e cancelar só pelas funções: são elas que travam a vaga.
grant execute on function book_session(uuid, uuid) to authenticated;
grant execute on function cancel_booking(uuid) to authenticated;
grant execute on function is_partner_member(uuid) to anon, authenticated;
