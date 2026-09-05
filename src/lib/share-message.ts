import type { BookingDetails } from '@/types/domain';

export type ShareContext = {
  booking: BookingDetails;
  xpEarned: number;
  levelUp: { to: number; bonusEarned: number } | null;
};

/**
 * Mensagem do compartilhamento.
 *
 * Cita só o primeiro nome da criança e a atividade — nunca sobrenome, idade,
 * local ou horário. Isso importa: o texto vai para grupos e redes, e horário
 * somado a local diria a estranhos onde a criança está.
 */
export function buildShareMessage(data: ShareContext): string {
  const firstName = data.booking.child.name.split(' ')[0] ?? data.booking.child.name;
  const activity = data.booking.activity.title;

  if (data.levelUp) {
    const coins =
      data.levelUp.bonusEarned === 1 ? '1 moeda bônus' : `${data.levelUp.bonusEarned} moedas bônus`;
    return (
      `${firstName} subiu para o nível ${data.levelUp.to} no Kidoo! 🎉\n` +
      `Mais uma aula de ${activity} concluída, +${data.xpEarned} XP e ${coins} na conta.\n\n` +
      `Kidoo — descubra, brinque, movimente-se.`
    );
  }

  return (
    `${firstName} concluiu mais uma aula de ${activity} no Kidoo! 🎉\n` +
    `+${data.xpEarned} XP na jornada dele.\n\n` +
    `Kidoo — descubra, brinque, movimente-se.`
  );
}
