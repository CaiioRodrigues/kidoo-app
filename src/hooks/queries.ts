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
