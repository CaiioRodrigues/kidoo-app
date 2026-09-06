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
  /** Cobrança é mensal. */
  priceCents: number;
  /** Cota de Kidoo Coins liberada a cada semana. */
  coinsPerWeek: number;
  /** Quantas atividades a cota costuma render, dado o custo médio. */
  activitiesPerWeek: number;
  tagline: string;
  highlighted: boolean;
  perks: string[];
};

/**
 * Faixas de custo de uma atividade, em Kidoo Coins.
 * O custo médio do catálogo é o que calibra a cota semanal dos planos.
 */
export const COIN_TIERS = {
  basico: 2,
  padrao: 3,
  premium: 4,
} as const;

export type CoinTier = keyof typeof COIN_TIERS;

export type Partner = {
  id: Uuid;
  name: string;
  neighborhood: string;
  city: string;
  verified: boolean;
  /** Onde o parceiro fica. É daqui que sai a distância mostrada na tela. */
  latitude: number;
  longitude: number;
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
  /**
   * Distância até quem está olhando, derivada da coordenada do parceiro.
   * `null` quando não sabemos onde o usuário está — e aí a tela não inventa
   * um número, apenas omite.
   */
  distanceKm: number | null;
  coinCost: number;
  nextSessionAt: IsoDateTime;
  description: string;
  tags: string[];
};

/**
 * Kidoo Bônus — moeda de recompensa, ganha ao subir de nível.
 *
 * É diferente dos Kidoo Coins da assinatura: não vem do plano, não reseta
 * toda semana e cada lote vale por 30 dias a partir do dia em que foi ganho.
 * Por isso é guardada como lotes datados, e não como um saldo solto — sem
 * isso não há como saber o que vence quando.
 */
export type BonusGrant = {
  id: Uuid;
  childId: Uuid;
  amount: number;
  /** Nível alcançado que gerou o bônus. */
  level: number;
  grantedAt: IsoDateTime;
  expiresAt: IsoDateTime;
};

export type BonusWallet = {
  childId: Uuid;
  /** Soma apenas dos lotes ainda válidos. */
  balance: number;
  /** Lotes válidos, do que expira primeiro para o que expira por último. */
  grants: BonusGrant[];
  /** Próximo lote a vencer, para avisar antes de o usuário perder. */
  nextExpiring: { amount: number; expiresAt: IsoDateTime } | null;
};

/** Como uma reserva foi paga. O bônus sai primeiro, porque expira. */
export type CoinPayment = {
  fromBonus: number;
  fromSubscription: number;
  total: number;
  /**
   * Lotes de bônus consumidos, com a validade original.
   *
   * Sem isso, cancelar devolveria bônus como moeda nova de 30 dias — bastaria
   * reservar e cancelar para renovar a validade indefinidamente. Guardando a
   * data original, a devolução é exata e não dá para esticar o prazo.
   */
  bonusLots: { amount: number; expiresAt: IsoDateTime; level: number }[];
};

/** Comentário de um responsável sobre uma atividade. */
export type Review = {
  id: Uuid;
  activityId: Uuid;
  /** Primeiro nome de quem avaliou — nunca o nome completo nem o da criança. */
  authorName: string;
  /** Nota inteira de 1 a 5. */
  rating: number;
  comment: string;
  createdAt: IsoDateTime;
  /** Quantas pessoas marcaram o comentário como útil. */
  helpfulCount: number;
};

/** Resumo das notas de uma atividade, com a distribuição por estrela. */
export type RatingSummary = {
  average: number;
  total: number;
  /** Quantidade de avaliações por nota, da chave 1 até a 5. */
  distribution: Record<1 | 2 | 3 | 4 | 5, number>;
};

export type BookingStatus = 'confirmed' | 'checked_in' | 'cancelled' | 'completed';

