import { ACTIVITIES, CATEGORIES, PLANS } from './data';
import { ApiError } from '../errors';
import type { ActivityFilters, KidooApi } from '../types';
import type { Activity, Booking, Child, Session, SubscriptionState } from '@/types/domain';

/**
 * Backend simulado em memória. Só existe para a UI ser desenvolvida e testada
 * sem servidor — a implementação real deve satisfazer exatamente `KidooApi`.
 *
 * Regras de segurança que valem aqui e no backend real:
 * - senha nunca é guardada (nem em memória) além do momento da checagem;
 * - o token é opaco e sem PII embutida;
 * - listagens são sempre escopadas ao responsável autenticado.
 */
const LATENCY_MS = 350;

const delay = <T>(value: T, ms = LATENCY_MS): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(value), ms));

function randomId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

type MockState = {
  session: Session | null;
  children: Child[];
  bookings: Booking[];
  subscription: SubscriptionState | null;
};

const state: MockState = {
  session: null,
  children: [],
  bookings: [],
  subscription: null,
};

function issueSession(name: string, email: string): Session {
  const guardian = {
    id: randomId('g'),
    name,
    email,
    city: 'Belo Horizonte',
    createdAt: new Date().toISOString(),
  };
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString();
  const session: Session = { guardian, accessToken: randomId('tok'), expiresAt };
  state.session = session;
  return session;
}

function requireSession(): Session {
  if (!state.session) {
    throw new ApiError('invalid_credentials', 'Sua sessão expirou. Entre novamente.');
  }
  return state.session;
}

function matchesFilters(activity: Activity, filters: ActivityFilters | undefined): boolean {
  if (!filters) return true;
  if (filters.category && filters.category !== 'all' && activity.category !== filters.category) {
    return false;
  }
  if (filters.query) {
    const needle = filters.query.trim().toLowerCase();
    const haystack = `${activity.title} ${activity.partner.name} ${activity.partner.neighborhood}`;
    if (!haystack.toLowerCase().includes(needle)) return false;
  }
  return true;
}

export const mockApi: KidooApi = {
  auth: {
    async signIn({ email, password }) {
      if (password.length < 8) {
        throw new ApiError('invalid_credentials', 'E-mail ou senha incorretos.');
      }
      const name = email.split('@')[0] ?? 'Responsável';
      return delay(issueSession(name.charAt(0).toUpperCase() + name.slice(1), email));
    },
    async signUp({ name, email }) {
      return delay(issueSession(name, email));
    },
    async signOut() {
      state.session = null;
      return delay(undefined, 120);
    },
    async restore(token) {
      if (!state.session || state.session.accessToken !== token) return delay(null, 80);
      if (Date.parse(state.session.expiresAt) < Date.now()) {
        state.session = null;
        return delay(null, 80);
      }
      return delay(state.session, 80);
    },
  },

  children: {
    async list() {
      const session = requireSession();
      return delay(state.children.filter((child) => child.guardianId === session.guardian.id));
    },
    async create(input) {
      const session = requireSession();
      const child: Child = {
        id: randomId('c'),
        guardianId: session.guardian.id,
        name: input.name,
        birthDate: input.birthDate,
        gender: input.gender,
        photoUri: input.photoUri,
        interests: input.interests,
        xp: 0,
        level: 1,
        achievements: 0,
      };
      state.children = [...state.children, child];
      return delay(child);
    },
  },

  catalog: {
    async categories() {
      return delay(CATEGORIES, 120);
    },
    async activities(filters) {
      return delay(ACTIVITIES.filter((activity) => matchesFilters(activity, filters)));
    },
    async activity(id) {
      const found = ACTIVITIES.find((activity) => activity.id === id);
      if (!found) throw new ApiError('not_found', 'Atividade não encontrada.');
      return delay(found);
    },
    async recommended(childId) {
      const child = state.children.find((item) => item.id === childId);
      if (!child) return delay(ACTIVITIES.slice(0, 3));

      const age = ageInYears(child.birthDate);
      const ranked = ACTIVITIES.filter(
        (activity) => age >= activity.minAge - 1 && age <= activity.maxAge + 1,
      ).sort((a, b) => {
        const aLiked = child.interests.includes(a.category) ? 1 : 0;
        const bLiked = child.interests.includes(b.category) ? 1 : 0;
        if (aLiked !== bLiked) return bLiked - aLiked;
        return a.distanceKm - b.distanceKm;
      });

      return delay(ranked.length > 0 ? ranked : ACTIVITIES.slice(0, 3));
    },
  },

  plans: {
    async list() {
      return delay(PLANS, 150);
    },
    async subscribe(planId) {
      requireSession();
      const plan = PLANS.find((item) => item.id === planId);
      if (!plan) throw new ApiError('not_found', 'Plano indisponível.');

      const renewsAt = new Date();
      renewsAt.setMonth(renewsAt.getMonth() + 1);
      state.subscription = {
        planId: plan.id,
        coinsRemaining: plan.coins,
        renewsAt: renewsAt.toISOString(),
      };
      return delay(state.subscription);
    },
    async current() {
      return delay(state.subscription, 100);
    },
  },

  bookings: {
    async list() {
      requireSession();
      return delay(state.bookings);
    },
    async create({ activityId, childId }) {
      requireSession();
      const activity = ACTIVITIES.find((item) => item.id === activityId);
      if (!activity) throw new ApiError('not_found', 'Atividade não encontrada.');

      const subscription = state.subscription;
      if (subscription && subscription.coinsRemaining < activity.coinCost) {
        throw new ApiError(
          'insufficient_coins',
          'Você não tem Kidoo Coins suficientes para esta reserva.',
        );
      }
      if (subscription) {
        state.subscription = {
          ...subscription,
          coinsRemaining: subscription.coinsRemaining - activity.coinCost,
        };
      }

      const booking: Booking = {
        id: randomId('b'),
        activityId,
        childId,
        status: 'confirmed',
        scheduledAt: activity.nextSessionAt,
        coinCost: activity.coinCost,
      };
      state.bookings = [...state.bookings, booking];
      return delay(booking);
    },
  },
};

function ageInYears(birthDate: string): number {
  const birth = new Date(birthDate);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const monthDelta = now.getMonth() - birth.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < birth.getDate())) age -= 1;
  return age;
}

/** Usado em testes e no logout para voltar ao estado inicial. */
export function resetMockState(): void {
  state.session = null;
  state.children = [];
  state.bookings = [];
  state.subscription = null;
}
