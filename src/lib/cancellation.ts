import { PRAZO_DE_CANCELAMENTO_H, desfechoDoCancelamento, horasAte } from '@shared/cancelamento';

import type { Booking } from '@/types/domain';

/**
 * Cancelamento de reserva.
 *
 * O prazo protege o parceiro: ele segurou vaga, professor e equipamento. Mas a
 * regra mudou de forma, e a mudança é a parte que importa:
 *
 * **Antes**, passar do prazo travava o botão. A família que não ia poder ir
 * simplesmente não avisava ninguém, e o parceiro descobria na hora da aula.
 * Pior: o prazo só existia aqui, nesta tela — `cancel_booking` no banco não
 * olhava a hora, então quem chamasse a API direto cancelava um minuto antes e
 * recebia o coin de volta.
 *
 * **Agora** cancelar é sempre possível antes de a aula começar; o que muda é o
 * preço. Com folga, o coin volta. Em cima da hora, não volta — e o parceiro
 * recebe pelo lugar que segurou. Avisar tarde passa a ser melhor que não
 * avisar, para os dois lados.
 */
export { PRAZO_DE_CANCELAMENTO_H, horasAte };

export type CancellationCheck =
  | {
      allowed: true;
      /** `false` quer dizer: dá para cancelar, mas o coin não volta. */
      refunds: boolean;
      hoursLeft: number;
    }
  | {
      allowed: false;
      reason: 'already_started' | 'already_checked_in' | 'already_cancelled';
      hoursLeft: number;
    };

export function canCancel(booking: Booking, now: Date = new Date()): CancellationCheck {
  const hoursLeft = horasAte(booking.scheduledAt, now);

  if (booking.status === 'cancelled' || booking.status === 'no_show') {
    return { allowed: false, reason: 'already_cancelled', hoursLeft };
  }
  // Depois do check-in a vaga já foi usada: não há o que devolver.
  if (booking.status === 'checked_in' || booking.status === 'completed') {
    return { allowed: false, reason: 'already_checked_in', hoursLeft };
  }
  // Começada a aula não há mais o que desmarcar: ou a criança foi, e o
  // check-in resolve, ou não foi, e a reserva já é uma falta.
  if (hoursLeft <= 0) {
    return { allowed: false, reason: 'already_started', hoursLeft };
  }

  return {
    allowed: true,
    refunds: desfechoDoCancelamento(booking.scheduledAt, now) === 'devolve',
    hoursLeft,
  };
}

export function cancellationMessage(check: CancellationCheck): string {
  if (check.allowed) return '';
  switch (check.reason) {
    case 'already_cancelled':
      return 'Esta reserva já foi desmarcada.';
    case 'already_checked_in':
      return 'O check-in já foi feito, então não dá mais para cancelar.';
    case 'already_started':
      return 'Esta aula já começou.';
  }
}

/**
 * O que dizer antes de confirmar o cancelamento.
 *
 * A frase muda com o desfecho porque o desfecho muda: prometer "os coins
 * voltam" em cima da hora seria mentir na única tela em que a pessoa ainda
 * pode desistir de desistir.
 */
export function cancellationWarning(check: CancellationCheck): string {
  if (!check.allowed) return cancellationMessage(check);
  if (check.refunds) {
    return 'Os Kidoo Coins voltam para a sua conta. As moedas bônus voltam com a validade original.';
  }
  return (
    `Faltam menos de ${PRAZO_DE_CANCELAMENTO_H} horas para a aula, então os coins não voltam — ` +
    'o lugar já foi segurado para você. Ainda assim vale desmarcar: o professor fica sabendo que ' +
    'a vaga não será usada.'
  );
}

/** "em 3 horas" / "em 2 dias" — usado no aviso de prazo. */
export function formatDeadline(scheduledAt: string, now: Date = new Date()): string {
  const hours = horasAte(scheduledAt, now) - PRAZO_DE_CANCELAMENTO_H;
  if (hours <= 0) return 'o prazo para cancelar sem perder os coins já passou';
  if (hours < 1) return 'você tem menos de 1 hora para cancelar sem perder os coins';
  if (hours < 24) {
    const rounded = Math.floor(hours);
    return `cancele em até ${rounded} ${rounded === 1 ? 'hora' : 'horas'} para não perder os coins`;
  }
  const days = Math.floor(hours / 24);
  return `cancele em até ${days} ${days === 1 ? 'dia' : 'dias'} para não perder os coins`;
}
