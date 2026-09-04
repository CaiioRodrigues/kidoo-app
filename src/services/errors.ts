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
  | 'insufficient_coins'
  | 'network'
  | 'unknown';

export function toUserMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return 'Algo deu errado por aqui. Tente de novo em instantes.';
}
