/** Erro de aplicação com mensagem já pronta para o usuário (pt-BR). */
export class ApiError extends Error {
  readonly code: ApiErrorCode;

  constructor(code: ApiErrorCode, message: string) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
  }
}

export type ApiErrorCode =
  | 'invalid_credentials'
  | 'email_in_use'
  | 'not_found'
  /** A criança já tem lugar nesta turma. A tela desabilita em vez de deixar tentar. */
  | 'already_booked'
  /** Pediu aviso numa turma que ainda tem vaga: o caminho é reservar. */
  | 'session_has_room'
  | 'insufficient_coins'
  | 'network'
  | 'unknown';

export function toUserMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return 'Algo deu errado por aqui. Tente de novo em instantes.';
}
