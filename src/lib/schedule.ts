import type { ClassSession } from '@/types/domain';

/**
 * A semana de uma atividade, dia a dia.
 *
 * A lista corrida de turmas funcionava com três horários e desmonta com trinta:
 * o parceiro publica por semana, e uma escolinha com aula toda terça e quinta
 * em três horários vira uma rolagem longa em que a família procura o dia certo
 * a olho. Aqui o dia vira o primeiro filtro, e a lista mostra só ele.
 */

/** Um dia da tira, com o que acontece nele. */
export type ScheduleDay = {
  /** `YYYY-MM-DD` no fuso do aparelho. É a chave de seleção. */
  key: string;
  date: Date;
  /** Turmas daquele dia, da mais cedo para a mais tarde. */
  sessions: ClassSession[];
};

/** Quantos dias a tira mostra. O parceiro publica por semana; duas dão folga. */
export const SCHEDULE_DAYS = 14;

/**
 * Chave local do dia.
 *
 * Montada a partir dos componentes locais e não de `toISOString()`: este
 * devolve UTC, e às 22h de Brasília a aula de hoje cairia no dia seguinte —
 * a turma sumiria do dia em que ela acontece.
 */
export function dayKey(date: Date): string {
  const mes = String(date.getMonth() + 1).padStart(2, '0');
  const dia = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${mes}-${dia}`;
}

/**
 * Os próximos `SCHEDULE_DAYS` dias, cada um com as suas turmas.
 *
 * Todos os dias entram, inclusive os vazios: é o buraco que ensina o ritmo da
 * turma ("essa é quarta e sábado"), e essa é uma informação que a família usa
 * para encaixar na rotina. Uma tira só com os dias que têm aula viraria uma
 * lista de datas soltas.
 */
export function buildSchedule(
  sessions: ClassSession[],
  now: Date = new Date(),
  days: number = SCHEDULE_DAYS,
): ScheduleDay[] {
  const porDia = new Map<string, ClassSession[]>();
  for (const session of sessions) {
    const quando = new Date(session.startsAt);
    if (Number.isNaN(quando.getTime())) continue;
    const chave = dayKey(quando);
    porDia.set(chave, [...(porDia.get(chave) ?? []), session]);
  }

  const inicio = new Date(now);
  inicio.setHours(0, 0, 0, 0);

  return Array.from({ length: days }, (_, i) => {
    const date = new Date(inicio);
    date.setDate(inicio.getDate() + i);
    const key = dayKey(date);
    const doDia = [...(porDia.get(key) ?? [])].sort(
      (a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt),
    );
    return { key, date, sessions: doDia };
  });
}

/**
 * Qual dia abrir.
 *
 * O primeiro com turma, e não necessariamente hoje: abrir num dia vazio daria
 * a primeira impressão de que a atividade não tem horário nenhum. Se a semana
 * inteira estiver vazia, cai em hoje — a tela sabe explicar isso.
 */
export function firstDayWithSessions(schedule: ScheduleDay[]): string {
  return (schedule.find((day) => day.sessions.length > 0) ?? schedule[0])?.key ?? '';
}

/** O próximo dia com turma depois de `key`. Null quando não há. */
export function nextDayWithSessions(schedule: ScheduleDay[], key: string): ScheduleDay | null {
  const atual = schedule.findIndex((day) => day.key === key);
  if (atual < 0) return null;
  return schedule.slice(atual + 1).find((day) => day.sessions.length > 0) ?? null;
}

/** "Hoje", "Amanhã" ou "qua" — o rótulo curto do chip. */
export function shortDayLabel(date: Date, now: Date = new Date()): string {
  if (dayKey(date) === dayKey(now)) return 'Hoje';
  const amanha = new Date(now);
  amanha.setDate(now.getDate() + 1);
  if (dayKey(date) === dayKey(amanha)) return 'Amanhã';
  // `toLocaleDateString` devolve "qua." com ponto; o chip é estreito demais
  // para carregar pontuação que não informa nada.
  return date.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
}

/** "Quinta, 10 de setembro" — o título acima da lista. */
export function longDayLabel(date: Date, now: Date = new Date()): string {
  const rotulo = date
    .toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
    // O pt-BR devolve "quinta-feira, 10 de setembro". Correto, e comprido
    // demais para um cabeçalho de celular — "-feira" não distingue nada que
    // "quinta" já não diga. Sábado e domingo não têm o sufixo e passam ilesos.
    .replace('-feira', '');
  const capitalizado = rotulo.charAt(0).toUpperCase() + rotulo.slice(1);
  if (dayKey(date) === dayKey(now)) return `Hoje · ${capitalizado}`;
  return capitalizado;
}

/** "às 09:00" — só a hora, já que o dia está no cabeçalho da lista. */
export function timeOnly(isoDateTime: string): string {
  const date = new Date(isoDateTime);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}
