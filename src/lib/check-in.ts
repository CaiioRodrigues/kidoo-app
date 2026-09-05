import type { CheckInTicket } from '@/types/domain';

/**
 * Comprovante de check-in.
 *
 * O parceiro precisa provar que a criança apareceu. O app gera um código que
 * ele lê — por QR ou digitado — e valida contra a reserva.
 *
 * Duas decisões de segurança que valem tanto aqui quanto no backend real:
 *
 * 1. O código **expira**. Um código eterno viraria passe livre: bastaria
 *    guardar a captura de tela para "provar presença" em outro dia.
 * 2. O código **não carrega dado da criança**. O QR leva apenas o id da
 *    reserva e o próprio código; quem escanear de fora não descobre nome,
 *    idade nem foto. O parceiro busca o resto no servidor, autenticado.
 */

/** Janela para o parceiro ler o código. Cobre o atraso normal de uma aula. */
export const CHECK_IN_TTL_MINUTES = 30;

const CODE_LENGTH = 6;

/** 6 dígitos, fácil de ditar em voz alta quando a câmera falha. */
function generateCode(): string {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    code += Math.floor(Math.random() * 10).toString();
  }
  return code;
}

export function issueCheckInTicket(bookingId: string, now: Date = new Date()): CheckInTicket {
  const code = generateCode();
  const expiresAt = new Date(now.getTime() + CHECK_IN_TTL_MINUTES * 60 * 1000);

  return {
    code,
    // Sem PII: só o que o parceiro precisa para validar contra o servidor.
    qrPayload: JSON.stringify({ v: 1, booking: bookingId, code }),
    issuedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };
}

export function isTicketValid(ticket: CheckInTicket | null, now: Date = new Date()): boolean {
  if (!ticket) return false;
  return Date.parse(ticket.expiresAt) > now.getTime();
}

/** Minutos inteiros restantes, para o contador na tela. */
export function minutesLeft(ticket: CheckInTicket, now: Date = new Date()): number {
  const ms = Date.parse(ticket.expiresAt) - now.getTime();
  return Math.max(0, Math.ceil(ms / 60000));
}

/** Formata como "123 456" — bem mais fácil de ler em voz alta. */
export function formatCode(code: string): string {
  return `${code.slice(0, 3)} ${code.slice(3)}`;
}
