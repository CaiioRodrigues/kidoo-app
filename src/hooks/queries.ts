import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api, type ActivityFilters } from '@/services';
import { useAuthStore } from '@/stores/auth-store';
import { useLocationStore } from '@/stores/location-store';
import type { Coords } from '@/lib/geo';
import type { ActivityCategoryId, PlanId } from '@/types/domain';
import type { ChildProfileInput } from '@/lib/validation';

/** Chaves centralizadas: evita invalidação por string solta espalhada no app. */
export const queryKeys = {
  categories: ['categories'] as const,
  plans: ['plans'] as const,
  subscription: ['subscription'] as const,
  children: ['children'] as const,
  bookings: ['bookings'] as const,
  activities: (filters?: ActivityFilters) => ['activities', filters ?? {}] as const,
  activity: (id: string, origin?: Coords) => ['activity', id, origin ?? null] as const,
  reviews: (activityId: string) => ['reviews', activityId] as const,
  sessions: (activityId: string) => ['sessions', activityId] as const,
  recommended: (childId: string, origin?: Coords) =>
    ['recommended', childId, origin ?? null] as const,
  booking: (id: string) => ['booking', id] as const,
  journey: (childId: string) => ['journey', childId] as const,
};

export function useCategories() {
  return useQuery({
    queryKey: queryKeys.categories,
    queryFn: () => api.catalog.categories(),
    staleTime: Infinity,
  });
}

export function usePlans() {
  return useQuery({ queryKey: queryKeys.plans, queryFn: () => api.plans.list() });
}

export function useSubscription() {
  const authenticated = useAuthStore((state) => state.status === 'authenticated');
  return useQuery({
    queryKey: queryKeys.subscription,
    queryFn: () => api.plans.current(),
    enabled: authenticated,
  });
}

export function useChildren() {
  const authenticated = useAuthStore((state) => state.status === 'authenticated');
  return useQuery({
    queryKey: queryKeys.children,
    queryFn: () => api.children.list(),
    enabled: authenticated,
  });
}

export function useActivities(filters?: ActivityFilters, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.activities(filters),
    queryFn: () => api.catalog.activities(filters),
    enabled: options?.enabled ?? true,
  });
}

/**
 * Origem das medidas de distância. `undefined` enquanto não há permissão — e
 * aí o catálogo devolve `distanceKm: null`, que a tela sabe omitir.
 */
export function useOrigin(): Coords | undefined {
  return useLocationStore((state) => state.proof?.origin);
}

/** Turmas com vaga aberta de uma atividade. */
export function useSessions(activityId: string) {
  return useQuery({
    queryKey: queryKeys.sessions(activityId),
    queryFn: () => api.catalog.sessions(activityId),
    enabled: activityId.length > 0,
    // Vaga é disputada: cache curto para não oferecer turma que já encheu.
    staleTime: 1000 * 20,
  });
}

export function useActivity(id: string) {
  const origin = useOrigin();
  return useQuery({
    queryKey: queryKeys.activity(id, origin),
    queryFn: () => api.catalog.activity(id, origin),
    enabled: id.length > 0,
  });
}

export function useRecommended(childId: string | null) {
  const origin = useOrigin();
  return useQuery({
    queryKey: queryKeys.recommended(childId ?? '', origin),
    queryFn: () => api.catalog.recommended(childId ?? '', origin),
    enabled: Boolean(childId),
  });
}

export function useCreateChild() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ChildProfileInput & { interests: ActivityCategoryId[] }) =>
      api.children.create(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.children });
    },
  });
}

export function useSubscribe() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (planId: PlanId) => api.plans.subscribe(planId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.subscription });
    },
  });
}

export function useBookings() {
  const authenticated = useAuthStore((state) => state.status === 'authenticated');
  return useQuery({
    queryKey: queryKeys.bookings,
    queryFn: () => api.bookings.list(),
    enabled: authenticated,
    // Reservas mudam com check-in: cache curto para a aba refletir a realidade.
    staleTime: 1000 * 30,
  });
}

export function useBooking(id: string) {
  return useQuery({
    queryKey: queryKeys.booking(id),
    queryFn: () => api.bookings.get(id),
    enabled: id.length > 0,
  });
}

export function useJourney(childId: string | null) {
  return useQuery({
    queryKey: queryKeys.journey(childId ?? ''),
    queryFn: () => api.journey.get(childId ?? ''),
    enabled: Boolean(childId),
    staleTime: 1000 * 30,
  });
}

export function useCreateBooking() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { sessionId: string; childId: string }) => api.bookings.create(input),
    onSuccess: (booking, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.bookings });
      void queryClient.invalidateQueries({ queryKey: queryKeys.subscription });
      // Uma vaga a menos na turma: sem invalidar, a tela seguinte ainda
      // ofereceria o lugar que acabou de ser tomado.
      void queryClient.invalidateQueries({ queryKey: queryKeys.sessions(booking.activityId) });
      // A carteira de bônus vive dentro de journey: sem invalidar aqui, o saldo
      // debitado no servidor continuaria aparecendo cheio na tela.
      void queryClient.invalidateQueries({ queryKey: queryKeys.journey(variables.childId) });
    },
  });
}

export function useCheckIn() {
  const queryClient = useQueryClient();
  // A prova de localização sai do store no momento da chamada — quem decide se
  // ela vale é o serviço, não esta camada.
  const proof = useLocationStore((state) => state.proof);
  return useMutation({
    mutationFn: (bookingId: string) => api.bookings.checkIn(bookingId, proof ?? undefined),
    onSuccess: ({ booking }) => {
      // Check-in mexe em reserva, XP e nível da criança, carteira de bônus e jornada.
      void queryClient.invalidateQueries({ queryKey: queryKeys.bookings });
      void queryClient.invalidateQueries({ queryKey: queryKeys.booking(booking.id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.children });
      void queryClient.invalidateQueries({ queryKey: queryKeys.journey(booking.childId) });
    },
  });
}

export function useReviews(activityId: string) {
  return useQuery({
    queryKey: queryKeys.reviews(activityId),
    queryFn: () => api.catalog.reviews(activityId),
    enabled: activityId.length > 0,
    staleTime: 1000 * 60 * 5,
  });
}

export function useConfirmByPartner() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { bookingId: string; code: string }) =>
      api.bookings.confirmByPartner(input),
    onSuccess: (booking) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.bookings });
      void queryClient.invalidateQueries({ queryKey: queryKeys.booking(booking.id) });
    },
  });
}

export function useSubmitReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { bookingId: string; rating: number; comment: string }) =>
      api.catalog.submitReview(input),
    onSuccess: (review) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.reviews(review.activityId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.activity(review.activityId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.bookings });
    },
  });
}

export function useCancelBooking() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (bookingId: string) => api.bookings.cancel(bookingId),
    onSuccess: (booking) => {
      // Cancelar devolve coins e bônus: os três precisam ser reconsultados.
      void queryClient.invalidateQueries({ queryKey: queryKeys.bookings });
      void queryClient.invalidateQueries({ queryKey: queryKeys.booking(booking.id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.subscription });
      void queryClient.invalidateQueries({ queryKey: queryKeys.journey(booking.childId) });
      // A vaga voltou para a turma.
      void queryClient.invalidateQueries({ queryKey: queryKeys.sessions(booking.activityId) });
    },
  });
}
