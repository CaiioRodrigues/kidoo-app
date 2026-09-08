/**
 * As datas de uma turma que se repete.
 *
 * Fica fora do `api/` de propósito: **quem calcula as datas é o navegador do
 * parceiro**, não o banco. "Toda terça às 18h" quer dizer 18h no relógio de
 * quem está em Belo Horizonte, e reproduzir isso no servidor exigiria carregar
 * o fuso de cada parceiro e o horário de verão de cada país. O navegador dele
 * já sabe. O banco recebe instantes prontos.
 *
 * É também o único trecho do painel que dá para testar sem tela e sem banco —
 * e é o trecho onde um erro de um dia passa despercebido na revisão.
 */

export type Recorrencia = {
  /** 0 = domingo … 6 = sábado, como `Date#getDay`. */
  diasDaSemana: number[];
  /** "18:00", no relógio do balcão. */
  hora: string;
  /** Por quantas semanas a partir de hoje. */
  semanas: number;
};

/**
 * O mesmo teto que `publish_sessions` aplica no banco.
 *
 * Existe aqui para a tela avisar antes de mandar, mas quem garante é o banco:
 * validação de tela é conveniência, não regra.
 */
export const LIMITE_DA_SERIE = 60;

export const DIAS_CURTOS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

/**
 * As datas futuras da série, em ordem.
 *
 * A janela é de `semanas * 7` dias corridos a partir de hoje, e não "as
 * próximas N terças": em 56 dias corridos cada dia da semana cai exatamente 8
 * vezes, então contar dias dá o mesmo resultado sem laço aberto.
 *
 * Datas que já passaram ficam de fora aqui — publicar "as próximas 8 semanas"
 * numa quinta à noite não deve tentar publicar a quinta de hoje. O banco
 * recusa de novo, porque a tela pode estar aberta há horas.
 */
export function datasDaSerie(r: Recorrencia, agora = new Date()): Date[] {
  const [h, m] = r.hora.split(':').map(Number);
  if (h === undefined || m === undefined || Number.isNaN(h) || Number.isNaN(m)) return [];
  if (r.semanas <= 0 || r.diasDaSemana.length === 0) return [];

  const dias = new Set(r.diasDaSemana);
  const datas: Date[] = [];

  // Anda de meia-noite em meia-noite e só então põe a hora. Somar 24h ao
  // horário da aula erraria o dia na virada do horário de verão — e o Brasil
  // já teve, e pode ter de novo.
  const cursor = new Date(agora);
  cursor.setHours(0, 0, 0, 0);

  for (let i = 0; i < r.semanas * 7; i += 1) {
    const dia = new Date(cursor);
    dia.setDate(dia.getDate() + i);
    if (!dias.has(dia.getDay())) continue;
    dia.setHours(h, m, 0, 0);
    if (dia.getTime() <= agora.getTime()) continue;
    datas.push(dia);
  }

  return datas;
}

/** "ter, 10/03 · qui, 12/03 · …" — as três primeiras, para conferir de relance. */
export function resumoDaSerie(datas: Date[], quantas = 3): string {
  const mostra = datas.slice(0, quantas).map((d) => {
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${DIAS_CURTOS[d.getDay()]}, ${dd}/${mm}`;
  });
  const resto = datas.length - mostra.length;
  return resto > 0 ? `${mostra.join(' · ')} · +${resto}` : mostra.join(' · ');
}
