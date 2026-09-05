import type { Booking } from '@/types/domain';

/**
 * Cancelamento de reserva.
 *
 * A regra existe para proteger o parceiro: ele reservou vaga, professor e
 * equipamento. Cancelar em cima da hora deixa a turma desfalcada sem tempo de
 * reposição, então há um prazo mínimo antes do início da aula.
 */
export const CANCELLATION_CUTOFF_HOURS = 6;

export type CancellationCheck =
  | { allowed: true; hoursLeft: number }
  | {
      allowed: false;
      reason: 'too_late' | 'already_checked_in' | 'already_cancelled';
      hoursLeft: number;
    };

export function hoursUntil(isoDateTime: string, now: Date = new Date()): number {
  return (Date.parse(isoDateTime) - now.getTime()) / (1000 * 60 * 60);
}

export function canCancel(booking: Booking, now: Date = new Date()): CancellationCheck {
  const hoursLeft = hoursUntil(booking.scheduledAt, now);

  if (booking.status === 'cancelled') {
    return { allowed: false, reason: 'already_cancelled', hoursLeft };
  }
  // Depois do check-in a vaga já foi usada: não há o que devolver.
  if (booking.status === 'checked_in' || booking.status === 'completed') {
    return { allowed: false, reason: 'already_checked_in', hoursLeft };
  }
  if (hoursLeft < CANCELLATION_CUTOFF_HOURS) {
    return { allowed: false, reason: 'too_late', hoursLeft };
  }

  return { allowed: true, hoursLeft };
}

export function cancellationMessage(check: CancellationCheck): string {
  if (check.allowed) return '';
  switch (check.reason) {
    case 'already_cancelled':
      return 'Esta reserva já foi cancelada.';
    case 'already_checked_in':
      return 'O check-in já foi feito, então não dá mais para cancelar.';
    case 'too_late':
      return `O cancelamento é permitido até ${CANCELLATION_CUTOFF_HOURS} horas antes da aula. Fale com o parceiro se precisar desmarcar.`;
  }
}

/** "em 3 horas" / "em 2 dias" — usado no aviso de prazo. */
export function formatDeadline(scheduledAt: string, now: Date = new Date()): string {
  const hours = hoursUntil(scheduledAt, now) - CANCELLATION_CUTOFF_HOURS;
  if (hours <= 0) return 'o prazo de cancelamento já passou';
  if (hours < 1) return 'você tem menos de 1 hora para cancelar';
  if (hours < 24) {
    const rounded = Math.floor(hours);
    return `você pode cancelar por mais ${rounded} ${rounded === 1 ? 'hora' : 'horas'}`;
  }
  const days = Math.floor(hours / 24);
  return `você pode cancelar por mais ${days} ${days === 1 ? 'dia' : 'dias'}`;
}
