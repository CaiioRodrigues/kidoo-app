-- O estabelecimento que saiu.
--
-- `partners` só sabia dizer se alguém é verificado, nunca se ainda faz parte.
-- Quem encerrava a parceria continuava no catálogo, com o selo, recebendo
-- reserva — e apagar a linha não era saída: `bookings.activity_id` é
-- `on delete restrict`, então o banco recusa apagar quem já recebeu uma
-- criança, e recusa com razão. O histórico da família não pode sumir porque a
-- escolinha fechou.
--
-- Então não se apaga: desliga-se. `active` é o eixo certo, e não `verified`:
-- "foi conferido" e "está no ar" são duas perguntas diferentes, e um parceiro
-- que sai continua tendo sido verificado enquanto esteve.

alter table partners add column if not exists active boolean not null default true;

comment on column partners.active is
  'Se o estabelecimento ainda faz parte. Desligado some do catálogo e para de receber reserva; o histórico de quem já foi continua inteiro.';

-- A visão do catálogo passa a olhar os dois: a atividade publicada E o
-- estabelecimento no ar. `a.active` já estava aqui; o parceiro faltava.
-- `drop` e `create` pelo mesmo motivo da 000016: `or replace` não sabe
-- acrescentar coluna no meio, e num banco que ainda não tenha a 000016 as
-- colunas do parceiro entrariam fora de ordem. Nada no banco depende da
-- visão; o `grant` volta logo abaixo.
drop view if exists activities_public;

create view activities_public as
select
  a.id, a.partner_id, a.category_id, a.title, a.image_url,
  a.min_age, a.max_age, a.description, a.tags, a.rating, a.review_count,
  p.name          as partner_name,
  p.neighborhood  as partner_neighborhood,
  p.city          as partner_city,
  p.verified      as partner_verified,
  p.latitude      as partner_latitude,
  p.longitude     as partner_longitude,
  p.address       as partner_address,
  p.phone         as partner_phone,
  o.coin_cost     as coin_cost,
  o.next_starts_at as next_session_at,
  coalesce(o.open_sessions, 0) as open_sessions
from activities a
join partners p on p.id = a.partner_id
left join lateral (
  select min(s.coin_cost)  as coin_cost,
         min(s.starts_at)  as next_starts_at,
         count(*)          as open_sessions
    from class_sessions_open s
   where s.activity_id = a.id
) o on true
where a.active and p.active;

alter view activities_public set (security_invoker = true);
grant select on activities_public to anon, authenticated;

-- ------------------------------------------------- a porta que ficou aberta ---

/*
  Sumir do catálogo não basta, e isto vale para além do parceiro que saiu.

  `book_session` nunca olhou `activities.active`. A visão esconde a atividade
  despublicada da busca, mas a reserva não passa pela visão: passa por um id de
  turma, e um id continua valendo depois de a tela ter sumido — uma aba aberta
  desde ontem, um link guardado, um cliente feito à mão. Era possível reservar
  numa atividade despublicada desde que o "despublicar" existe.

  As duas checagens entram juntas porque é o mesmo furo visto de dois ângulos:
  o catálogo decide o que se vê, e só a função decide o que se pode.

  O corpo abaixo é o da 000008 com essas duas checagens a mais, e nada além
  disso. `create or replace` substitui a função inteira: reescrever de memória
  perde o que não for repetido — e o que quase se perdeu aqui foi a guarda de
  `already_booked`, que existe porque a mesma criança conseguia pegar dois
  lugares na mesma turma.
*/
create or replace function book_session(p_session_id uuid, p_child_id uuid)
returns bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_guardian  uuid := auth.uid();
  v_session   class_sessions%rowtype;
  v_activity  activities%rowtype;
  v_partner   partners%rowtype;
  v_booking   bookings%rowtype;
  v_sub       subscriptions%rowtype;
  v_from_bonus int;
  v_from_sub   int;
