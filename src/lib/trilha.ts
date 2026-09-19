import { ACHIEVEMENT_RULES } from './achievements';
import type { Achievement, ActivityCategoryId, AulaFeita } from '@/types/domain';

/**
 * A trilha: a jornada contada como sequência, e não como soma.
 *
 * A tela Jornada sempre respondeu "quanto" — total de aulas, quantas por
 * modalidade, quantas por semana. Nenhuma dessas respostas tem ordem, e a
 * ordem é justamente o que faz a coisa parecer uma jornada: a primeira aula, a
 * de natação no meio, a medalha que caiu na quinta.
 *
 * ## As medalhas ficam no passo certo, e isso não é chute
 *
 * `Achievement.unlockedAt` diz "agora" para tudo que está destravado — os dois
 * adapters passam a hora da consulta, porque a conquista é derivada do
 * histórico e não fica guardada em coluna nenhuma. Interpolar a trilha por
 * esse campo colocaria as doze medalhas em cima da última aula.
 *
 * Só que as regras são função pura de `(total, byCategory)`. Então dá para
 * percorrer o histórico em ordem, aplicando as mesmas regras da grade a cada
 * passo, e ver exatamente em qual aula cada uma passou de falsa para
 * verdadeira. Não é aproximação: é a mesma conta, feita com o histórico
 * parcial. E o `unlockedAt` que sai daqui é a data da aula que destravou — a
 * única data verdadeira que existe para essa conquista.
 *
 * Se uma regra nova entrar em `ACHIEVEMENT_RULES`, ela aparece na trilha
 * sozinha, no passo certo, sem ninguém lembrar de mexer aqui.
 */

export type PassoDaTrilha = {
  aula: AulaFeita;
  /** A posição na vida da criança: 1 é a primeira aula que ela fez. */
  numero: number;
  /**
   * As conquistas que ESTA aula destravou — quase sempre nenhuma, e é isso que
   * faz a que tem valer alguma coisa.
   */
  conquistas: Achievement[];
};

/**
 * Monta a trilha a partir das aulas feitas.
 *
 * Ordena por data antes de percorrer: a ordem é o insumo do cálculo, e uma
 * lista embaralhada daria a medalha à aula errada sem erro nenhum aparecer.
 */
export function montarTrilha(aulas: AulaFeita[]): PassoDaTrilha[] {
  const ordenadas = [...aulas].sort((a, b) => a.date.localeCompare(b.date));

  const byCategory = new Map<ActivityCategoryId, number>();
  let total = 0;
  const jaDestravadas = new Set<string>();

  return ordenadas.map((aula) => {
    total += 1;
    byCategory.set(aula.category, (byCategory.get(aula.category) ?? 0) + 1);

    const conquistas: Achievement[] = [];
    for (const rule of ACHIEVEMENT_RULES) {
      if (jaDestravadas.has(rule.id)) continue;
      if (!rule.isUnlocked({ total, byCategory })) continue;
      jaDestravadas.add(rule.id);
      conquistas.push({
        id: rule.id,
        label: rule.label,
        hint: rule.hint,
        icon: rule.icon,
        tone: rule.tone,
        unlockedAt: aula.date,
      });
    }

    return { aula, numero: total, conquistas };
  });
}

/**
 * O pedaço da trilha que cabe na tela.
 *
 * Devolve os últimos passos e quantos ficaram para trás. A Jornada é uma tela
 * rolável que já tem cabeçalho, nível, doze medalhas e dois blocos de
 * resumo — despejar cento e vinte aulas no meio dela enterraria tudo que vem
 * depois. Quem tem poucas aulas vê a trilha inteira, que é o caso de toda
 * família nos primeiros meses.
 */
export function ultimosPassos(
  passos: PassoDaTrilha[],
  quantos: number,
): { visiveis: PassoDaTrilha[]; anteriores: number } {
  if (passos.length <= quantos) return { visiveis: passos, anteriores: 0 };
  return {
    visiveis: passos.slice(passos.length - quantos),
    anteriores: passos.length - quantos,
  };
}
