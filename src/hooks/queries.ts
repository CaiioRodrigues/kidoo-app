import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import { api, type ActivityFilters } from '@/services';
import { useAuthStore } from '@/stores/auth-store';
import { useLocationStore } from '@/stores/location-store';
import { useOnboardingStore } from '@/stores/onboarding-store';
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
  waitlist: ['waitlist'] as const,
  activities: (filters?: ActivityFilters) => ['activities', filters ?? {}] as const,
  activity: (id: string, origin?: Coords) => ['activity', id, origin ?? null] as const,
  partner: (id: string, origin?: Coords) => ['partner', id, origin ?? null] as const,
  reviews: (activityId: string) => ['reviews', activityId] as const,
  sessions: (activityId: string) => ['sessions', activityId] as const,
  recommended: (childId: string, origin?: Coords) =>
    ['recommended', childId, origin ?? null] as const,
  booking: (id: string) => ['booking', id] as const,
  journey: (childId: string) => ['journey', childId] as const,
};

/**
 * Prefixos para invalidar **todas** as variações de uma chave.
 *
 * `activity`, `activities` e `recommended` carregam a origem de distância e os
 * filtros na chave. O React Query casa por prefixo, então invalidar
 * `['activity', id, null]` não alcança `['activity', id, { lat, lng }]` — e a
 * tela de quem tem localização ligada ficava com o dado velho.
 */
export const queryPrefixes = {
  activity: (id: string) => ['activity', id] as const,
  activities: ['activities'] as const,
  recommended: ['recommended'] as const,
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

/**
 * A criança de quem estamos falando agora.
 *
 * O app é de uma família, mas quase toda tela fala de uma criança só: a jornada
 * é dela, os coins saem do bolso dela, e a turma já reservada é dela. Sem a
 * queda para a primeira da lista, quem nunca abriu o seletor não teria criança
 * ativa nenhuma e as telas ficariam vazias sem motivo aparente.
 */
export function useActiveChild() {
  const { data: children = [] } = useChildren();
  const activeChildId = useOnboardingStore((state) => state.activeChildId);
  return useMemo(
    () => children.find((item) => item.id === activeChildId) ?? children[0] ?? null,
    [activeChildId, children],
  );
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

/** O estabelecimento e as atividades dele. */
export function usePartner(id: string) {
  const origin = useOrigin();
  return useQuery({
    queryKey: queryKeys.partner(id, origin),
    queryFn: () => api.catalog.partner(id, origin),
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

/**
 * Troca (ou remove) a foto da criança.
 *
 * Invalida `children` e a jornada: o avatar aparece no Perfil, na Home e na
 * jornada, e sem invalidar as três a foto nova apareceria numa tela só.
 */
export function useUpdateChildPhoto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { childId: string; photoUri: string | null }) =>
      api.children.updatePhoto(input),
    onSuccess: (child) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.children });
      void queryClient.invalidateQueries({ queryKey: queryKeys.journey(child.id) });
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

/**
 * Uma reserva.
 *
 * `waitingConfirmation` liga uma releitura periódica: entre o check-in e a
 * confirmação do parceiro passam segundos — no primeiro teste real, dois
 * minutos — com a família de celular na mão esperando o professor ler o
 * código. É nessa janela que o XP entra, e é do outro lado do balcão que ele
 * é creditado. Sem reler, a comemoração só apareceria na próxima abertura do
 * app, quando já não é comemoração de nada.
 */
export function useBooking(id: string) {
  return useQuery({
    queryKey: queryKeys.booking(id),
    queryFn: () => api.bookings.get(id),
    enabled: id.length > 0,
    // A própria resposta decide se vale reler: enquanto a criança entrou e a
    // confirmação não chegou, sim; em qualquer outro estado, não. Deixar isso
    // com a tela exigiria um estado espelhando o que a query já sabe.
    // 6 s é curto o bastante para parecer instantâneo e longo o bastante para
    // não virar uma consulta por segundo numa tela que fica aberta.
    refetchInterval: (query) => {
      const reserva = query.state.data;
      return reserva?.status === 'checked_in' && !reserva.reward ? 6000 : false;
    },
  });
}

/**
 * Em quais turmas esta família pediu aviso.
 *
 * Uma consulta só para a família inteira, e não uma por turma: a tela da
 * atividade precisa marcar várias linhas de uma vez, e uma consulta por linha
 * seria N+1 numa lista que já é longa.
 */
export function useWaitlist() {
  const authenticated = useAuthStore((state) => state.status === 'authenticated');
  return useQuery({
    queryKey: queryKeys.waitlist,
    queryFn: () => api.waitlist.list(),
    enabled: authenticated,
  });
}

export function useJoinWaitlist() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { sessionId: string; childId: string }) => api.waitlist.join(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.waitlist });
    },
  });
}

export function useLeaveWaitlist() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { sessionId: string; childId: string }) => api.waitlist.leave(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.waitlist });
    },
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
      // Quem reserva sai da fila de espera — o gatilho faz isso no servidor, e
      // sem reler a turma continuaria marcada como "esperando aviso".
      void queryClient.invalidateQueries({ queryKey: queryKeys.waitlist });
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
      void queryClient.invalidateQueries({ queryKey: queryKeys.bookings });
      // A nota entra na média da atividade, e a média aparece em três lugares:
      // no detalhe, na busca do Explorar e nos recomendados da Home. Invalidar
      // só o detalhe deixava o cartão da Home com o número anterior.
      void queryClient.invalidateQueries({ queryKey: queryPrefixes.activity(review.activityId) });
      void queryClient.invalidateQueries({ queryKey: queryPrefixes.activities });
      void queryClient.invalidateQueries({ queryKey: queryPrefixes.recommended });
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
      // A vaga voltou para a turma — e com ela some o "Avise-me" da linha.
      void queryClient.invalidateQueries({ queryKey: queryKeys.sessions(booking.activityId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.waitlist });
    },
  });
}
