import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api, type ActivityFilters } from '@/services';
import { useAuthStore } from '@/stores/auth-store';
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
  activity: (id: string) => ['activity', id] as const,
  recommended: (childId: string) => ['recommended', childId] as const,
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

export function useActivities(filters?: ActivityFilters) {
  return useQuery({
    queryKey: queryKeys.activities(filters),
    queryFn: () => api.catalog.activities(filters),
  });
}

export function useActivity(id: string) {
  return useQuery({
    queryKey: queryKeys.activity(id),
    queryFn: () => api.catalog.activity(id),
    enabled: id.length > 0,
  });
}

export function useRecommended(childId: string | null) {
  return useQuery({
    queryKey: queryKeys.recommended(childId ?? ''),
    queryFn: () => api.catalog.recommended(childId ?? ''),
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
    mutationFn: (input: { activityId: string; childId: string }) => api.bookings.create(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.bookings });
      void queryClient.invalidateQueries({ queryKey: queryKeys.subscription });
    },
  });
}

export function useCheckIn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (bookingId: string) => api.bookings.checkIn(bookingId),
    onSuccess: (booking) => {
      // Check-in mexe em reserva, XP da criança e jornada.
      void queryClient.invalidateQueries({ queryKey: queryKeys.bookings });
      void queryClient.invalidateQueries({ queryKey: queryKeys.booking(booking.id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.children });
      void queryClient.invalidateQueries({ queryKey: queryKeys.journey(booking.childId) });
    },
  });
}
