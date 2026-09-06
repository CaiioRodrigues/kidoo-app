import { addWeeks } from 'date-fns';

import { activeGrants } from '@/lib/bonus';
import { levelFromXp } from '@/lib/levels';
import type {
  Activity,
  ActivityCategory,
  ActivityCategoryId,
  BonusGrant,
  Booking,
  ClassSession,
  Child,
  CoinPayment,
  Gender,
  Plan,
  PlanId,
  RatingSummary,
  Review,
  SlotKind,
  SubscriptionState,
} from '@/types/domain';
import { haversineKm, type Coords } from '@/lib/geo';

/**
 * Tradução entre as linhas do Postgres e o domínio.
 *
 * Nenhuma tela vê `snake_case`, e nenhuma consulta vê `camelCase`. A fronteira
 * é aqui — é o que permite mudar uma coluna sem procurar por ela em componente.
 */

// -------------------------------------------------------------- linhas ------

export type CategoryRow = { id: string; label: string; emoji: string | null };

export type ActivityRow = {
  id: string;
  partner_id: string;
  category_id: string;
  title: string;
  image_url: string | null;
  min_age: number;
  max_age: number;
  description: string;
  tags: string[] | null;
  rating: number | string;
  review_count: number;
  partner_name: string;
  partner_neighborhood: string;
  partner_city: string;
  partner_verified: boolean;
  partner_latitude: number;
  partner_longitude: number;
  coin_cost: number | null;
  next_session_at: string | null;
  open_sessions: number;
};

export type SessionRow = {
  id: string;
  activity_id: string;
  starts_at: string;
  capacity: number;
  enrolled: number;
  slots_open: number;
  slots_taken: number;
  kind: SlotKind;
  coin_cost: number;
};

export type ChildRow = {
  id: string;
  guardian_id: string;
  name: string;
  birth_date: string;
  gender: string;
  photo_url: string | null;
  xp: number;
  interests: string[] | null;
};

export type BookingRow = {
  id: string;
  guardian_id: string;
  child_id: string;
  session_id: string;
  activity_id: string;
  status: Booking['status'];
  scheduled_at: string;
  checked_in_at: string | null;
  coin_cost: number;
  slot_kind: SlotKind;
  payment: { fromBonus?: number; fromSubscription?: number; total?: number } | null;
  check_in: { code: string; issuedAt: string; expiresAt: string } | null;
  partner_confirmed_at: string | null;
  check_in_proof: { locationVerified?: boolean; distanceM?: number | null; mocked?: boolean } | null;
};

export type ReviewRow = {
  id: string;
  activity_id: string;
  author_name: string;
  rating: number;
  comment: string;
  created_at: string;
  helpful_count: number;
};

export type BonusGrantRow = {
  id: string;
  child_id: string;
  amount: number;
  remaining: number;
  level: number;
  granted_at: string;
  expires_at: string;
};

export type SubscriptionRow = {
  plan_id: string;
  coins_per_week: number;
  coins_remaining: number;
  cycle_started_at: string;
  renews_at: string;
};

export type PlanRow = {
  id: string;
  name: string;
  price_cents: number;
  coins_per_week: number;
  activities_per_week: number;
  tagline: string;
  highlighted: boolean;
  perks: string[] | null;
};

// ----------------------------------------------------------- conversões -----

/**
 * O banco fala `male`/`female` (vocabulário de cadastro) e o app fala
 * `boy`/`girl` (vocabulário de criança). Traduzir aqui evita espalhar a
 * diferença por formulário e consulta.
 */
const GENDER_TO_DOMAIN: Record<string, Gender> = {
  male: 'boy',
  female: 'girl',
  undisclosed: 'undisclosed',
};

const GENDER_TO_DB: Record<Gender, string> = {
  boy: 'male',
  girl: 'female',
  undisclosed: 'undisclosed',
};

export function genderToDomain(value: string): Gender {
  return GENDER_TO_DOMAIN[value] ?? 'undisclosed';
}

export function genderToDb(value: Gender): string {
  return GENDER_TO_DB[value];
}

export function toCategory(row: CategoryRow): ActivityCategory {
  return {
    id: row.id as ActivityCategoryId,
    label: row.label,
    emoji: row.emoji ?? '⭐',
  };
}

/**
 * A distância é calculada aqui, no aparelho, a partir da coordenada do
 * parceiro. É de propósito: assim a localização da família não precisa sair do
 * telefone para o catálogo funcionar. (No check-in ela vai, porque lá o que
 * está em jogo é uma prova — e o servidor não pode aceitar a palavra do cliente.)
 */
export function toActivity(row: ActivityRow, origin?: Coords): Activity {
  const partner = {
    id: row.partner_id,
    name: row.partner_name,
    neighborhood: row.partner_neighborhood,
    city: row.partner_city,
    verified: row.partner_verified,
    latitude: row.partner_latitude,
    longitude: row.partner_longitude,
  };

  return {
    id: row.id,
    title: row.title,
    category: row.category_id as ActivityCategoryId,
    partner,
    imageUrl: row.image_url ?? '',
    rating: Number(row.rating),
    reviewCount: row.review_count,
    minAge: row.min_age,
    maxAge: row.max_age,
    distanceKm: origin
      ? haversineKm(origin, { latitude: partner.latitude, longitude: partner.longitude })
      : null,
    // Sem turma aberta não há "a partir de". Zero seria mentira — grátis não é.
    coinCost: row.coin_cost ?? 0,
    nextSessionAt: row.next_session_at ?? '',
    description: row.description,
    tags: row.tags ?? [],
  };
}

