-- =====================================================================
-- A assinatura vencida volta para a fila quando a família escolhe de novo.
-- =====================================================================
--
-- O portão (000020) fez `subscribe_plan` PRESERVAR o estado na troca de plano,
-- e a razão estava certa: quem já está ativo e muda de plano não pode ser
-- trancado para fora por causa disso.
--
-- O que ninguém olhou foi o `vencida`. Preservar ali é um beco:
--
--   assina → admin confirma → ativa
--   o mês vence            → vencida      (certo)
--   escolhe plano de novo  → vencida      (e renews_at pulou um mês)
--
-- A tela diz "Assinatura vencida" e oferece escolher plano. A família escolhe,
-- continua vencida, e nada explica por quê. `book_session` segue recusando.
-- Pior: ela não entra na fila de "aguardando confirmação" do painel, então
-- quem administra não fica sabendo que existe alguém esperando — o beco não
-- aparece nem para quem poderia abri-lo.
--
-- `aguardando` é exatamente o estado que descreve a situação: escolheu o
-- plano, ninguém confirmou o pagamento. É para lá que ela volta.
--
-- `ativa` continua preservado, pelo motivo original. Com cobrança de verdade a
-- troca de plano gera uma cobrança nova, e é o gateway que decide devolver
-- para `aguardando` — não aqui.
--
-- O corpo é o da 000020 com o `status` mudado; o resto é idêntico de propósito,
-- porque `create or replace` substitui a função inteira.
-- =====================================================================

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
