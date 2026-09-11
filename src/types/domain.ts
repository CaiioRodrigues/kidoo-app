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

/**
 * Origem da vaga, que decide quanto o parceiro recebe.
 *
 * `ociosa` é lugar sobrando numa turma que vai acontecer de qualquer jeito: o
 * professor já está pago e a sala já está alugada, então a criança a mais não
 * custa nada ao parceiro — e por isso o repasse é menor. `cheia` é vaga que
 * desloca um matriculado ou obriga a abrir turma, e custa o valor integral.
 *
 * É a única fonte de custo marginal baixo que existe em atividade infantil.
 */
export type SlotKind = 'ociosa' | 'cheia';

/**
 * Uma turma concreta: dia, hora e lugares.
 *
 * Antes o catálogo tratava a atividade como uma coisa só, com um horário
 * genérico. Mas quem tem capacidade é a turma, não a atividade — e é o parceiro
 * quem decide **quantos lugares libera em cada uma**. Sem esta entidade não
 * existe vaga ociosa, nem extrato de repasse por tipo de vaga.
 */
export type ClassSession = {
  id: Uuid;
  activityId: Uuid;
  startsAt: IsoDateTime;
  /** Lugares que a turma comporta, pela razão professor/criança da modalidade. */
  capacity: number;
  /** Já matriculados direto com o parceiro. Não passam pelo Kidoo. */
  enrolled: number;
  /** Quantos lugares o parceiro abriu para o Kidoo nesta turma. */
  slotsOpen: number;
  /** Reservas do Kidoo já feitas aqui. */
  slotsTaken: number;
  kind: SlotKind;
  /** Custo em coins. Vaga ociosa custa menos — é o que move a família para o horário vazio. */
  coinCost: number;
};

/** Lugares que ainda dá para reservar nesta turma. */
export function slotsAvailable(session: ClassSession): number {
  return Math.max(0, session.slotsOpen - session.slotsTaken);
}

/**
 * Turmas em que esta criança já tem lugar.
 *
 * Espelha o índice `one_seat_per_child` do banco, inclusive na exclusão das
 * canceladas: desistir de uma aula tem de liberar a turma de volta. Vive aqui,
 * e não em cada tela, porque a regra é a mesma para a lista de turmas e para a
 * tela de confirmação — e porque discordar do banco aqui significaria oferecer
 * um botão que o servidor recusa.
 *
 * É por criança, não por família: dois irmãos podem ocupar dois lugares na
 * mesma turma, e essa é justamente a reserva que não pode ser bloqueada.
 */
export function bookedSessionIds(bookings: Booking[], childId: string | null): Set<Uuid> {
  if (!childId) return new Set();
  return new Set(
    bookings
      .filter((booking) => booking.childId === childId && booking.status !== 'cancelled')
      .map((booking) => booking.sessionId),
  );
}

/**
 * Um pedido de aviso: esta criança quer esta turma quando abrir vaga.
 *
 * Guardado por criança, e não por família, porque é a criança que ocuparia o
 * lugar — e porque com dois filhos a mesma família pode querer avisos de
 * turmas diferentes.
 */
export type WaitlistEntry = {
  sessionId: Uuid;
  childId: Uuid;
  createdAt: IsoDateTime;
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
  /**
   * Menor custo entre as turmas abertas — o "a partir de" dos cartões.
   * Derivado das turmas; quem cobra de verdade é a turma escolhida.
   */
  coinCost: number;
  /** Primeira turma com vaga. Derivado, como o `coinCost`. */
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
  /** Turma reservada. É ela que define horário, preço e o repasse devido. */
  sessionId: Uuid;
  childId: Uuid;
  status: BookingStatus;
  scheduledAt: IsoDateTime;
  checkedInAt: IsoDateTime | null;
  coinCost: number;
  /**
   * Tipo da vaga no momento da reserva, congelado aqui de propósito: o extrato
   * de repasse do parceiro é calculado sobre isto, e a turma pode mudar depois.
   */
  slotKind: SlotKind;
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
  /**
   * O que a confirmação do parceiro rendeu. Null enquanto ele não confirmou —
   * e é essa transição que a tela da reserva celebra.
   */
  reward: BookingReward | null;
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

/** Desenho da medalha da conquista. Cada um é um glifo em `AchievementIcon`. */
export type AchievementIcon =
  | 'estrela'
  | 'raio'
  | 'medalha'
  | 'trofeu'
  | 'mapa'
  | 'bussola'
  | 'coroa'
  | 'bola'
  | 'onda'
  | 'nota'
  | 'faixa'
  | 'paleta';

/** Cor da medalha. Não é a cor da modalidade: medalha é objeto, não superfície. */
export type AchievementTone = 'ouro' | 'laranja' | 'agua' | 'verde' | 'rosa' | 'roxo';

export type Achievement = {
  id: string;
  label: string;
  /** O que falta fazer. É o que a medalha bloqueada mostra em vez de nada. */
  hint: string;
  icon: AchievementIcon;
  tone: AchievementTone;
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

/**
 * O que a confirmação do parceiro rendeu.
 *
 * Fica guardado na reserva porque a comemoração acontece **do outro lado do
 * balcão**: quem confirma é o parceiro, no painel dele, e o app da família só
 * descobre na próxima vez que abrir. Sem um registro na reserva, o "você subiu
 * de nível" nunca chegaria a quem subiu.
 */
export type BookingReward = {
  xpEarned: number;
  levelUp: { from: number; to: number; bonusEarned: number } | null;
};

/**
 * O que o check-in devolve.
 *
 * Só o comprovante. Chegar não vale XP: o portão de distância deixa passar
 * quem não tem leitura de GPS (negamos com prova contra, nunca por falta de
 * prova), então creditar aqui faria de "negar a permissão de localização" uma
 * fábrica de Kidoo Bônus. Quem diz que a criança veio é quem a recebeu.
 */
export type CheckInResult = {
  booking: BookingDetails;
  /** Quanto entra quando o parceiro confirmar. Nada foi creditado ainda. */
  xpOnConfirm: number;
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

/**
 * O que sai de um cadastro.
 *
 * São dois desfechos legítimos, e nenhum deles é erro. Com a confirmação de
 * e-mail ligada — que é como tem de ficar antes de qualquer família real,
 * senão qualquer um cria conta com o e-mail de outra pessoa — a sessão só
 * existe depois que a pessoa clica no link. Tratar isso como falha era mandar
 * uma mensagem vermelha para quem acabou de fazer tudo certo.
 */
export type SignUpResult =
  { status: 'signed_in'; session: Session } | { status: 'needs_confirmation'; email: string };

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