export type Booking = {
  id: Uuid;
  activityId: Uuid;
  childId: Uuid;
  status: BookingStatus;
  scheduledAt: IsoDateTime;
  checkedInAt: IsoDateTime | null;
  coinCost: number;
  payment: CoinPayment;
  /**
   * Código que o parceiro lê para confirmar a presença. Só existe depois do
   * check-in, e expira — um código eterno viraria um passe livre.
   */
  checkIn: CheckInTicket | null;
  /** Quando o parceiro validou o código. Null enquanto não validou. */
  partnerConfirmedAt: IsoDateTime | null;
  /**
   * Como a presença foi aferida no momento do check-in.
   *
   * Guardamos a *distância*, nunca a coordenada: para auditar um check-in
   * suspeito basta saber que ele veio de 40 km, e ninguém precisa da localização
   * da família no banco. Null enquanto não houve check-in.
   */
  checkInProof: CheckInProof | null;
  /** Avaliação já enviada para esta reserva, se houver. */
  reviewId: Uuid | null;
};

/**
 * Comprovante de check-in apresentado ao parceiro.
 *
 * O código curto é para digitação manual; o payload do QR carrega a mesma
 * informação para leitura. Ambos apontam para a mesma reserva e caducam
 * juntos.
 */
export type CheckInProof = {
  /** Falso quando não deu para conferir — sem permissão, sem sinal ou mock. */
  locationVerified: boolean;
  /** Metros até o parceiro, arredondados. Null quando não houve leitura. */
  distanceM: number | null;
  /** O aparelho declarou localização simulada. */
  mocked: boolean;
};

export type CheckInTicket = {
  /** 6 dígitos, fácil de ditar em voz alta. */
  code: string;
  /** Conteúdo do QR — inclui a reserva, para o parceiro validar o vínculo. */
  qrPayload: string;
  issuedAt: IsoDateTime;
  expiresAt: IsoDateTime;
};

/** Reserva já resolvida com atividade e criança — o que as telas consomem. */
export type BookingDetails = Booking & {
  activity: Activity;
  child: Child;
};

export type Achievement = {
  id: string;
  label: string;
  emoji: string;
  /** Null enquanto a conquista ainda não foi desbloqueada. */
  unlockedAt: IsoDateTime | null;
};

/** Quantas aulas a criança fez em cada modalidade. */
export type ActivityTally = {
  category: ActivityCategoryId;
  label: string;
  emoji: string;
  count: number;
};

/** O que o check-in rendeu — a tela de check-in celebra a partir disto. */
export type CheckInResult = {
  booking: BookingDetails;
  xpEarned: number;
  levelUp: { from: number; to: number; bonusEarned: number } | null;
  /** Código a apresentar ao parceiro. */
  ticket: CheckInTicket;
};

export type Journey = {
  childId: Uuid;
  xp: number;
  level: number;
  /** Nome do nível exibido ao lado do XP ("Explorador", "Campeão"...). */
  levelName: string;
  /** XP acumulado dentro do nível atual. */
  xpIntoLevel: number;
  /** XP que o nível atual exige por inteiro. Zero no nível máximo. */
  xpForLevel: number;
  /** Teto de níveis vigente. */
  maxLevel: number;
  isMaxLevel: boolean;
  /** Kidoo Bônus que o próximo nível concede. Zero se já está no teto. */
  nextLevelBonus: number;
  achievements: Achievement[];
  activityTally: ActivityTally[];
  /** Aulas por semana, da mais antiga para a mais recente. */
  weeklyActivity: { label: string; count: number }[];
  totalActivities: number;
  totalCategories: number;
  /** Carteira de Kidoo Bônus da criança. */
  bonus: BonusWallet;
};

export type Session = {
  guardian: Guardian;
  /** Token opaco. Nunca é persistido fora do armazenamento seguro do SO. */
  accessToken: string;
  expiresAt: IsoDateTime;
};

export type SubscriptionState = {
  planId: PlanId;
  /** Cota cheia da semana. */
  coinsPerWeek: number;
  /** Quanto ainda resta na semana corrente. */
  coinsRemaining: number;
  /** Início da semana vigente (segunda-feira). */
  cycleStartsAt: IsoDateTime;
  /**
   * Quando a cota volta ao cheio (próxima segunda). Coins não acumulam:
   * o que não for usado na semana é perdido na virada.
   */
  cycleResetsAt: IsoDateTime;
  /** Próxima cobrança mensal. */
  renewsAt: IsoDateTime;
};
