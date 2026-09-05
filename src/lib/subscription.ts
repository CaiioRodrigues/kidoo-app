import { addWeeks, startOfWeek } from 'date-fns';

import type { Plan, SubscriptionState } from '@/types/domain';

/**
 * Ciclo de coins do Kidoo.
 *
 * A cobrança é mensal, mas a cota de Kidoo Coins é semanal e volta ao cheio
 * toda segunda-feira. Coins não acumulam: o que sobra na semana é perdido na
 * virada — o objetivo é incentivar frequência, não estoque.
 */

/** Semana começa na segunda-feira. */
const WEEK_OPTIONS = { weekStartsOn: 1 } as const;

export function currentCycle(now: Date = new Date()): {
  startsAt: string;
  resetsAt: string;
} {
  const start = startOfWeek(now, WEEK_OPTIONS);
  return {
    startsAt: start.toISOString(),
    resetsAt: addWeeks(start, 1).toISOString(),
  };
}

export function startSubscription(plan: Plan, now: Date = new Date()): SubscriptionState {
  const cycle = currentCycle(now);
  const renewsAt = new Date(now);
  renewsAt.setMonth(renewsAt.getMonth() + 1);

  return {
    planId: plan.id,
    coinsPerWeek: plan.coinsPerWeek,
    coinsRemaining: plan.coinsPerWeek,
    cycleStartsAt: cycle.startsAt,
    cycleResetsAt: cycle.resetsAt,
    renewsAt: renewsAt.toISOString(),
  };
}

/**
 * Devolve a assinatura já com a semana corrente aplicada. Chamar antes de
 * qualquer leitura ou débito garante que uma virada de semana seja respeitada
 * mesmo que o app tenha ficado aberto.
 */
export function withCurrentCycle(
  subscription: SubscriptionState,
  now: Date = new Date(),
): SubscriptionState {
  if (now.getTime() < Date.parse(subscription.cycleResetsAt)) return subscription;

  const cycle = currentCycle(now);
  return {
    ...subscription,
    coinsRemaining: subscription.coinsPerWeek,
    cycleStartsAt: cycle.startsAt,
    cycleResetsAt: cycle.resetsAt,
  };
}

/** Dias inteiros até a cota voltar ao cheio. */
export function daysUntilReset(subscription: SubscriptionState, now: Date = new Date()): number {
  const ms = Date.parse(subscription.cycleResetsAt) - now.getTime();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}
