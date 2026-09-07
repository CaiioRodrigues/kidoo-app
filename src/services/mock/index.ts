import { ACTIVITIES, CATEGORIES, CLASS_SESSIONS, PLANS } from './data';
import { REVIEWS, summarize } from './reviews';
import { slotsAvailable } from '@/types/domain';
import {
  canCheckIn,
  checkInWindow,
  isTicketValid,
  issueCheckInTicket,
  proximityTo,
} from '@/lib/check-in';
import { canCancel, cancellationMessage } from '@/lib/cancellation';
import {
  bonusLotsFor,
  buildWallet,
  consumeBonus,
  grantExpiryFrom,
  restoreBonus,
  splitPayment,
} from '@/lib/bonus';
import { MAX_LEVEL, XP_PER_CHECK_IN, bonusForLevel, levelFromXp } from '@/lib/levels';
import { buildAchievements } from '@/lib/achievements';
import { rankForChild } from '@/lib/recommendation';
import { daysUntilReset, startSubscription, withCurrentCycle } from '@/lib/subscription';

import { ApiError } from '../errors';
import type { ActivityFilters, KidooApi } from '../types';
import { haversineKm, type Coords } from '@/lib/geo';
import type {
  Activity,
  BookingReward,
  ActivityCategoryId,
  ActivityTally,
  BonusGrant,
  Booking,
  Review,
  BookingDetails,
  Child,
  Session,
  SignUpResult,
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
  bonusGrants: BonusGrant[];
  /** Avaliações enviadas nesta sessão, antes das fixas do catálogo. */
  reviews: Review[];
  /**
   * Nota e contagem por atividade, depois das avaliações desta execução.
   *
   * Fica aqui, e não dentro de `ACTIVITIES`, porque o catálogo é semente
   * compartilhada: alterá-lo por dentro muda o objeto que o React Query já tem
   * em cache, ele compara, conclui que nada mudou, e a tela não redesenha.
   */
  ratings: Map<string, { rating: number; reviewCount: number }>;
  subscription: SubscriptionState | null;
};

const state: MockState = {
  session: null,
  children: [],
  bookings: [],
  bonusGrants: [],
  reviews: [],
  ratings: new Map(),
  subscription: null,
};

/** Credita os bônus de todos os níveis cruzados entre `from` e `to`. */
function grantLevelBonus(childId: string, from: number, to: number, at: Date): number {
  let total = 0;

  for (let level = from + 1; level <= to; level += 1) {
    const amount = bonusForLevel(level);
    if (amount <= 0) continue;
    total += amount;
    state.bonusGrants = [
      ...state.bonusGrants,
      {
        id: randomId('bonus'),
        childId,
        amount,
        level,
        grantedAt: at.toISOString(),
        expiresAt: grantExpiryFrom(at),
      },
    ];
  }

  return total;
}

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

/**
 * Preenche a distância a partir de onde o usuário está.
 *
 * Fica no serviço, e não na tela, porque é assim que o backend real vai
 * funcionar: a coordenada do usuário sobe uma vez, o servidor devolve a lista
 * já medida, e nenhum componente precisa saber fazer trigonometria.
 */
