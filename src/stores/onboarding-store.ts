import { create } from 'zustand';

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
export const useOnboardingStore = create<OnboardingState>((set) => ({
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
  },

  reset() {
    set({ draft: EMPTY_DRAFT, selectedPlanId: null });
  },
}));
