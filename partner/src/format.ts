import { format, isSameDay, isToday, isTomorrow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export function reais(centavos: number): string {
  return moeda.format(centavos / 100);
}

export function hora(iso: string): string {
  return format(new Date(iso), 'HH:mm');
}

/** "Hoje, 17:00" / "Amanhã, 09:30" / "Sáb, 24/08, 10:00" */
export function quando(iso: string): string {
  const data = new Date(iso);
  if (isToday(data)) return `Hoje, ${format(data, 'HH:mm')}`;
  if (isTomorrow(data)) return `Amanhã, ${format(data, 'HH:mm')}`;
  return comMaiuscula(format(data, "EEE',' dd/MM',' HH:mm", { locale: ptBR }));
}

/**
 * Primeira letra maiúscula, e só ela.
 *
 * O CSS `text-transform: capitalize` maiusculiza toda palavra, e o português
 * fica errado: "6 De Setembro", "Setembro De 2026".
 */
function comMaiuscula(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export function diaLongo(data: Date): string {
  return comMaiuscula(format(data, "EEEE, d 'de' MMMM", { locale: ptBR }));
}

export function mes(iso: string): string {
  return comMaiuscula(format(new Date(iso), "MMMM 'de' yyyy", { locale: ptBR }));
}

export function mesmoDia(iso: string, data: Date): boolean {
  return isSameDay(new Date(iso), data);
}

export function ehHoje(data: Date): boolean {
  return isToday(data);
}

/** "seg", "ter" — o rótulo da coluna na grade da semana. */
export function diaCurto(data: Date): string {
  return comMaiuscula(format(data, 'EEEEEE', { locale: ptBR }));
}

/**
 * "9 a 15 de março", "30 de março a 5 de abril".
 *
 * Repetir o mês nos dois lados quando ele é o mesmo ("9 de março a 15 de
 * março") faz o cabeçalho ficar mais longo que o conteúdo da coluna.
 */
export function faixaDaSemana(inicio: Date, fim: Date): string {
  const ate = format(fim, "d 'de' MMMM", { locale: ptBR });
  if (inicio.getMonth() === fim.getMonth()) return `${format(inicio, 'd')} a ${ate}`;
  return `${format(inicio, "d 'de' MMMM", { locale: ptBR })} a ${ate}`;
}

/** Valor para um `<input type="datetime-local">`, que não aceita ISO com fuso. */
export function paraCampoLocal(data: Date): string {
  return format(data, "yyyy-MM-dd'T'HH:mm");
}
