import { addDays } from 'date-fns';

import type { BonusGrant, BonusWallet, CoinPayment } from '@/types/domain';

/**
 * Regras dos Kidoo Bônus.
 *
 * Ganhos ao subir de nível, com validade de 30 dias por lote. A recompensa
 * cresce por faixa de nível, mas de forma contida: subir de nível deve ser
 * um agrado, não um substituto da assinatura.
 */

export const BONUS_LIFETIME_DAYS = 30;

/**
 * Bônus concedido ao alcançar um nível.
 *
 *   níveis 2 e 3      → 1 moeda
 *   níveis 4 a 6      → 2 moedas
 *   níveis 7 a 9      → 3 moedas
 *   nível 10 em diante → 4 moedas
 *
 * Nível 1 é o ponto de partida e não gera bônus. Do nível 2 ao 10 a criança
 * acumula 21 moedas no total — com o custo médio de 2,83 coins por atividade,
 * isso equivale a cerca de 7 aulas de presente ao longo de ~23 aulas feitas.
 */
export function bonusForLevel(level: number): number {
  if (level <= 1) return 0;
  if (level <= 3) return 1;
  if (level <= 6) return 2;
  if (level <= 9) return 3;
  return 4;
}

export function grantExpiryFrom(grantedAt: Date): string {
  return addDays(grantedAt, BONUS_LIFETIME_DAYS).toISOString();
}

function isValid(grant: BonusGrant, now: Date): boolean {
  return grant.amount > 0 && Date.parse(grant.expiresAt) > now.getTime();
}

/** Lotes válidos, ordenados do que expira primeiro para o último. */
export function activeGrants(grants: BonusGrant[], now: Date = new Date()): BonusGrant[] {
  return grants
    .filter((grant) => isValid(grant, now))
    .sort((a, b) => Date.parse(a.expiresAt) - Date.parse(b.expiresAt));
}

export function buildWallet(
  childId: string,
  grants: BonusGrant[],
  now: Date = new Date(),
): BonusWallet {
  const active = activeGrants(
    grants.filter((grant) => grant.childId === childId),
    now,
  );
  const first = active[0];

  return {
    childId,
    balance: active.reduce((sum, grant) => sum + grant.amount, 0),
    grants: active,
    nextExpiring: first ? { amount: first.amount, expiresAt: first.expiresAt } : null,
  };
}

/**
 * Divide o custo entre bônus e assinatura. O bônus vai primeiro justamente
 * porque expira — deixar ele parado seria perder moeda.
 */
export function splitPayment(cost: number, bonusBalance: number): CoinPayment {
  const fromBonus = Math.min(bonusBalance, cost);
  return { fromBonus, fromSubscription: cost - fromBonus, total: cost };
}

/**
 * Consome `amount` dos lotes, começando pelos que vencem antes.
 * Devolve os lotes restantes (já sem os zerados).
 */
export function consumeBonus(
  grants: BonusGrant[],
  childId: string,
  amount: number,
  now: Date = new Date(),
): BonusGrant[] {
  if (amount <= 0) return grants;

  const untouched = grants.filter((grant) => grant.childId !== childId || !isValid(grant, now));
  const queue = activeGrants(
    grants.filter((grant) => grant.childId === childId),
    now,
  );

  let remaining = amount;
  const kept: BonusGrant[] = [];

  for (const grant of queue) {
    if (remaining <= 0) {
      kept.push(grant);
      continue;
    }
    const used = Math.min(grant.amount, remaining);
    remaining -= used;
    if (grant.amount - used > 0) kept.push({ ...grant, amount: grant.amount - used });
  }

  return [...untouched, ...kept];
}

/** Dias inteiros até um lote expirar. */
export function daysUntilExpiry(expiresAt: string, now: Date = new Date()): number {
  const ms = Date.parse(expiresAt) - now.getTime();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}
