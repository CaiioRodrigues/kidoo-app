import type { Activity, Child } from '@/types/domain';

/**
 * Como o Kidoo ordena sugestões para uma criança.
 *
 * Vive fora do mock porque a regra é de produto, não de backend: os dois
 * adapters têm de ordenar igual, senão a mesma família vê listas diferentes
 * conforme o ambiente — e a primeira suspeita recairia sobre o algoritmo, não
 * sobre a duplicação.
 *
 * A ordem é: faixa etária primeiro (com um ano de folga para cada lado, porque
 * turma infantil não é rígida), depois interesse declarado, depois distância.
 */
export function rankForChild(activities: Activity[], child: Child): Activity[] {
  const age = ageInYears(child.birthDate);

  return activities
    .filter((activity) => age >= activity.minAge - 1 && age <= activity.maxAge + 1)
    .sort((a, b) => {
      const aLiked = child.interests.includes(a.category) ? 1 : 0;
      const bLiked = child.interests.includes(b.category) ? 1 : 0;
      if (aLiked !== bLiked) return bLiked - aLiked;
      // Sem origem conhecida ninguém "vence" no desempate por distância.
      return (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity);
    });
}

export function ageInYears(birthDate: string, now: Date = new Date()): number {
  const birth = new Date(birthDate);
  let age = now.getFullYear() - birth.getFullYear();
  const monthDelta = now.getMonth() - birth.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < birth.getDate())) age -= 1;
  return age;
}
