import { create } from 'zustand';

import { PreferenceKeys, readPreference, writePreference } from '@/lib/preferences';

type Status =
  /** Preferência ainda não lida — nada é exibido. */
  | 'checking'
  | 'show'
  | 'hidden';

type TutorialState = {
  status: Status;
  /** Lê a preferência uma vez por execução. Chamadas seguintes não fazem nada. */
  hydrate: () => Promise<void>;
  dismiss: () => void;
  /** Rearma o tutorial, para quem quer rever a apresentação. */
  restart: () => void;
};

/**
 * Se o tutorial de boas-vindas está na tela.
 *
 * Ficava no estado local da Home, e isso trazia dois problemas. Voltar do
 * check-in faz `replace` para as abas, o que **remonta a Home** — e o tutorial
 * ressuscitava junto. E não havia como uma segunda tela (o Perfil) reapresentar
 * a introdução, porque ninguém mais enxergava esse estado.
 *
 * Num store, a decisão vale para a execução inteira e qualquer tela pode
 * rearmá-la.
 */
export const useTutorialStore = create<TutorialState>((set, get) => ({
  status: 'checking',

  hydrate: async () => {
    if (get().status !== 'checking') return;
    const seen = await readPreference(PreferenceKeys.tutorialSeen);
    // Uma releitura não pode atropelar quem já dispensou enquanto ela corria.
    if (get().status !== 'checking') return;
    set({ status: seen === 'true' ? 'hidden' : 'show' });
  },

  dismiss: () => {
    set({ status: 'hidden' });
    void writePreference(PreferenceKeys.tutorialSeen, 'true');
  },

  restart: () => {
    set({ status: 'show' });
    void writePreference(PreferenceKeys.tutorialSeen, 'false');
  },
}));
