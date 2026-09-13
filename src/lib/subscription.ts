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
    // Nasce aguardando: escolher o plano deixou de ser ter o plano. Quem
    // confirma é o pagamento — hoje, alguém do Kidoo olhando o comprovante.
    status: 'aguardando',
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
  /*
    O mês vencido derruba a assinatura, e derruba antes de qualquer cota.

    `renewsAt` era escrito desde o primeiro dia e nunca lido: quem renovava era
    a virada da semana, e ela voltava ao cheio para sempre — mesmo com o mês
    vencido há um ano. Espelha `roll_subscription_cycle` do banco.
  */
  if (subscription.status === 'ativa' && now.getTime() >= Date.parse(subscription.renewsAt)) {
    return { ...subscription, status: 'vencida' };
  }

  // Quem não está ativo não ganha cota nova: `aguardando` nunca chegou a valer,
  // e `vencida` deixou de valer.
  if (subscription.status !== 'ativa') return subscription;
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