begin
  if v_guardian is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  -- A criança é de quem está reservando? Sem isto, um id vazado permitiria
  -- reservar no nome de criança alheia.
  if not exists (
    select 1 from children
     where id = p_child_id and guardian_id = v_guardian
  ) then
    raise exception 'child_not_found' using errcode = 'P0002';
  end if;

  -- `for update` serializa quem chegar junto: o segundo só lê depois que o
  -- primeiro comitar, e aí enxerga o slots_taken já incrementado.
  select * into v_session
    from class_sessions
   where id = p_session_id
     for update;

  if not found then
    raise exception 'session_not_found' using errcode = 'P0002';
  end if;
  if v_session.starts_at <= now() then
    raise exception 'session_already_started' using errcode = 'P0001';
  end if;
  -- Antes de olhar lotação: se esta criança já tem lugar nesta turma, o
  -- problema não é vaga. Responder 'turma cheia' a quem já está dentro seria
  -- mentira, e mandaria a família procurar outro horário sem necessidade.
  --
  -- Não substitui o índice `one_seat_per_child`, que continua sendo a garantia
  -- contra dois toques simultâneos: entre este `exists` e o `insert` ainda cabe
  -- uma segunda transação. Esta checagem existe para o caso comum — a pessoa
  -- tocou de novo — falhar com uma frase que dá para ler, em vez do
  -- `duplicate key value violates unique constraint` que o app não traduz.
  if exists (
    select 1 from bookings
     where session_id = p_session_id
       and child_id   = p_child_id
       and status <> 'cancelled'
  ) then
    raise exception 'already_booked' using errcode = 'P0001';
  end if;

  if v_session.slots_taken >= v_session.slots_open then
    raise exception 'session_full' using errcode = 'P0001';
  end if;

  select * into v_activity from activities where id = v_session.activity_id;
  select * into v_partner  from partners   where id = v_activity.partner_id;

  -- As duas recusas são separadas porque a família merece frases diferentes:
  -- "esta turma saiu do ar" tem outra atividade ao lado; "este lugar não faz
  -- mais parte do Kidoo" não tem, e mandar procurar de novo seria cruel.
  if not v_activity.active then
    raise exception 'activity_inactive' using errcode = 'P0001';
  end if;
  if not v_partner.active then
    raise exception 'partner_inactive' using errcode = 'P0001';
  end if;

  -- O bônus entra antes da cota da assinatura porque ele expira; a cota volta
  -- ao cheio toda semana de qualquer jeito.
  v_from_bonus := least(bonus_balance(p_child_id), v_session.coin_cost);
  v_from_sub   := v_session.coin_cost - v_from_bonus;

  if v_from_sub > 0 then
    -- Aplica a virada de semana ANTES de olhar o saldo: uma reserva feita na
    -- segunda tem de usar a cota nova, e quem decide isso é o banco. Confiar no
    -- cliente para resetar deixaria um app que não recarrega gastando a cota da
    -- semana passada para sempre. (`roll_subscription_cycle` vive na migration
    -- 000005; plpgsql resolve o nome na chamada, não na criação.)
    v_sub := roll_subscription_cycle(v_guardian);
    if v_sub.guardian_id is null then
      raise exception 'no_subscription' using errcode = 'P0001';
    end if;
    if v_sub.coins_remaining < v_from_sub then
      raise exception 'insufficient_coins' using errcode = 'P0001';
    end if;
    update subscriptions
       set coins_remaining = coins_remaining - v_from_sub
     where guardian_id = v_guardian;
  end if;

  if v_from_bonus > 0 then
    perform consume_bonus(p_child_id, v_from_bonus);
  end if;

  update class_sessions
     set slots_taken = slots_taken + 1
   where id = p_session_id;

  insert into bookings (
    guardian_id, child_id, session_id, activity_id,
    scheduled_at, coin_cost, slot_kind, payment
  ) values (
    v_guardian, p_child_id, v_session.id, v_activity.id,
    v_session.starts_at, v_session.coin_cost, v_session.kind,
    jsonb_build_object('fromBonus', v_from_bonus, 'fromSubscription', v_from_sub,
                       'total', v_session.coin_cost)
  )
  returning * into v_booking;

  return v_booking;
end;
$$;

-- --------------------------------------------------------- ligar e desligar ---

/**
 * Liga ou desliga um estabelecimento. Só quem analisa pedidos.
 *
 * Devolve quantas aulas futuras ficaram de pé, e devolver esse número é o
 * ponto: desligar não cancela nada. As reservas já feitas continuam lá, com os
 * coins já gastos, e a família que marcou para sábado não é avisada por esta
 * função.
 *
 * É deliberado. Cancelar em massa devolve coins, mexe em cota de assinatura e
 * não tem volta — e nem sempre é o certo: um parceiro tirado do ar por acerto
 * comercial costuma honrar as aulas já marcadas. Quem sabe qual dos dois casos
 * é são as pessoas, não o banco. A função entrega o número para a tela avisar,
 * e o cancelamento continua sendo um ato separado e consciente.
 */
create or replace function set_partner_active(p_id uuid, p_active boolean)
returns table (partner_id uuid, active boolean, future_bookings integer)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_kidoo_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;

  update partners set active = p_active where id = p_id;
  if not found then
    raise exception 'partner_not_found' using errcode = 'P0002';
  end if;

  return query
    select p_id,
           p_active,
           (select count(*)::integer
              from bookings b
              join activities a on a.id = b.activity_id
             where a.partner_id = p_id
               and b.status in ('confirmed', 'checked_in')
               and b.scheduled_at > now());
end;
$$;

grant execute on function set_partner_active(uuid, boolean) to authenticated;

/**
 * Todos os estabelecimentos, para quem analisa.
 *
 * `partners` é legível por qualquer um (é o catálogo), mas ninguém precisava da
 * lista inteira até existir uma tela para ligar e desligar. As contagens vêm
 * junto porque desligar sem saber quantas aulas futuras existem é desligar no
 * escuro.
 */
create or replace function admin_partners()
returns table (
  id uuid,
  name text,
  neighborhood text,
  city text,
  verified boolean,
  active boolean,
  activities integer,
  future_bookings integer
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_kidoo_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;

  return query
    select p.id, p.name, p.neighborhood, p.city, p.verified, p.active,
           (select count(*)::integer from activities a
             where a.partner_id = p.id and a.active),
           (select count(*)::integer
              from bookings b join activities a on a.id = b.activity_id
             where a.partner_id = p.id
               and b.status in ('confirmed', 'checked_in')
               and b.scheduled_at > now())
      from partners p
     order by p.active desc, p.name;
end;
$$;

grant execute on function admin_partners() to authenticated;
