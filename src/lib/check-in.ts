import { haversineKm, type Coords } from './geo';
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

/**
 * Raio em que consideramos que a pessoa chegou no local.
 *
 * 250 m é generoso de propósito. Um clube ocupa um quarteirão, o GPS erra
 * dezenas de metros perto de prédio alto, e o custo dos dois erros não é
 * simétrico: deixar entrar quem está na calçada em frente é um aborrecimento;
 * travar quem está dentro da piscina é uma ligação para o suporte.
 */
export const CHECK_IN_RADIUS_M = 250;

/** O check-in abre um pouco antes da aula e fecha um tempo depois. */
export const CHECK_IN_OPENS_BEFORE_MIN = 45;
export const CHECK_IN_CLOSES_AFTER_MIN = 90;

export type Proximity =
  /** Leitura confiável e dentro do raio. */
  | { kind: 'arrived'; distanceM: number }
  /** Leitura confiável e fora do raio — é o único caso em que dá para negar. */
  | { kind: 'far'; distanceM: number }
  /** Sem permissão, sem sinal, ou localização simulada. Não sabemos. */
  | { kind: 'unknown' };

export type LocationProof = {
  origin: Coords;
  /** Raio de erro que o próprio aparelho declara, em metros. */
  accuracyM: number;
  /** Android entrega isto quando há app de mock location ativo. */
  mocked: boolean;
};

/**
 * Onde a pessoa está em relação ao parceiro.
 *
 * A margem de erro do aparelho entra a favor de quem está chegando: comparamos
 * `distância − precisão` com o raio. Um GPS que diz "300 m, ±120 m" pode
 * perfeitamente estar em cima do local, e não é papel do app apostar contra.
 *
 * Localização simulada vira `unknown`, nunca `arrived`: se o aparelho avisa que
 * o dado é falso, o mínimo é não usá-lo como prova.
 */
export function proximityTo(
  partner: Coords,
  proof: LocationProof | null,
): Proximity {
  if (!proof || proof.mocked) return { kind: 'unknown' };

  const distanceM = haversineKm(proof.origin, partner) * 1000;
  const effectiveM = distanceM - Math.max(0, proof.accuracyM);

  return effectiveM <= CHECK_IN_RADIUS_M
    ? { kind: 'arrived', distanceM }
    : { kind: 'far', distanceM };
}

export type CheckInWindow = {
  open: boolean;
  opensAt: Date;
  closesAt: Date;
  /** `early` antes de abrir, `late` depois de fechar. */
  reason: 'open' | 'early' | 'late';
};

export function checkInWindow(scheduledAt: string, now: Date = new Date()): CheckInWindow {
  const session = Date.parse(scheduledAt);
  const opensAt = new Date(session - CHECK_IN_OPENS_BEFORE_MIN * 60 * 1000);
  const closesAt = new Date(session + CHECK_IN_CLOSES_AFTER_MIN * 60 * 1000);

  if (now < opensAt) return { open: false, opensAt, closesAt, reason: 'early' };
  if (now > closesAt) return { open: false, opensAt, closesAt, reason: 'late' };
  return { open: true, opensAt, closesAt, reason: 'open' };
}

/**
 * Se o check-in pode ser feito agora.
 *
 * A regra é assimétrica de propósito: negamos quando temos **prova contra**
 * (leitura boa dizendo que a pessoa está longe), não quando falta prova. Sem
 * localização o check-in segue, marcado como não verificado — é o parceiro
 * quem confirma a presença de verdade, e travar aqui só puniria quem está numa
 * quadra coberta sem sinal.
 */
export function canCheckIn(
  proximity: Proximity,
  window: CheckInWindow,
): { allowed: boolean; blockedBy: 'window' | 'distance' | null } {
  if (!window.open) return { allowed: false, blockedBy: 'window' };
  if (proximity.kind === 'far') return { allowed: false, blockedBy: 'distance' };
  return { allowed: true, blockedBy: null };
}

/** "230 m" / "2,3 km" — a distância que falta para chegar. */
export function formatGap(distanceM: number): string {
  return distanceM < 1000
    ? `${Math.round(distanceM / 10) * 10} m`
    : `${(distanceM / 1000).toFixed(1).replace('.', ',')} km`;
}

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
