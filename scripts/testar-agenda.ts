/**
 * Confere a agenda por dia sem precisar abrir o app.
 *
 * Roda com `npm run test:agenda`. Existe porque o erro mais provável aqui é
 * silencioso: uma aula das 22h30 caindo no dia seguinte por causa do fuso é
 * algo que ninguém percebe olhando a tela em horário comercial.
 */
import {
  buildSchedule,
  dayKey,
  firstDayWithSessions,
  longDayLabel,
  nextDayWithSessions,
  shortDayLabel,
} from '@/lib/schedule';
import type { ClassSession } from '@/types/domain';

const falhas: string[] = [];
const ok = (cond: boolean, msg: string) => {
  console.log((cond ? '  OK   ' : '  FALHA ') + msg);
  if (!cond) falhas.push(msg);
};

const turma = (iso: string, id = iso): ClassSession => ({
  id, activityId: 'a', startsAt: iso, capacity: 20, enrolled: 10,
  slotsOpen: 5, slotsTaken: 0, kind: 'ociosa', coinCost: 2,
});

// Terça, 8 de setembro de 2026, 10h da manhã, horário local.
const agora = new Date(2026, 8, 8, 10, 0, 0);

const sessions = [
  turma(new Date(2026, 8, 8, 18, 0).toISOString(), 'hoje-18'),
  turma(new Date(2026, 8, 10, 9, 0).toISOString(), 'qui-09'),
  turma(new Date(2026, 8, 10, 14, 30).toISOString(), 'qui-1430'),
  turma(new Date(2026, 8, 13, 8, 0).toISOString(), 'dom-08'),
];

const agenda = buildSchedule(sessions, agora);
ok(agenda.length === 14, 'a tira tem 14 dias');
ok(agenda[0]!.key === dayKey(agora), 'começa hoje');
ok(agenda[0]!.sessions.length === 1, 'hoje tem 1 turma');
ok(agenda[1]!.sessions.length === 0, 'quarta é vazia');
ok(agenda[2]!.sessions.length === 2, 'quinta tem 2 turmas');
ok(agenda[2]!.sessions[0]!.id === 'qui-09', 'e vêm ordenadas pela hora');
ok(agenda[5]!.sessions.length === 1, 'domingo tem 1 turma');
ok(agenda.reduce((n, d) => n + d.sessions.length, 0) === 4, 'nenhuma turma se perdeu');

ok(firstDayWithSessions(agenda) === dayKey(agora), 'abre em hoje, que tem aula');
const semHoje = buildSchedule(sessions.slice(1), agora);
ok(firstDayWithSessions(semHoje) === agenda[2]!.key,
   'sem aula hoje, abre na quinta — nunca num dia vazio');
ok(firstDayWithSessions(buildSchedule([], agora)) === dayKey(agora),
   'semana toda vazia cai em hoje, sem quebrar');

ok(nextDayWithSessions(agenda, agenda[1]!.key)?.key === agenda[2]!.key,
   'do dia vazio, a próxima é a quinta');
ok(nextDayWithSessions(agenda, agenda[5]!.key) === null,
   'depois da última turma não há próxima');

ok(shortDayLabel(agenda[0]!.date, agora) === 'Hoje', 'o primeiro chip diz Hoje');
ok(shortDayLabel(agenda[1]!.date, agora) === 'Amanhã', 'o segundo diz Amanhã');
ok(shortDayLabel(agenda[2]!.date, agora) === 'qui', 'o terceiro é o dia da semana, sem ponto');
ok(longDayLabel(agenda[2]!.date, agora) === 'Quinta, 10 de setembro',
   'o título do dia é por extenso, sem o "-feira"');
ok(longDayLabel(agenda[4]!.date, agora) === 'Sábado, 12 de setembro',
   'e sábado, que não tem sufixo, passa ileso');

// A armadilha do fuso: 22h em Brasília (UTC-3) já é o dia seguinte em UTC.
// Com `toISOString()` na chave, esta aula sumiria do dia em que acontece.
const noite = new Date(2026, 8, 9, 22, 30);
const comNoite = buildSchedule([turma(noite.toISOString(), 'noite')], agora);
ok(comNoite[1]!.sessions.length === 1, 'aula das 22h30 fica no dia dela, não no seguinte');
ok(comNoite[2]!.sessions.length === 0, 'e não vaza para o dia seguinte');

console.log(falhas.length ? `\n>>> ${falhas.length} FALHA(S)` : '\n>>> agenda ok');
process.exit(falhas.length ? 1 : 0);
