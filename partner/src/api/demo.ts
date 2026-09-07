import { PainelError } from './types';
import type { ActivityRow, AgendaRow, PainelApi, Partner, RosterRow, StatementRow } from './types';
import type { SlotKind } from '@app/types/domain';

/**
 * Painel em memória.
 *
 * Existe pelo mesmo motivo que o backend simulado do app: dá para abrir o
 * painel, clicar em tudo e revisar as telas sem um Supabase no ar. E, como lá,
 * ele **repete as regras do banco** em vez de facilitar — a classificação da
 * vaga é derivada, o código de check-in é conferido, e reduzir vaga abaixo do
 * que já foi reservado é recusado. Um mock que aceita tudo esconde justamente
 * as telas de erro que alguém vai ver no balcão.
 */

const PARCEIRO: Partner = {
  id: 'p-arena',
  name: 'Academia Arena Kids',
  neighborhood: 'Buritis',
  city: 'Belo Horizonte',
  role: 'owner',
};

const ATIVIDADES: ActivityRow[] = [
  { id: 'a-futebol', title: 'Futebol Kids', category: 'futebol' },
  { id: 'a-judo', title: 'Judô para Pequenos', category: 'judo' },
  { id: 'a-ginastica', title: 'Ginástica Divertida', category: 'ginastica' },
];

/** A mesma regra do banco (`slot_kind_for`): a turma já acontece sozinha? */
function tipoDaVaga(matriculados: number): SlotKind {
  return matriculados >= 4 ? 'ociosa' : 'cheia';
}

type Turma = {
  sessionId: string;
  activityId: string;
  startsAt: string;
  capacity: number;
  enrolled: number;
  slotsOpen: number;
  coinCost: number;
};

type Reserva = {
  bookingId: string;
  sessionId: string;
  firstName: string;
  age: number;
  status: RosterRow['status'];
  checkedInAt: string | null;
  partnerConfirmedAt: string | null;
  /** Código que a família mostra. `null` = ainda não chegou. */
  codigo: string | null;
};

function hoje(hora: number, minuto = 0): string {
  const data = new Date();
  data.setHours(hora, minuto, 0, 0);
  return data.toISOString();
}

function emDias(dias: number, hora: number): string {
  const data = new Date();
  data.setDate(data.getDate() + dias);
  data.setHours(hora, 0, 0, 0);
  return data.toISOString();
}

const turmas: Turma[] = [
  { sessionId: 's1', activityId: 'a-futebol',   startsAt: hoje(9, 30),  capacity: 20, enrolled: 11, slotsOpen: 6, coinCost: 2 },
  { sessionId: 's2', activityId: 'a-judo',      startsAt: hoje(14, 0),  capacity: 12, enrolled: 8,  slotsOpen: 4, coinCost: 3 },
  { sessionId: 's3', activityId: 'a-ginastica', startsAt: hoje(17, 0),  capacity: 10, enrolled: 2,  slotsOpen: 5, coinCost: 3 },
  { sessionId: 's4', activityId: 'a-futebol',   startsAt: emDias(1, 9), capacity: 20, enrolled: 13, slotsOpen: 5, coinCost: 2 },
  { sessionId: 's5', activityId: 'a-judo',      startsAt: emDias(3, 14),capacity: 12, enrolled: 9,  slotsOpen: 3, coinCost: 3 },
];

const reservas: Reserva[] = [
  { bookingId: 'b1', sessionId: 's1', firstName: 'João',   age: 8, status: 'completed',  checkedInAt: hoje(9, 22), partnerConfirmedAt: hoje(9, 24), codigo: null },
  { bookingId: 'b2', sessionId: 's1', firstName: 'Alice',  age: 7, status: 'checked_in', checkedInAt: hoje(9, 25), partnerConfirmedAt: null, codigo: '481902' },
  { bookingId: 'b3', sessionId: 's1', firstName: 'Miguel', age: 9, status: 'checked_in', checkedInAt: hoje(9, 26), partnerConfirmedAt: null, codigo: '730514' },
  { bookingId: 'b4', sessionId: 's1', firstName: 'Cecília',age: 8, status: 'confirmed',  checkedInAt: null, partnerConfirmedAt: null, codigo: null },
  { bookingId: 'b5', sessionId: 's2', firstName: 'Théo',   age: 6, status: 'checked_in', checkedInAt: hoje(13, 51), partnerConfirmedAt: null, codigo: '206348' },
  { bookingId: 'b6', sessionId: 's2', firstName: 'Laura',  age: 7, status: 'confirmed',  checkedInAt: null, partnerConfirmedAt: null, codigo: null },
  { bookingId: 'b7', sessionId: 's3', firstName: 'Bento',  age: 5, status: 'confirmed',  checkedInAt: null, partnerConfirmedAt: null, codigo: null },
  { bookingId: 'b8', sessionId: 's4', firstName: 'Helena', age: 9, status: 'confirmed',  checkedInAt: null, partnerConfirmedAt: null, codigo: null },
];

/** Meses anteriores já fechados, para o extrato não abrir vazio. */
const HISTORICO: StatementRow[] = [
  { month: mesAtras(1), kind: 'ociosa', checkIns: 96, rateCents: 800, totalCents: 76800 },
  { month: mesAtras(1), kind: 'cheia',  checkIns: 21, rateCents: 1800, totalCents: 37800 },
  { month: mesAtras(2), kind: 'ociosa', checkIns: 71, rateCents: 800, totalCents: 56800 },
  { month: mesAtras(2), kind: 'cheia',  checkIns: 18, rateCents: 1800, totalCents: 32400 },
];