function withDistance(activity: Activity, origin: Coords | undefined): Activity {
  const stats = state.ratings.get(activity.id);
  const { latitude, longitude } = activity.partner;

  // Sempre um objeto novo, mesmo sem origem nem avaliação. Devolver a mesma
  // referência fazia a comparação do React Query enxergar "nada mudou" e a
  // tela ficar com o número anterior — foi exatamente assim que a nota nova
  // aparecia no Explorar (recém-montado) e não na Home (já montada).
  return {
    ...activity,
    ...(stats ?? {}),
    distanceKm: origin ? haversineKm(origin, { latitude, longitude }) : activity.distanceKm,
  };
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
      // O backend em memória não manda e-mail, então não há o que confirmar:
      // devolve a sessão direto. A tela de confirmação existe para o caminho
      // real e é alcançável pela rota, não por um desfecho simulado aqui.
      return delay<SignUpResult>({ status: 'signed_in', session: issueSession(name, email) });
    },

    async resendConfirmation() {
      return delay(undefined, 200);
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
      // A criança nasce zerada, como nasce de verdade. Havia aqui um histórico
      // semeado — seis aulas passadas, XP e bônus correspondentes — que existia
      // para as telas de Jornada não abrirem vazias enquanto não havia backend.
      // Com o Supabase no ar isso passou a mentir: quem cria um perfil hoje vê
      // aulas que nunca aconteceram, e a primeira coisa que o app diz sobre a
      // criança dele é falsa.
      state.children = [...state.children, base];
      return delay(base);
    },
  },

  catalog: {
    async categories() {
      return delay(CATEGORIES, 120);
    },
    async activities(filters) {
      const origin = filters?.origin;
      let list = ACTIVITIES.filter((activity) => matchesFilters(activity, filters)).map(
        (activity) => withDistance(activity, origin),
      );

      // Raio e ordenação por distância só fazem sentido com origem conhecida.
      if (origin && filters?.radiusKm !== undefined) {
        const limit = filters.radiusKm;
        list = list.filter((activity) => activity.distanceKm !== null && activity.distanceKm <= limit);
      }
      if (origin && filters?.sort === 'distance') {
        list = [...list].sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
      }

      return delay(list);
    },
    async activity(id, origin) {
      const found = ACTIVITIES.find((activity) => activity.id === id);
      if (!found) throw new ApiError('not_found', 'Atividade não encontrada.');
      return delay(withDistance(found, origin));
    },
    async sessions(activityId) {
      const now = Date.now();
      const open = CLASS_SESSIONS.filter(
        (session) =>
          session.activityId === activityId &&
          slotsAvailable(session) > 0 &&
          Date.parse(session.startsAt) > now,
      ).sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
      return delay(open);
    },

    async reviews(activityId) {
      const activity = ACTIVITIES.find((item) => item.id === activityId);
      if (!activity) throw new ApiError('not_found', 'Atividade não encontrada.');

      const reviews = [...state.reviews, ...REVIEWS]
        .filter((review) => review.activityId === activityId)
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));

      return delay({
        summary: summarize(reviews, {
          rating: activity.rating,
          reviewCount: activity.reviewCount,
        }),
        reviews,
      });
    },

    async submitReview({ bookingId, rating, comment }) {
      const session = requireSession();
      const booking = state.bookings.find((item) => item.id === bookingId);
      if (!booking) throw new ApiError('not_found', 'Reserva não encontrada.');
      if (booking.status !== 'checked_in' && booking.status !== 'completed') {
        throw new ApiError('not_found', 'Só é possível avaliar depois do check-in.');
      }
      if (booking.reviewId) {
        throw new ApiError('not_found', 'Esta aula já foi avaliada.');
      }

      const review: Review = {
        id: randomId('r'),
        activityId: booking.activityId,
        // Só o primeiro nome, como todas as outras avaliações.
        authorName: session.guardian.name.split(' ')[0] ?? 'Responsável',
        rating: Math.min(5, Math.max(1, Math.round(rating))),
        comment: comment.trim(),
        createdAt: new Date().toISOString(),
        helpfulCount: 0,
      };

      state.reviews = [review, ...state.reviews];
      state.bookings = state.bookings.map((item) =>
        item.id === bookingId ? { ...item, reviewId: review.id } : item,
      );

      // A nota e a contagem entram na média, como entram no banco
      // (`submit_review` recalcula o agregado). Sem isto, a avaliação aparecia
      // na aba de comentários mas o cartão continuava com o número velho — e o
      // usuário conclui, com razão, que o envio não funcionou.
      const activity = ACTIVITIES.find((item) => item.id === booking.activityId);
      if (activity) {
        const atual = state.ratings.get(activity.id) ?? {
          rating: activity.rating,
          reviewCount: activity.reviewCount,
        };
        const total = atual.reviewCount + 1;
        state.ratings.set(activity.id, {
          rating: Math.round(((atual.rating * atual.reviewCount + review.rating) / total) * 10) / 10,
          reviewCount: total,
        });
      }

      return delay(review);
    },

    async recommended(childId, origin) {
      const measured = ACTIVITIES.map((activity) => withDistance(activity, origin));
      const child = state.children.find((item) => item.id === childId);
      if (!child) return delay(measured.slice(0, 3));

      const ranked = rankForChild(measured, child);
      return delay(ranked.length > 0 ? ranked : measured.slice(0, 3));
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

      const subscription = startSubscription(plan);
      state.subscription = subscription;
      return delay(subscription);
    },
    async current() {
      if (!state.subscription) return delay(null, 100);
      // Aplica a virada de semana antes de qualquer leitura.
      state.subscription = withCurrentCycle(state.subscription);
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

    async checkIn(bookingId, proof) {
      requireSession();
      const booking = state.bookings.find((item) => item.id === bookingId);
      if (!booking) throw new ApiError('not_found', 'Reserva não encontrada.');
      if (booking.status === 'cancelled') {
        throw new ApiError('not_found', 'Esta reserva foi cancelada.');
      }
      // Presença confirmada pelo parceiro encerra a reserva. Sem esta guarda o
      // fluxo abaixo tratava 'completed' como "ainda não entrou" e creditava
      // XP de novo a cada check-in repetido.
      if (booking.status === 'completed') {
        throw new ApiError('not_found', 'Esta presença já foi confirmada pelo parceiro.');
      }

      const activity = ACTIVITIES.find((item) => item.id === booking.activityId);
      if (!activity) throw new ApiError('not_found', 'Atividade não encontrada.');

      // A distância é recalculada aqui, a partir da leitura crua. O cliente
      // manda onde acha que está, nunca "estou no local" — senão a checagem
      // inteira seria um booleano que qualquer um reescreve.
      const proximity = proximityTo(
        { latitude: activity.partner.latitude, longitude: activity.partner.longitude },
        proof ?? null,
      );
      const window = checkInWindow(booking.scheduledAt);

      // Repetir o check-in não revalida nada: quem já entrou só está pedindo o
      // código de novo.
      if (booking.status !== 'checked_in') {
        const verdict = canCheckIn(proximity, window);
        if (!verdict.allowed) {
          throw new ApiError(
            'not_found',
            verdict.blockedBy === 'window'
              ? window.reason === 'early'
                ? 'O check-in abre 45 minutos antes da aula.'
                : 'A janela de check-in desta aula já fechou.'
              : 'Você ainda não chegou no local da atividade.',
          );
        }
      }

      const checkInProof: Booking['checkInProof'] = {
        locationVerified: proximity.kind === 'arrived',
        distanceM: proximity.kind === 'unknown' ? null : Math.round(proximity.distanceM),
        mocked: proof?.mocked ?? false,
      };

      // Reemite o código se o antigo expirou: o responsável não pode ficar
      // preso sem comprovante só porque demorou para chamar o parceiro.
      const ticket =
        booking.checkIn && isTicketValid(booking.checkIn)
          ? booking.checkIn
          : issueCheckInTicket(booking.id);

      const checkedIn: Booking =
        booking.status === 'checked_in'
          ? { ...booking, checkIn: ticket }
          : {
              ...booking,
              status: 'checked_in',
              checkedInAt: new Date().toISOString(),
              checkIn: ticket,
              checkInProof,
            };

      state.bookings = state.bookings.map((item) => (item.id === bookingId ? checkedIn : item));

      // Chegar não credita nada. O portão de distância deixa passar quem não
      // tem leitura de GPS — de propósito, porque negamos com prova contra e
      // nunca por falta dela. Creditar aqui faria de "negar a permissão de
      // localização" uma fábrica de Kidoo Bônus.
      return delay({
        booking: toDetails(checkedIn),
        xpOnConfirm: XP_PER_CHECK_IN,
        ticket,
      });
    },

    async confirmByPartner({ bookingId, code }) {
      const booking = state.bookings.find((item) => item.id === bookingId);
      if (!booking) throw new ApiError('not_found', 'Reserva não encontrada.');
      if (booking.partnerConfirmedAt) {
        throw new ApiError('not_found', 'Esta presença já foi confirmada.');
      }
      if (booking.status !== 'checked_in') {
        throw new ApiError('not_found', 'Esta reserva ainda não teve check-in.');
      }
      if (!booking.checkIn || !isTicketValid(booking.checkIn)) {
        throw new ApiError('not_found', 'O código expirou. Peça um novo ao responsável.');
      }
      if (booking.checkIn.code !== code.replace(/\s/g, '')) {
        throw new ApiError('not_found', 'Código inválido para esta reserva.');
      }

      // É aqui que o XP entra: na palavra de quem recebeu a criança. Subir de
      // nível gera Kidoo Bônus, e o resultado fica guardado na reserva porque
      // a comemoração acontece do outro lado do balcão — o app da família só
      // descobre na próxima vez que abrir.
      const now = new Date();
      const { total, byCategory } = attendanceOf(booking.childId);
      const before = state.children.find((child) => child.id === booking.childId);
      const levelBefore = before ? levelFromXp(before.xp).level : 1;
      const xp = (before?.xp ?? 0) + XP_PER_CHECK_IN;
      const levelAfter = levelFromXp(xp).level;

      let levelUp: BookingReward['levelUp'] = null;
      if (levelAfter > levelBefore) {
        const bonusEarned = grantLevelBonus(booking.childId, levelBefore, levelAfter, now);
        levelUp = { from: levelBefore, to: levelAfter, bonusEarned };
      }

      state.children = state.children.map((child) => {
        if (child.id !== booking.childId) return child;
        return {
          ...child,
          xp,
          level: levelAfter,
          achievements: buildAchievements(total, byCategory, now.toISOString()).filter(
            (achievement) => achievement.unlockedAt !== null,
          ).length,
        };
      });

      const confirmed: Booking = {
        ...booking,
        status: 'completed',
        partnerConfirmedAt: now.toISOString(),
        // O código morre ao ser usado: não vale para uma segunda aula.
        checkIn: null,
        reward: { xpEarned: XP_PER_CHECK_IN, levelUp },
      };
      state.bookings = state.bookings.map((item) => (item.id === bookingId ? confirmed : item));
      return delay(toDetails(confirmed));
    },

    async cancel(bookingId) {
      requireSession();
      const booking = state.bookings.find((item) => item.id === bookingId);
      if (!booking) throw new ApiError('not_found', 'Reserva não encontrada.');

      const check = canCancel(booking);
      if (!check.allowed) throw new ApiError('not_found', cancellationMessage(check));

      // Devolve exatamente o que foi cobrado: a cota semanal recebe de volta a
      // parte da assinatura, e os lotes de bônus voltam com a validade
      // original — sem esticar o prazo de nada.
      const subscription = state.subscription ? withCurrentCycle(state.subscription) : null;
      if (subscription && booking.payment.fromSubscription > 0) {
        state.subscription = {
          ...subscription,
          coinsRemaining: Math.min(
            subscription.coinsPerWeek,
            subscription.coinsRemaining + booking.payment.fromSubscription,
          ),
        };
      }
      if (booking.payment.bonusLots.length > 0) {
        state.bonusGrants = restoreBonus(
          state.bonusGrants,
          booking.childId,
          booking.payment.bonusLots,
        );
      }

      // A vaga volta para o parceiro. Sem isto a turma "encheria" com reservas
      // canceladas e ele perderia lugar que está livre.
      const session = CLASS_SESSIONS.find((item) => item.id === booking.sessionId);
      if (session) session.slotsTaken = Math.max(0, session.slotsTaken - 1);

      const cancelled: Booking = { ...booking, status: 'cancelled', checkIn: null };
      state.bookings = state.bookings.map((item) => (item.id === bookingId ? cancelled : item));
      return delay(toDetails(cancelled));
    },

    async create({ sessionId, childId }) {
      requireSession();
      const session = CLASS_SESSIONS.find((item) => item.id === sessionId);
      if (!session) throw new ApiError('not_found', 'Turma não encontrada.');

      const activity = ACTIVITIES.find((item) => item.id === session.activityId);
      if (!activity) throw new ApiError('not_found', 'Atividade não encontrada.');

      // A vaga é do parceiro: se ele fechou ou a turma encheu, não há o que
      // reservar. A checagem é aqui, no serviço, porque duas famílias podem
      // tocar em "confirmar" ao mesmo tempo.
      if (slotsAvailable(session) <= 0) {
        throw new ApiError('not_found', 'Esta turma não tem mais vaga aberta.');
      }
      if (Date.parse(session.startsAt) <= Date.now()) {
        throw new ApiError('not_found', 'Esta turma já começou.');
      }

      // Aplica a virada de semana antes de debitar: uma reserva feita depois da
      // segunda-feira usa a cota nova, não a que já expirou.
      const subscription = state.subscription ? withCurrentCycle(state.subscription) : null;

      // O bônus entra primeiro porque expira; a cota semanal cobre o resto.
      const wallet = buildWallet(childId, state.bonusGrants);
      const lots = bonusLotsFor(
        state.bonusGrants,
        childId,
        Math.min(wallet.balance, session.coinCost),
      );
      const payment = splitPayment(session.coinCost, wallet.balance, lots);

      if (subscription) {
        if (subscription.coinsRemaining < payment.fromSubscription) {
          const days = daysUntilReset(subscription);
          throw new ApiError(
            'insufficient_coins',
            days <= 1
              ? 'Seus Kidoo Coins desta semana acabaram. A cota volta ao cheio amanhã.'
              : `Seus Kidoo Coins desta semana acabaram. A cota volta ao cheio em ${days} dias.`,
          );
        }
        state.subscription = {
          ...subscription,
          coinsRemaining: subscription.coinsRemaining - payment.fromSubscription,
        };
      }

      if (payment.fromBonus > 0) {
        state.bonusGrants = consumeBonus(state.bonusGrants, childId, payment.fromBonus);
      }

      session.slotsTaken += 1;

      const booking: Booking = {
        id: randomId('b'),
        activityId: activity.id,
        sessionId: session.id,
        childId,
        status: 'confirmed',
        scheduledAt: session.startsAt,
        checkedInAt: null,
        coinCost: session.coinCost,
        slotKind: session.kind,
        payment,
        checkIn: null,
        partnerConfirmedAt: null,
        checkInProof: null,
        reviewId: null,
        reward: null,
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
      const { level, levelName, xpIntoLevel, xpForLevel, isMaxLevel } = levelFromXp(child.xp);

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
        xpForLevel,
        maxLevel: MAX_LEVEL,
        isMaxLevel,
        nextLevelBonus: isMaxLevel ? 0 : bonusForLevel(level + 1),
        achievements: buildAchievements(total, byCategory, new Date().toISOString()),
        activityTally,
        weeklyActivity: weeklyActivityOf(childId),
        totalActivities: total,
        totalCategories: byCategory.size,
        bonus: buildWallet(childId, state.bonusGrants),
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

/** Usado em testes e no logout para voltar ao estado inicial. */
export function resetMockState(): void {
  state.session = null;
  state.children = [];
  state.bookings = [];
  state.bonusGrants = [];
  state.reviews = [];
  state.ratings.clear();
  state.subscription = null;
}
