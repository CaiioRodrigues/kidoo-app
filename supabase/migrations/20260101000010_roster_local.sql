-- O parceiro passa a ver se a chegada teve localização conferida.
--
-- Quem decide o repasse é ele: `partner_payouts` só conta reserva com
-- `partner_confirmed_at`. Mas até aqui ele digitava os seis dígitos sem saber
-- que aquele check-in podia ter vindo de 12 km — `session_roster` devolvia
-- nome, idade, status e se havia código, e nada sobre localização.
--
-- Nos cinco primeiros check-ins reais, cinco vieram sem coordenada nenhuma. A
-- regra do banco libera nesse caso de propósito (negamos com prova contra,
-- nunca por falta de prova, senão uma quadra coberta sem sinal travaria a
-- família na porta). O preço dessa escolha é que a única pessoa capaz de
-- perceber "essa criança não está aqui" precisa da informação — e é ela que
-- está no balcão, olhando para a criança.
--
-- Não é bloqueio nem acusação: é um dado a mais para quem já decide.

-- O Postgres não deixa trocar o tipo de retorno com `create or replace`, e a
-- coluna nova muda a assinatura: é preciso derrubar antes.
drop function if exists session_roster(uuid);

create function session_roster(p_session_id uuid)
returns table (
  booking_id           uuid,
  child_first_name     text,
  child_age            int,
  status               booking_status,
  checked_in_at        timestamptz,
  partner_confirmed_at timestamptz,
  slot_kind            slot_kind,
  has_code             boolean,
  location_verified    boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select b.id,
         split_part(c.name, ' ', 1),
         extract(year from age(c.birth_date))::int,
         b.status,
         b.checked_in_at,
         b.partner_confirmed_at,
         b.slot_kind,
         b.check_in is not null,
         -- Três estados, e o nulo importa: `true` conferida, `false` o app
         -- tentou e não bateu ou não teve leitura, `null` ainda não houve
         -- check-in. Colapsar os dois últimos marcaria de suspeita toda
         -- criança que ainda não chegou.
         case
           when b.check_in_proof is null then null
           else coalesce((b.check_in_proof->>'locationVerified')::boolean, false)
         end
    from bookings b
    join children c   on c.id = b.child_id
    join activities a on a.id = b.activity_id
   where b.session_id = p_session_id
     and b.status <> 'cancelled'
     and is_partner_member(a.partner_id)
   order by c.name;
$$;

-- O `drop` levou o grant junto, então ele volta aqui.
--
-- Sendo honesto sobre o que esta linha faz: o Postgres já concede `execute` a
-- `PUBLIC` por padrão numa função nova, então sem ela o painel continuaria
-- funcionando. Ela existe para o privilégio ficar declarado, como está em
-- `partner_agenda` e nas demais — e para que uma futura revogação do `PUBLIC`
-- não derrube esta função junto, em silêncio.
--
-- A função é `security definer` e filtra por `is_partner_member(auth.uid())`:
-- quem chama sem ser do parceiro recebe zero linhas, não um erro.
grant execute on function session_roster(uuid) to authenticated;