export function toSession(row: SessionRow): ClassSession {
  return {
    id: row.id,
    activityId: row.activity_id,
    startsAt: row.starts_at,
    capacity: row.capacity,
    enrolled: row.enrolled,
    slotsOpen: row.slots_open,
    slotsTaken: row.slots_taken,
    kind: row.kind,
    coinCost: row.coin_cost,
  };
}

/**
 * Nível e conquistas não são colunas: derivam do XP e do histórico. Guardá-los
 * no banco criaria duas verdades que só ficam iguais por disciplina.
 */
export function toChild(row: ChildRow, achievements: number): Child {
  return {
    id: row.id,
    guardianId: row.guardian_id,
    name: row.name,
    birthDate: row.birth_date,
    gender: genderToDomain(row.gender),
    photoUri: row.photo_url,
    interests: (row.interests ?? []) as ActivityCategoryId[],
    xp: row.xp,
    level: levelFromXp(row.xp).level,
    achievements,
  };
}

function toPayment(row: BookingRow): CoinPayment {
  return {
    fromBonus: row.payment?.fromBonus ?? 0,
    fromSubscription: row.payment?.fromSubscription ?? 0,
    total: row.payment?.total ?? row.coin_cost,
    // O servidor devolve o bônus ao lote que vence primeiro — que, por ser o
    // mesmo critério do consumo, nunca tem validade maior que a do lote gasto.
    // Cancelar não estica prazo, e por isso não precisamos carregar os lotes.
    bonusLots: [],
  };
}

export function toBooking(row: BookingRow, reviewId: string | null = null): Booking {
  return {
    id: row.id,
    activityId: row.activity_id,
    sessionId: row.session_id,
    childId: row.child_id,
    status: row.status,
    scheduledAt: row.scheduled_at,
    checkedInAt: row.checked_in_at,
    coinCost: row.coin_cost,
    slotKind: row.slot_kind,
    payment: toPayment(row),
    checkIn: row.check_in
      ? {
          code: row.check_in.code,
          // O QR carrega só reserva e código — nenhum dado da criança.
          qrPayload: `kidoo://checkin/${row.id}/${row.check_in.code}`,
          issuedAt: row.check_in.issuedAt,
          expiresAt: row.check_in.expiresAt,
        }
      : null,
    partnerConfirmedAt: row.partner_confirmed_at,
    checkInProof: row.check_in_proof
      ? {
          locationVerified: row.check_in_proof.locationVerified ?? false,
          distanceM: row.check_in_proof.distanceM ?? null,
          mocked: row.check_in_proof.mocked ?? false,
        }
      : null,
    reviewId,
  };
}

export function toReview(row: ReviewRow): Review {
  return {
    id: row.id,
    activityId: row.activity_id,
    authorName: row.author_name,
    rating: row.rating,
    comment: row.comment,
    createdAt: row.created_at,
    helpfulCount: row.helpful_count,
  };
}

/**
 * O lote vale pelo que ainda resta nele. `amount` no domínio é saldo
 * disponível, não o valor original do prêmio.
 */
export function toBonusGrant(row: BonusGrantRow): BonusGrant {
  return {
    id: row.id,
    childId: row.child_id,
    amount: row.remaining,
    level: row.level,
    grantedAt: row.granted_at,
    expiresAt: row.expires_at,
  };
}

export function toWallet(childId: string, rows: BonusGrantRow[]) {
  const grants = activeGrants(rows.map(toBonusGrant).filter((grant) => grant.amount > 0));
  const first = grants[0];
  return {
    childId,
    balance: grants.reduce((sum, grant) => sum + grant.amount, 0),
    grants,
    nextExpiring: first ? { amount: first.amount, expiresAt: first.expiresAt } : null,
  };
}

/**
 * `cycleResetsAt` é derivado: a semana começa na segunda e dura sete dias. Uma
 * segunda coluna para isso só criaria a chance de ela discordar da primeira.
 */
export function toSubscription(row: SubscriptionRow): SubscriptionState {
  return {
    planId: row.plan_id as PlanId,
    coinsPerWeek: row.coins_per_week,
    coinsRemaining: row.coins_remaining,
    cycleStartsAt: row.cycle_started_at,
    cycleResetsAt: addWeeks(new Date(row.cycle_started_at), 1).toISOString(),
    renewsAt: row.renews_at,
  };
}

export function toPlan(row: PlanRow): Plan {
  return {
    id: row.id as PlanId,
    name: row.name,
    priceCents: row.price_cents,
    coinsPerWeek: row.coins_per_week,
    activitiesPerWeek: row.activities_per_week,
    tagline: row.tagline,
    highlighted: row.highlighted,
    perks: row.perks ?? [],
  };
}

/** Resumo das notas a partir das avaliações reais — sem número solto na atividade. */
export function summarize(reviews: Review[]): RatingSummary {
  const distribution: RatingSummary['distribution'] = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const review of reviews) {
    const star = Math.min(5, Math.max(1, Math.round(review.rating))) as 1 | 2 | 3 | 4 | 5;
    distribution[star] += 1;
  }

  const total = reviews.length;
  const sum = reviews.reduce((acc, review) => acc + review.rating, 0);
  return {
    average: total === 0 ? 0 : Math.round((sum / total) * 10) / 10,
    total,
    distribution,
  };
}
