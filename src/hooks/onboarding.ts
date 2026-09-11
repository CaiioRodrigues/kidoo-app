import { useCallback } from 'react';

import { useCreateChild } from './queries';
import { useOnboardingStore } from '@/stores/onboarding-store';
import type { Child } from '@/types/domain';

/**
 * Cria a criança a partir do rascunho do cadastro, se houver rascunho.
 *
 * Vive fora das telas porque **duas** precisam dela: a de planos, no cadastro
 * da primeira criança, e a de interesses, quando a família já assina e está
 * acrescentando um irmão. Uma cópia em cada tela é como as duas passam a
 * divergir — uma ganha o `setActiveChild`, a outra não, e ninguém percebe até
 * a Home abrir na criança errada.
 *
 * Devolve `null` quando não há rascunho. A tela de planos também é usada por
 * quem só quer assinar, com a criança já cadastrada, e nesse caso não há nada
 * para criar.
 */
export function useCriarCriancaDoRascunho(): {
  criar: () => Promise<Child | null>;
  criando: boolean;
} {
  const draft = useOnboardingStore((state) => state.draft);
  const setActiveChild = useOnboardingStore((state) => state.setActiveChild);
  const createChild = useCreateChild();

  const criar = useCallback(async () => {
    const temRascunho = draft.name.trim().length > 0 && draft.birthDate.length > 0;
    if (!temRascunho) return null;

    // O cadastro só é enviado agora, ao final do fluxo consentido.
    const child = await createChild.mutateAsync({
      name: draft.name,
      birthDate: draft.birthDate,
      gender: draft.gender,
      photoUri: draft.photoUri,
      interests: draft.interests,
    });
    setActiveChild(child.id);
    return child;
  }, [createChild, draft, setActiveChild]);

  return { criar, criando: createChild.isPending };
}
