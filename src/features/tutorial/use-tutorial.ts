import { useCallback, useEffect, useState } from 'react';

import { PreferenceKeys, readPreference, writePreference } from '@/lib/preferences';

type State = 'checking' | 'show' | 'hidden';

/**
 * Decide se o tutorial de boas-vindas aparece.
 *
 * Enquanto a preferência não chega do armazenamento, o estado é 'checking' e
 * nada é exibido — assim quem já viu o tutorial não o vê piscar na tela a cada
 * abertura do app.
 */
export function useTutorial(): { visible: boolean; dismiss: () => void } {
  const [state, setState] = useState<State>('checking');

  useEffect(() => {
    let active = true;
    void readPreference(PreferenceKeys.tutorialSeen).then((seen) => {
      if (active) setState(seen === 'true' ? 'hidden' : 'show');
    });
    return () => {
      active = false;
    };
  }, []);

  const dismiss = useCallback(() => {
    setState('hidden');
    void writePreference(PreferenceKeys.tutorialSeen, 'true');
  }, []);

  return { visible: state === 'show', dismiss };
}
