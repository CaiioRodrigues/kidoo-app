/** Modelo de domínio do Kidoo. Nenhuma tela conhece formato de resposta HTTP. */

export type Uuid = string;
/** Data no formato ISO 8601 (YYYY-MM-DD). */
export type IsoDate = string;
/** Instante no formato ISO 8601 completo. */
export type IsoDateTime = string;

export type Gender = 'boy' | 'girl' | 'undisclosed';

export type ActivityCategoryId =
  'futebol' | 'natacao' | 'judo' | 'danca' | 'ginastica' | 'tenis' | 'basquete' | 'volei' | 'artes';

export type ActivityCategory = {
  id: ActivityCategoryId;
  label: string;
  emoji: string;
};

export type Guardian = {
  id: Uuid;
  name: string;
  email: string;
  city: string;
  createdAt: IsoDateTime;
};

export type Child = {
  id: Uuid;
  guardianId: Uuid;
  name: string;
  birthDate: IsoDate;
  gender: Gender;
  photoUri: string | null;
  interests: ActivityCategoryId[];
  xp: number;
  level: number;
  achievements: number;
};

export type PlanId = 'start' | 'plus' | 'max';

export type Plan = {
  id: PlanId;
  name: string;
  priceCents: number;
  coins: number;
  tagline: string;
  highlighted: boolean;
  perks: string[];
};

export type Partner = {
  id: Uuid;
  name: string;
  neighborhood: string;
  city: string;
  verified: boolean;
};

export type Activity = {
  id: Uuid;
  title: string;
  category: ActivityCategoryId;
  partner: Partner;
  imageUrl: string;
  rating: number;
  reviewCount: number;
  minAge: number;
  maxAge: number;
  distanceKm: number;
  coinCost: number;
  nextSessionAt: IsoDateTime;
  description: string;
  tags: string[];
};

export type BookingStatus = 'confirmed' | 'checked_in' | 'cancelled' | 'completed';

export type Booking = {
  id: Uuid;
  activityId: Uuid;
  childId: Uuid;
  status: BookingStatus;
  scheduledAt: IsoDateTime;
  coinCost: number;
};

export type Session = {
  guardian: Guardian;
  /** Token opaco. Nunca é persistido fora do armazenamento seguro do SO. */
  accessToken: string;
  expiresAt: IsoDateTime;
};

export type SubscriptionState = {
  planId: PlanId;
  coinsRemaining: number;
  renewsAt: IsoDateTime;
};
