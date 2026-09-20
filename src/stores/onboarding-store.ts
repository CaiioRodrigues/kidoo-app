import { create } from 'zustand';

import { SecureKeys, secureDelete, secureGet, secureSet } from '@/lib/secure-storage';
import type { ActivityCategoryId, Gender, PlanId } from '@/types/domain';

export type ChildDraft = {
  name: string;
  birthDate: string;
  gender: Gender;
  photoUri: string | null;
  interests: ActivityCategoryId[];
};

type OnboardingState = {
  draft: ChildDraft;
  selectedPlanId: PlanId | null;
  activeChildId: string | null;
  setProfile: (profile: Omit<ChildDraft, 'interests'>) => void;
  toggleInterest: (id: ActivityCategoryId) => void;
  selectPlan: (id: PlanId) => void;
  setActiveChild: (id: string) => void;
  /** Lê do armazenamento seguro quem estava em foco na última sessão. */
  hydrateActiveChild: () => Promise<void>;
  /** No logout: a próxima família não abre o app apontada para esta. */
  forgetActiveChild: () => Promise<void>;
  reset: () => void;
};

const EMPTY_DRAFT: ChildDraft = {
  name: '',
  birthDate: '',
  gender: 'undisclosed',
  photoUri: null,
  interests: [],
};

/**
 * Rascunho do cadastro da criança: fica só em memória, de propósito.
 * Dado de menor de idade não é persistido no aparelho antes do responsável
 * concluir o cadastro e consentir.
 */
export const useOnboardingStore = create<OnboardingState>((set, get) => ({
  draft: EMPTY_DRAFT,
  selectedPlanId: null,
  activeChildId: null,

  setProfile(profile) {
    set((state) => ({ draft: { ...state.draft, ...profile } }));
  },

  toggleInterest(id) {
    set((state) => {
      const selected = state.draft.interests.includes(id);
      const interests = selected
        ? state.draft.interests.filter((item) => item !== id)
        : [...state.draft.interests, id];
      return { draft: { ...state.draft, interests } };
    });
  },

  selectPlan(id) {
    set({ selectedPlanId: id });
  },

  setActiveChild(id) {
    set({ activeChildId: id });
    // Sem `await`: a tela troca na hora, e gravar é consequência. Uma escrita
    // que falha (keystore indisponível) não pode travar a troca — o pior que
    // acontece é o app reabrir na criança anterior.
    void secureSet(SecureKeys.criancaAtiva, id).catch(() => undefined);
  },

  async hydrateActiveChild() {
    // Só na partida. Depois disso quem manda é a escolha da sessão, e reler
    // aqui desfaria uma troca feita segundos antes.
    if (get().activeChildId) return;
    const id = await secureGet(SecureKeys.criancaAtiva);
    if (id) set({ activeChildId: id });
  },

  async forgetActiveChild() {
    set({ activeChildId: null });
    await secureDelete(SecureKeys.criancaAtiva);
  },

  reset() {
    set({ draft: EMPTY_DRAFT, selectedPlanId: null });
  },
}));
