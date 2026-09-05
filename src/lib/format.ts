import { ageFromBirthDate } from './validation';

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export function formatPrice(cents: number): string {
  return currency.format(cents / 100);
}

export function formatAge(birthDate: string): string {
  const age = ageFromBirthDate(birthDate);
  return age === 1 ? '1 ano' : `${age} anos`;
}

export function formatDistance(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1).replace('.', ',')} km`;
}

/** "Hoje às 17:00" / "Sáb, 24/08 às 10:00" — usado nos cards de atividade. */
export function formatSessionTime(isoDateTime: string, now: Date = new Date()): string {
  const date = new Date(isoDateTime);
  if (Number.isNaN(date.getTime())) return '';

  const time = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) return `Hoje às ${time}`;

  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  if (date.toDateString() === tomorrow.toDateString()) return `Amanhã às ${time}`;

  const label = date.toLocaleDateString('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
  });
  return `${label} às ${time}`;
}

/** Aplica a máscara DD/MM/AAAA enquanto o usuário digita. */
export function maskBirthDate(input: string): string {
  const digits = input.replace(/\D/g, '').slice(0, 8);
  const day = digits.slice(0, 2);
  const month = digits.slice(2, 4);
  const year = digits.slice(4, 8);
  return [day, month, year].filter(Boolean).join('/');
}

/** DD/MM/AAAA -> AAAA-MM-DD. Retorna null quando ainda está incompleto. */
export function brDateToIso(masked: string): string | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(masked);
  if (!match) return null;
  const [, day, month, year] = match;
  return `${year}-${month}-${day}`;
}

/** AAAA-MM-DD -> DD/MM/AAAA. */
export function isoDateToBr(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return '';
  const [, year, month, day] = match;
  return `${day}/${month}/${year}`;
}