function mesAtras(n: number): string {
  const data = new Date();
  data.setDate(1);
  data.setHours(0, 0, 0, 0);
  data.setMonth(data.getMonth() - n);
  return data.toISOString();
}

let logado = false;
const espera = <T>(valor: T, ms = 220): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(valor), ms));

function reservasDe(sessionId: string): Reserva[] {
  return reservas.filter((r) => r.sessionId === sessionId && r.status !== 'cancelled');
}

export const demoApi: PainelApi = {
  async entrar(email, senha) {
    if (!email.includes('@') || senha.length < 4) {
      throw new PainelError('E-mail ou senha incorretos.');
    }
    logado = true;
    await espera(null, 400);
  },

  async sair() {
    logado = false;
    await espera(null, 100);
  },

  async sessaoAtiva() {
    return espera(logado, 60);
  },

  async meuParceiro() {
    return espera(PARCEIRO);
  },

  async agenda(de, ate) {
    const linhas: AgendaRow[] = turmas
      .filter((t) => {
        const quando = Date.parse(t.startsAt);
        return quando >= de.getTime() && quando < ate.getTime();
      })
      .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))
      .map((t) => {
        const daTurma = reservasDe(t.sessionId);
        return {
          sessionId: t.sessionId,
          activityId: t.activityId,
          activityTitle: ATIVIDADES.find((a) => a.id === t.activityId)?.title ?? 'Turma',
          category: ATIVIDADES.find((a) => a.id === t.activityId)?.category ?? 'futebol',
          startsAt: t.startsAt,
          capacity: t.capacity,
          enrolled: t.enrolled,
          slotsOpen: t.slotsOpen,
          slotsTaken: daTurma.length,
          kind: tipoDaVaga(t.enrolled),
          coinCost: t.coinCost,
          checkedIn: daTurma.filter((r) => r.status !== 'confirmed').length,
          confirmed: daTurma.filter((r) => r.partnerConfirmedAt !== null).length,
        };
      });
    return espera(linhas);
  },

  async listaDaTurma(sessionId) {
    const linhas: RosterRow[] = reservasDe(sessionId).map((r) => ({
      bookingId: r.bookingId,
      firstName: r.firstName,
      age: r.age,
      status: r.status,
      checkedInAt: r.checkedInAt,
      partnerConfirmedAt: r.partnerConfirmedAt,
      slotKind: tipoDaVaga(turmas.find((t) => t.sessionId === sessionId)?.enrolled ?? 0),
      hasCode: r.codigo !== null,
    }));
    return espera(linhas);
  },

  async confirmarPresenca(bookingId, codigo) {
    const reserva = reservas.find((r) => r.bookingId === bookingId);
    if (!reserva) throw new PainelError('Reserva não encontrada.');
    if (!reserva.codigo) throw new PainelError('Esta família ainda não fez o check-in no aplicativo.');
    if (reserva.codigo !== codigo.replace(/\D/g, '')) {
      throw new PainelError('Código inválido para esta reserva.');
    }

    await espera(null, 320);
    reserva.partnerConfirmedAt = new Date().toISOString();
    reserva.status = 'completed';
    // O código morre ao ser usado: não vale para uma segunda aula.
    reserva.codigo = null;
  },

  async definirVagas(sessionId, vagas) {
    const turma = turmas.find((t) => t.sessionId === sessionId);
    if (!turma) throw new PainelError('Turma não encontrada.');
    if (vagas < 0) throw new PainelError('O número de vagas não pode ser negativo.');
    if (vagas < reservasDe(sessionId).length) {
      throw new PainelError('Já há reservas nestas vagas. Reduza só até o número que já foi reservado.');
    }
    if (turma.enrolled + vagas > turma.capacity) {
      throw new PainelError('A soma de matriculados e vagas abertas passa da capacidade da turma.');
    }
    await espera(null, 280);
    turma.slotsOpen = vagas;
  },

  async publicarTurma(entrada) {
    if (Date.parse(entrada.startsAt) <= Date.now()) {
      throw new PainelError('Não dá para publicar uma turma que já começou.');
    }
    if (entrada.enrolled + entrada.slotsOpen > entrada.capacity) {
      throw new PainelError('A soma de matriculados e vagas abertas passa da capacidade da turma.');
    }
    if (entrada.coinCost < 1 || entrada.coinCost > 6) {
      throw new PainelError('O custo em coins precisa ficar entre 1 e 6.');
    }
    await espera(null, 380);
    turmas.push({
      sessionId: `s${turmas.length + 1}`,
      activityId: entrada.activityId,
      startsAt: new Date(entrada.startsAt).toISOString(),
      capacity: entrada.capacity,
      enrolled: entrada.enrolled,
      slotsOpen: entrada.slotsOpen,
      coinCost: entrada.coinCost,
    });
  },

  async minhasAtividades() {
    return espera(ATIVIDADES);
  },

  async extrato() {
    const confirmadasNoMes = reservas.filter((r) => r.partnerConfirmedAt !== null);
    const porTipo = (kind: SlotKind, rate: number): StatementRow | null => {
      const total = confirmadasNoMes.filter(
        (r) => tipoDaVaga(turmas.find((t) => t.sessionId === r.sessionId)?.enrolled ?? 0) === kind,
      ).length;
      return total === 0 ? null : { month: mesAtras(0), kind, checkIns: total, rateCents: rate, totalCents: total * rate };
    };

    const doMes = [porTipo('ociosa', 800), porTipo('cheia', 1800)].filter(
      (linha): linha is StatementRow => linha !== null,
    );
    return espera([...doMes, ...HISTORICO]);
  },
};
