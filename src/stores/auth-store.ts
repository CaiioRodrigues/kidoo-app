import { create } from 'zustand';

import { logger } from '@/lib/logger';
import { SecureKeys, secureDelete, secureGet, secureSet } from '@/lib/secure-storage';
import type { SignInInput, SignUpInput } from '@/lib/validation';
import { api } from '@/services';
import type { Session } from '@/types/domain';

type AuthStatus = 'idle' | 'restoring' | 'authenticated' | 'unauthenticated';

type AuthState = {
  status: AuthStatus;
  session: Session | null;
  restore: () => Promise<void>;
  signIn: (input: SignInInput) => Promise<void>;
  signUp: (input: SignUpInput) => Promise<void>;
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
    await secureSet(SecureKeys.session, session.accessToken);
    set({ status: 'authenticated', session });
  },

  async signUp(input) {
    const session = await api.auth.signUp(input);
    await secureSet(SecureKeys.session, session.accessToken);
    set({ status: 'authenticated', session });
  },

  async signOut() {
    try {
      await api.auth.signOut();
    } finally {
      await secureDelete(SecureKeys.session);
      set({ status: 'unauthenticated', session: null });
    }
  },
}));
