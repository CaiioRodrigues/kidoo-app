import { addDays } from 'date-fns';

import type { BonusGrant, BonusWallet, CoinPayment } from '@/types/domain';

/**
 * Carteira dos Kidoo Bônus: validade, saldo e consumo.
 *
 * Quanto cada nível concede fica em `@/lib/levels`, junto da curva de XP —
 * são a mesma decisão de produto e mudam juntas.
 */

export const BONUS_LIFETIME_DAYS = 30;

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
export function splitPayment(
  cost: number,
  bonusBalance: number,
  bonusLots: CoinPayment['bonusLots'] = [],
): CoinPayment {
  const fromBonus = Math.min(bonusBalance, cost);
  return { fromBonus, fromSubscription: cost - fromBonus, total: cost, bonusLots };
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

/**
 * Devolve ao usuário lotes que haviam sido consumidos, preservando a validade
 * original. Lotes que já teriam vencido não voltam: o cancelamento não pode
 * ressuscitar moeda expirada.
 */
export function restoreBonus(
  grants: BonusGrant[],
  childId: string,
  lots: { amount: number; expiresAt: string; level: number }[],
  now: Date = new Date(),
): BonusGrant[] {
  const revived = lots
    .filter((lot) => lot.amount > 0 && Date.parse(lot.expiresAt) > now.getTime())
    .map((lot, index) => ({
      id: `restored-${now.getTime()}-${index}`,
      childId,
      amount: lot.amount,
      level: lot.level,
      grantedAt: now.toISOString(),
      expiresAt: lot.expiresAt,
    }));

  return [...grants, ...revived];
}

/** Quais lotes seriam consumidos por um gasto, na ordem de vencimento. */
export function bonusLotsFor(
  grants: BonusGrant[],
  childId: string,
  amount: number,
  now: Date = new Date(),
): { amount: number; expiresAt: string; level: number }[] {
  if (amount <= 0) return [];

  const queue = activeGrants(
    grants.filter((grant) => grant.childId === childId),
    now,
  );

  let remaining = amount;
  const lots: { amount: number; expiresAt: string; level: number }[] = [];

  for (const grant of queue) {
    if (remaining <= 0) break;
    const used = Math.min(grant.amount, remaining);
    remaining -= used;
    lots.push({ amount: used, expiresAt: grant.expiresAt, level: grant.level });
  }

  return lots;
}
