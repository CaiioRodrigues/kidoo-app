import type {
  Activity,
  ActivityCategory,
  ActivityCategoryId,
  Booking,
  BookingDetails,
  CheckInResult,
  Child,
  Journey,
  Plan,
  PlanId,
  RatingSummary,
  Review,
  Session,
  SubscriptionState,
} from '@/types/domain';
import type { ChildProfileInput, SignInInput, SignUpInput } from '@/lib/validation';
import type { Coords } from '@/lib/geo';

export type ActivityFilters = {
  query?: string;
  category?: ActivityCategoryId | 'all';
  childId?: string;
  /**
   * De onde medir a distância. Sem isto o catálogo devolve `distanceKm: null`
   * — preferimos omitir a distância a estimar uma que não temos.
   */
  origin?: Coords;
  /** Só atividades dentro deste raio. Exige `origin`; sem ele é ignorado. */
  radiusKm?: number;
  /** `distance` ordena do mais perto ao mais longe. Exige `origin`. */
  sort?: 'relevance' | 'distance';
};

/**
 * Contrato único entre UI e backend. As telas dependem só desta interface —
 * trocar o mock por HTTP/Supabase é implementar isto de novo, sem tocar em tela.
 */
export type KidooApi = {
  auth: {
    signIn(input: SignInInput): Promise<Session>;
    signUp(input: SignUpInput): Promise<Session>;
    signOut(): Promise<void>;
    /** Valida a sessão restaurada do armazenamento seguro. */
    restore(token: string): Promise<Session | null>;
  };
  children: {
    list(): Promise<Child[]>;
    create(input: ChildProfileInput & { interests: ActivityCategoryId[] }): Promise<Child>;
  };
  catalog: {
    categories(): Promise<ActivityCategory[]>;
    activities(filters?: ActivityFilters): Promise<Activity[]>;
    activity(id: string, origin?: Coords): Promise<Activity>;
    recommended(childId: string, origin?: Coords): Promise<Activity[]>;
    /** Comentários da atividade, mais recentes primeiro, com o resumo das notas. */
    reviews(activityId: string): Promise<{ summary: RatingSummary; reviews: Review[] }>;
    /** Avaliação do responsável sobre o estabelecimento, após a aula. */
    submitReview(input: { bookingId: string; rating: number; comment: string }): Promise<Review>;
  };
  plans: {
    list(): Promise<Plan[]>;
    subscribe(planId: PlanId): Promise<SubscriptionState>;
    current(): Promise<SubscriptionState | null>;
  };
  bookings: {
    list(): Promise<BookingDetails[]>;
    get(id: string): Promise<BookingDetails>;
    create(input: { activityId: string; childId: string }): Promise<Booking>;
    /** Registra a presença, credita XP e, ao subir de nível, Kidoo Bônus. */
    checkIn(bookingId: string): Promise<CheckInResult>;
    /**
     * Chamado pelo parceiro ao ler o QR ou digitar o código do responsável.
     * É o que transforma "o app diz que veio" em presença confirmada.
     */
    confirmByPartner(input: { bookingId: string; code: string }): Promise<BookingDetails>;
    /**
     * Cancela a reserva e devolve os coins. Só antes do prazo mínimo e antes
     * do check-in — a regra vive no serviço, não na tela.
     */
    cancel(bookingId: string): Promise<BookingDetails>;
  };
  journey: {
    get(childId: string): Promise<Journey>;
  };
};
