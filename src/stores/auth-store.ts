import { create } from 'zustand';

import { logger } from '@/lib/logger';
import { clearQueryCache } from '@/lib/query-client';
import { SecureKeys, secureDelete, secureGet, secureSet } from '@/lib/secure-storage';
import type { SignInInput, SignUpInput } from '@/lib/validation';
import { api } from '@/services';
import type { Session, SignUpResult } from '@/types/domain';

type AuthStatus = 'idle' | 'restoring' | 'authenticated' | 'unauthenticated';

type AuthState = {
  status: AuthStatus;
  session: Session | null;
  restore: () => Promise<void>;
  signIn: (input: SignInInput) => Promise<void>;
  /**
   * Devolve o desfecho para a tela decidir o caminho: entrar direto, ou pedir
   * a confirmação do e-mail. A store não navega — quem navega é quem tem tela.
   */
  signUp: (input: SignUpInput) => Promise<SignUpResult>;
  /** Reenvia o e-mail de confirmação. */
  resendConfirmation: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
};

/**
 * O token vive no armazenamento seguro do SO e em memória — nunca em
 * AsyncStorage, arquivo ou log. Só o token é persistido: o perfil é sempre
 * revalidado no servidor ao restaurar.
 */
export const useAuthStore = create<AuthState>((set) => ({
  status: 'idle',
  session: null,

  async restore() {
    set({ status: 'restoring' });
    try {
      const token = await secureGet(SecureKeys.session);
      if (!token) {
        set({ status: 'unauthenticated', session: null });
        return;
      }

      const session = await api.auth.restore(token);
      if (!session) {
        await secureDelete(SecureKeys.session);
        set({ status: 'unauthenticated', session: null });
        return;
      }

      set({ status: 'authenticated', session });
    } catch (error) {
      logger.warn('Falha ao restaurar sessão', error);
      await secureDelete(SecureKeys.session);
      set({ status: 'unauthenticated', session: null });
    }
  },

  async signIn(input) {
    const session = await api.auth.signIn(input);
    // Antes de guardar a sessão nova: o que estiver em cache é de outra conta.
    clearQueryCache();
    await secureSet(SecureKeys.session, session.accessToken);
    set({ status: 'authenticated', session });
  },

  async signUp(input) {
    const result = await api.auth.signUp(input);
    if (result.status === 'signed_in') {
      await secureSet(SecureKeys.session, result.session.accessToken);
      set({ status: 'authenticated', session: result.session });
    }
    return result;
  },

  async resendConfirmation(email) {
    await api.auth.resendConfirmation(email);
  },

  async signOut() {
    try {
      await api.auth.signOut();
    } finally {
      await secureDelete(SecureKeys.session);
      // Sair tem de levar os dados junto. Sem isto, o nome e a jornada da
      // criança continuam na memória do app depois do logout.
      clearQueryCache();
      set({ status: 'unauthenticated', session: null });
    }
  },
}));
