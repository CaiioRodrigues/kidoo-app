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
export function useTutorial(ready = true): { visible: boolean; dismiss: () => void } {
  const status = useTutorialStore((state) => state.status);
  const hydrate = useTutorialStore((state) => state.hydrate);
  const dismiss = useTutorialStore((state) => state.dismiss);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  // `ready` existe para o tutorial não cobrir uma tela que ainda está
  // carregando: a apresentação fala de aulas perto de casa, e cair por cima de
  // esqueletos cinzentos é a pior primeira impressão possível. Ele espera a
  // Home ter o que mostrar por trás.
  return { visible: ready && status === 'show', dismiss };
}
