import { ACTIVITIES, CATEGORIES, PLANS } from './data';
import { XP_PER_CHECK_IN, XP_PER_LEVEL, buildAchievements, levelFromXp } from './journey';
import { ApiError } from '../errors';
import type { ActivityFilters, KidooApi } from '../types';
import type {
  Activity,
  ActivityCategoryId,
  ActivityTally,
  Booking,
  BookingDetails,
  Child,
  Session,
  SubscriptionState,
} from '@/types/domain';

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

/** Junta a reserva com a atividade e a criança que as telas precisam mostrar. */
function toDetails(booking: Booking): BookingDetails {
  const activity = ACTIVITIES.find((item) => item.id === booking.activityId);
  const child = state.children.find((item) => item.id === booking.childId);
  if (!activity || !child) {
    throw new ApiError('not_found', 'Reserva não encontrada.');
  }
  return { ...booking, activity, child };
}

/** Aulas efetivamente frequentadas, por modalidade. */
function attendanceOf(childId: string): {
  total: number;
  byCategory: Map<ActivityCategoryId, number>;
} {
  const byCategory = new Map<ActivityCategoryId, number>();
  let total = 0;

  for (const booking of state.bookings) {
    if (booking.childId !== childId) continue;
    if (booking.status !== 'checked_in' && booking.status !== 'completed') continue;

    const activity = ACTIVITIES.find((item) => item.id === booking.activityId);
    if (!activity) continue;

    total += 1;
    byCategory.set(activity.category, (byCategory.get(activity.category) ?? 0) + 1);
  }

  return { total, byCategory };
}

/**
 * Demo: dá um histórico à criança recém-cadastrada para a Jornada não nascer
 * vazia na apresentação. REMOVER ao ligar o backend real.
 */
function seedDemoHistory(child: Child): void {
  const seeds: { activityId: string; daysAgo: number }[] = [
    { activityId: 'a-futebol-kids', daysAgo: 21 },
    { activityId: 'a-futebol-kids', daysAgo: 14 },
    { activityId: 'a-natacao-infantil', daysAgo: 10 },
    { activityId: 'a-futebol-kids', daysAgo: 7 },
    { activityId: 'a-natacao-infantil', daysAgo: 4 },
    { activityId: 'a-judo-kids', daysAgo: 2 },
  ];

  for (const seed of seeds) {
    const activity = ACTIVITIES.find((item) => item.id === seed.activityId);
    if (!activity) continue;

    const when = new Date();
    when.setDate(when.getDate() - seed.daysAgo);

    state.bookings = [
      ...state.bookings,
      {
        id: randomId('b'),
        activityId: activity.id,
        childId: child.id,
        status: 'completed',
        scheduledAt: when.toISOString(),
        checkedInAt: when.toISOString(),
        coinCost: activity.coinCost,
      },
    ];
  }
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
      const base: Child = {
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
      state.children = [...state.children, base];
      seedDemoHistory(base);

      // XP e conquistas coerentes com o histórico semeado acima (demo).
      const { total, byCategory } = attendanceOf(base.id);
      const xp = total * XP_PER_CHECK_IN;
      const child: Child = {
        ...base,
        xp,
        level: levelFromXp(xp).level,
        achievements: buildAchievements(total, byCategory, new Date().toISOString()).filter(
          (achievement) => achievement.unlockedAt !== null,
        ).length,
      };
      state.children = state.children.map((item) => (item.id === child.id ? child : item));

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
      // Mais recentes primeiro — é o que a aba Reservas mostra no topo.
      const sorted = [...state.bookings].sort(
        (a, b) => Date.parse(b.scheduledAt) - Date.parse(a.scheduledAt),
      );
      return delay(sorted.map(toDetails));
    },

    async get(id) {
      requireSession();
      const booking = state.bookings.find((item) => item.id === id);
      if (!booking) throw new ApiError('not_found', 'Reserva não encontrada.');
      return delay(toDetails(booking), 150);
    },

    async checkIn(bookingId) {
      requireSession();
      const booking = state.bookings.find((item) => item.id === bookingId);
      if (!booking) throw new ApiError('not_found', 'Reserva não encontrada.');
      if (booking.status === 'cancelled') {
        throw new ApiError('not_found', 'Esta reserva foi cancelada.');
      }

      const checkedIn: Booking =
        booking.status === 'checked_in'
          ? booking
          : { ...booking, status: 'checked_in', checkedInAt: new Date().toISOString() };

      state.bookings = state.bookings.map((item) => (item.id === bookingId ? checkedIn : item));

      // Check-in credita XP e pode desbloquear conquistas.
      if (booking.status !== 'checked_in') {
        const { total, byCategory } = attendanceOf(checkedIn.childId);
        state.children = state.children.map((child) => {
          if (child.id !== checkedIn.childId) return child;
          const xp = child.xp + XP_PER_CHECK_IN;
          return {
            ...child,
            xp,
            level: levelFromXp(xp).level,
            achievements: buildAchievements(total, byCategory, new Date().toISOString()).filter(
              (achievement) => achievement.unlockedAt !== null,
            ).length,
          };
        });
      }

      return delay(toDetails(checkedIn));
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
        checkedInAt: null,
        coinCost: activity.coinCost,
      };
      state.bookings = [...state.bookings, booking];
      return delay(booking);
    },
  },

  journey: {
    async get(childId) {
      requireSession();
      const child = state.children.find((item) => item.id === childId);
      if (!child) throw new ApiError('not_found', 'Criança não encontrada.');

      const { total, byCategory } = attendanceOf(childId);
      const { level, levelName, xpIntoLevel } = levelFromXp(child.xp);

      const activityTally: ActivityTally[] = [...byCategory.entries()]
        .map(([category, count]) => {
          const meta = CATEGORIES.find((item) => item.id === category);
          return {
            category,
            label: meta?.label ?? category,
            emoji: meta?.emoji ?? '⭐',
            count,
          };
        })
        .sort((a, b) => b.count - a.count);

      return delay({
        childId,
        xp: child.xp,
        level,
        levelName,
        xpIntoLevel,
        xpPerLevel: XP_PER_LEVEL,
        achievements: buildAchievements(total, byCategory, new Date().toISOString()),
        activityTally,
        weeklyActivity: weeklyActivityOf(childId),
        totalActivities: total,
        totalCategories: byCategory.size,
      });
    },
  },
};

/** Aulas por semana nas últimas 5 semanas, da mais antiga para a mais recente. */
function weeklyActivityOf(childId: string): { label: string; count: number }[] {
  const WEEKS = 5;
  const MS_PER_WEEK = 1000 * 60 * 60 * 24 * 7;
  const now = Date.now();

  const buckets = Array.from({ length: WEEKS }, (_, index) => ({
    label: index === WEEKS - 1 ? 'Esta' : `S${index + 1}`,
    count: 0,
  }));

  for (const booking of state.bookings) {
    if (booking.childId !== childId) continue;
    if (booking.status !== 'checked_in' && booking.status !== 'completed') continue;

    const reference = booking.checkedInAt ?? booking.scheduledAt;
    const weeksAgo = Math.floor((now - Date.parse(reference)) / MS_PER_WEEK);
    if (weeksAgo < 0 || weeksAgo >= WEEKS) continue;

    const bucket = buckets[WEEKS - 1 - weeksAgo];
    if (bucket) bucket.count += 1;
  }

  return buckets;
}

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
