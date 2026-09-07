import { useEffect } from 'react';

import { useTutorialStore } from '@/stores/tutorial-store';

/**
 * Decide se o tutorial de boas-vindas aparece.
 *
 * O estado vive num store, e não aqui: a Home é remontada ao voltar do
 * check-in (que faz `replace` para as abas), e com o estado local o tutorial
 * voltava junto. Enquanto a preferência não chega do armazenamento nada é
 * exibido, para quem já viu não ver o tutorial piscar a cada abertura.
 */
export function useTutorial(): { visible: boolean; dismiss: () => void } {
  const status = useTutorialStore((state) => state.status);
  const hydrate = useTutorialStore((state) => state.hydrate);
  const dismiss = useTutorialStore((state) => state.dismiss);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  return { visible: status === 'show', dismiss };
}
