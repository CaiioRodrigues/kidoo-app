import { create } from 'zustand';

import { logger } from '@/lib/logger';
import { clearQueryCache } from '@/lib/query-client';
import { obterTokenDePush, pushPlatform } from '@/lib/push';
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
/**
 * Registra o aparelho para receber aviso de vaga.
 *
 * Não bloqueia o login e não propaga erro: quem não conseguiu registrar entra
 * do mesmo jeito e simplesmente não recebe push. A fila de espera continua
 * guardada no servidor, então o pedido não se perde — só a entrega.
 */
async function registrarAparelho(): Promise<void> {
  const token = await obterTokenDePush();
  if (!token) return;
  try {
    await api.push.register({ token, platform: pushPlatform() });
    tokenAtual = token;
  } catch {
    // Sem aviso é pior que com aviso, mas é muito melhor que não entrar.
  }
}

/**
 * O token deste aparelho, para dar baixa no logout.
 *
 * Fora da store de propósito: não é estado de tela, ninguém redesenha por
 * causa dele, e guardá-lo no `set` faria toda tela inscrita re-renderizar
 * quando o registro terminasse.
 */
let tokenAtual: string | null = null;

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
      // Também ao restaurar: o token do Expo pode ter mudado desde a última
      // vez (reinstalação, restauração de backup), e quem abre o app amanhã
      // sem passar pelo login nunca teria o registro atualizado.
      void registrarAparelho();
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
    void registrarAparelho();
  },

  async signUp(input) {
    const result = await api.auth.signUp(input);
    if (result.status === 'signed_in') {
      await secureSet(SecureKeys.session, result.session.accessToken);
      set({ status: 'authenticated', session: result.session });
      void registrarAparelho();
    }
    return result;
  },

  async resendConfirmation(email) {
    await api.auth.resendConfirmation(email);
  },

  async signOut() {
    try {
      // Baixa ANTES de encerrar a sessão: `forget_push_token` filtra por
      // `auth.uid()`, então depois do logout ela não apagaria nada e o
      // aparelho continuaria recebendo os avisos desta conta.
      if (tokenAtual) {
        await api.push.forget(tokenAtual).catch(() => undefined);
        tokenAtual = null;
      }
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
