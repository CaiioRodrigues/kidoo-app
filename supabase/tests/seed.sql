-- Cenário mínimo para provar isolamento: dois responsáveis e dois parceiros.
-- A turma da Arena tem UMA vaga aberta de propósito — é ela que expõe corrida.
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111','ana@ex.com'),
  ('22222222-2222-2222-2222-222222222222','bruno@ex.com'),
  ('33333333-3333-3333-3333-333333333333','arena@ex.com'),
  ('44444444-4444-4444-4444-444444444444','pampulha@ex.com');

-- O trigger on_auth_user_created já criou os perfis acima; aqui só nomeamos.
insert into guardians (id, name, email) values
  ('11111111-1111-1111-1111-111111111111','Ana','ana@ex.com'),
  ('22222222-2222-2222-2222-222222222222','Bruno','bruno@ex.com')
on conflict (id) do update set name = excluded.name;

insert into children (id, guardian_id, name, birth_date) values
  ('aaaaaaaa-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','Joao','2018-03-15'),
  ('bbbbbbbb-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222','Lia','2017-06-01');

insert into partners (id, name, neighborhood, city, verified, latitude, longitude) values
  ('cccccccc-0000-0000-0000-00000000000a','Arena Kids','Buritis','BH',true,-19.9702,-43.9803),
  ('cccccccc-0000-0000-0000-00000000000b','Clube Pampulha','Pampulha','BH',true,-19.8551,-43.9797);

insert into partner_members (partner_id, user_id, role) values
  ('cccccccc-0000-0000-0000-00000000000a','33333333-3333-3333-3333-333333333333','owner'),
  ('cccccccc-0000-0000-0000-00000000000b','44444444-4444-4444-4444-444444444444','owner');

-- As modalidades vêm da migration 000005: são lista fechada, não dado de teste.

insert into activities (id, partner_id, category_id, title, min_age, max_age) values
  ('dddddddd-0000-0000-0000-00000000000a','cccccccc-0000-0000-0000-00000000000a','futebol','Futebol Kids',6,9),
  ('dddddddd-0000-0000-0000-00000000000b','cccccccc-0000-0000-0000-00000000000b','natacao','Natação Infantil',5,10);

insert into class_sessions (id, activity_id, starts_at, capacity, enrolled, slots_open, slots_taken, kind, coin_cost) values
  ('eeeeeeee-0000-0000-0000-000000000001','dddddddd-0000-0000-0000-00000000000a', now() + interval '2 hours', 20, 7, 1, 0, 'ociosa', 2),
  ('eeeeeeee-0000-0000-0000-000000000002','dddddddd-0000-0000-0000-00000000000b', now() + interval '3 hours', 8, 5, 2, 0, 'cheia', 3),
  -- turma começando já: é a única em que o check-in cabe na janela
  ('eeeeeeee-0000-0000-0000-000000000003','dddddddd-0000-0000-0000-00000000000a', now() + interval '10 minutes', 20, 7, 3, 0, 'ociosa', 2);

-- Assinatura e bônus: sem eles a reserva falha por falta de coin, e o teste
-- não chegaria a exercitar capacidade nem RLS.
insert into subscriptions (guardian_id, plan_id, coins_per_week, coins_remaining, renews_at) values
  ('11111111-1111-1111-1111-111111111111','plus',12,12, now() + interval '7 days'),
  ('22222222-2222-2222-2222-222222222222','plus',12,12, now() + interval '7 days');

insert into payout_rates (partner_id, kind, amount_cents) values
  ('cccccccc-0000-0000-0000-00000000000a','ociosa',800),
  ('cccccccc-0000-0000-0000-00000000000a','cheia',1800);
