-- =====================================================================
-- Kidoo — a assinatura vencida volta para a fila.
--
-- Para um banco que JÁ EXISTE, e DEPOIS da 28. Cole inteiro no SQL Editor do
-- Supabase e clique em Run. É idempotente.
--
-- Conserta um beco: a família com assinatura vencida escolhia um plano de novo
-- e continuava vencida, sem nada na tela explicando — e sem aparecer na fila
-- de "aguardando confirmação" do painel, então quem administra nem ficava
-- sabendo que havia alguém esperando.
--
-- Não muda quem já está ativo: trocar de plano continua preservando o estado.
-- =====================================================================

begin;

create or replace function subscribe_plan(p_plan_id text)
returns subscriptions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_guardian uuid := auth.uid();
  v_plan     plans%rowtype;
  v_sub      subscriptions%rowtype;
begin
  if v_guardian is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select * into v_plan from plans where id = p_plan_id;
  if not found then
    raise exception 'plan_not_found' using errcode = 'P0002';
  end if;

  insert into subscriptions (guardian_id, plan_id, coins_per_week, coins_remaining,
                             cycle_started_at, renews_at, status)
  values (v_guardian, v_plan.id, v_plan.coins_per_week, v_plan.coins_per_week,
          week_start(now()), now() + interval '1 month', 'aguardando')
  on conflict (guardian_id) do update set
    plan_id         = excluded.plan_id,
    coins_per_week  = excluded.coins_per_week,
    -- Trocar de plano no meio da semana não devolve o que já foi gasto: a cota
    -- nova entra descontada do que a família já usou.
    coins_remaining = greatest(0, least(excluded.coins_per_week,
                       excluded.coins_per_week - (subscriptions.coins_per_week - subscriptions.coins_remaining))),
    renews_at       = excluded.renews_at,
    -- Vencida que escolhe de novo volta para a fila de confirmação. Ativa
    -- continua ativa. Aguardando continua aguardando — escolher outro plano
    -- antes de confirmarem o pagamento não é uma confirmação.
    status          = case when subscriptions.status = 'vencida'
                           then 'aguardando'::subscription_status
                           else subscriptions.status end
  returning * into v_sub;

  return v_sub;
end;
$$;

grant execute on function subscribe_plan(text) to authenticated;

commit;

-- ---------------------------------------------------------- conferir -------

-- A função passou a tratar o vencido. Sem isto, a linha volta `false`.
select prosrc like '%vencida%' as vencida_volta_para_a_fila
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname = 'subscribe_plan';

-- Quem está preso hoje: assinaturas vencidas. Elas NÃO são destravadas por
-- esta migration de propósito — ninguém confirmou pagamento nenhum. Elas
-- voltam para a fila na próxima vez que a família escolher um plano.
select count(*) as vencidas_hoje from subscriptions where status = 'vencida';
