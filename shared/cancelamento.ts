/**
 * O prazo de cancelamento, e o que acontece de cada lado dele.
 *
 * Vive em `shared/` porque o app e o painel precisam da mesma resposta, e
 * porque o número tem de bater com o do banco — `cancel_booking` aplica o mesmo
 * corte, e é ele que decide de verdade. Duas cópias que discordam produzem o
 * pior sintoma possível: a tela promete devolver o coin, o servidor não
 * devolve, e ninguém sabe qual dos dois está errado.
 *
 * `scripts/testar-prazo.ts` confere que o número daqui é o número do SQL.
 */

/**
 * Cinco horas.
 *
 * Antes eram seis, e o prazo não existia no servidor — só na tela. Quem
 * chamasse a API direto cancelava um minuto antes da aula e recebia o coin de
 * volta.
 *
 * O número é o tempo que o parceiro tem para recolocar alguém no lugar: manhã
 * de aula à tarde, tarde de aula à noite. Menos que isso a vaga morre.
 */
export const PRAZO_DE_CANCELAMENTO_H = 5;

/** O que acontece com o coin e com o repasse, dado quando se cancela. */
export type Desfecho =
  /** Antes do prazo: o coin volta, o parceiro não recebe, a vaga é liberada. */
  | 'devolve'
  /**
   * Dentro do prazo, ou não apareceu: o coin não volta e o parceiro recebe.
   *
   * O lugar foi segurado, o professor foi pago e a turma aconteceu. Quem
   * desmarca em cima da hora paga pelo que ocupou — e o parceiro recebe pelo
   * que reservou, tenha a criança ido ou não.
   */
  | 'cobra';

export function horasAte(quando: string, agora: Date = new Date()): number {
  return (Date.parse(quando) - agora.getTime()) / (1000 * 60 * 60);
}

/**
 * O desfecho de cancelar esta reserva agora.
 *
 * Note que **cancelar é sempre possível** antes da aula começar, e isso é
 * deliberado: antes, passar do prazo travava o botão, e a família que não ia
 * poder ir simplesmente não avisava ninguém. Avisar tarde é melhor que não
 * avisar — o parceiro fica sabendo, e é o que ele pode fazer com a informação
 * que decide o dia dele.
 */
export function desfechoDoCancelamento(scheduledAt: string, agora: Date = new Date()): Desfecho {
  return horasAte(scheduledAt, agora) >= PRAZO_DE_CANCELAMENTO_H ? 'devolve' : 'cobra';
}
