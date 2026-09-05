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
  Session,
  SubscriptionState,
} from '@/types/domain';
import type { ChildProfileInput, SignInInput, SignUpInput } from '@/lib/validation';

export type ActivityFilters = {
  query?: string;
  category?: ActivityCategoryId | 'all';
  childId?: string;
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
    activity(id: string): Promise<Activity>;
    recommended(childId: string): Promise<Activity[]>;
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
  };
  journey: {
    get(childId: string): Promise<Journey>;
  };
};
