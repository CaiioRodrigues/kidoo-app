import { useCallback, useEffect, useState } from 'react';

import { readPreference, writePreference, type PreferenceKeys } from '@/lib/preferences';

type Key = (typeof PreferenceKeys)[keyof typeof PreferenceKeys];

/**
 * Dica que aparece uma única vez, na primeira vez que a pessoa chega à tela.
 *
 * Instrução no momento em que ela é necessária gruda muito mais do que a mesma
 * frase decorada no tutorial de abertura — quem chega na aula não vai lembrar
 * do passo 3 de um carrossel visto dias antes.
 */
export function useOneTimeHint(key: Key, ready = true): { visible: boolean; dismiss: () => void } {
  const [state, setState] = useState<'checking' | 'show' | 'hidden'>('checking');

  useEffect(() => {
    if (!ready) return;
    let active = true;
    void readPreference(key).then((seen) => {
      if (active) setState(seen === 'true' ? 'hidden' : 'show');
    });
    return () => {
      active = false;
    };
  }, [key, ready]);

  const dismiss = useCallback(() => {
    setState('hidden');
    void writePreference(key, 'true');
  }, [key]);

  return { visible: ready && state === 'show', dismiss };
}
