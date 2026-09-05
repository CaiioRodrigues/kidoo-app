import type { RatingSummary, Review } from '@/types/domain';

/**
 * Comentários fictícios. Nomes são só o primeiro nome de quem avalia — nunca
 * o nome da criança nem sobrenome, que é como deve ficar em produção também.
 */
type Seed = {
  activityId: string;
  authorName: string;
  rating: number;
  comment: string;
  daysAgo: number;
  helpfulCount: number;
};

const SEEDS: Seed[] = [
  {
    activityId: 'a-futebol-kids',
    authorName: 'Marina',
    rating: 5,
    comment:
      'Meu filho contava os dias para a aula. Os professores têm uma paciência enorme com os menores e ninguém fica de fora da brincadeira.',
    daysAgo: 4,
    helpfulCount: 12,
  },
  {
    activityId: 'a-futebol-kids',
    authorName: 'Rodrigo',
    rating: 5,
    comment: 'Estrutura muito boa e turma pequena. Dá para ver a evolução em poucas semanas.',
    daysAgo: 11,
    helpfulCount: 7,
  },
  {
    activityId: 'a-futebol-kids',
    authorName: 'Juliana',
    rating: 4,
    comment:
      'Adoramos a aula. Só acho que poderia ter mais um horário no fim da tarde, o das 17h lota rápido.',
    daysAgo: 19,
    helpfulCount: 5,
  },
  {
    activityId: 'a-futebol-kids',
    authorName: 'Thiago',
    rating: 5,
    comment:
      'Ambiente familiar, sem aquela pressão de competição. Era exatamente o que buscávamos.',
    daysAgo: 27,
    helpfulCount: 3,
  },
  {
    activityId: 'a-natacao-infantil',
    authorName: 'Camila',
    rating: 5,
    comment:
      'A professora tem um jeito ótimo com crianças que têm medo de água. Minha filha entrou chorando na primeira aula e hoje não quer sair da piscina.',
    daysAgo: 6,
    helpfulCount: 15,
  },
  {
    activityId: 'a-natacao-infantil',
    authorName: 'Bruno',
    rating: 4,
    comment: 'Piscina sempre limpa e aquecida. O vestiário poderia ser um pouco maior.',
    daysAgo: 14,
    helpfulCount: 4,
  },
  {
    activityId: 'a-natacao-infantil',
    authorName: 'Patrícia',
    rating: 5,
    comment: 'Turmas realmente pequenas, com no máximo seis crianças. Faz toda a diferença.',
    daysAgo: 22,
    helpfulCount: 9,
  },
  {
    activityId: 'a-judo-kids',
    authorName: 'Fernanda',
    rating: 5,
    comment:
      'Além do esporte, trabalham muito respeito e disciplina. Percebi diferença até em casa.',
    daysAgo: 8,
    helpfulCount: 11,
  },
  {
    activityId: 'a-judo-kids',
    authorName: 'Leonardo',
    rating: 4,
    comment: 'Sensei muito atencioso. O tatame é um pouco antigo, mas está bem conservado.',
    daysAgo: 17,
    helpfulCount: 2,
  },
  {
    activityId: 'a-ballet-infantil',
    authorName: 'Aline',
    rating: 5,
    comment: 'A apresentação de fim de ano foi um encanto. Minha filha ganhou muita confiança.',
    daysAgo: 9,
    helpfulCount: 8,
  },
  {
    activityId: 'a-ballet-infantil',
    authorName: 'Renata',
    rating: 4,
    comment: 'Ótimas aulas. A sala é pequena quando a turma está cheia.',
    daysAgo: 21,
    helpfulCount: 3,
  },
  {
    activityId: 'a-ginastica-artistica',
    authorName: 'Gustavo',
    rating: 5,
    comment: 'Equipamento completo e professores atentos à segurança o tempo todo.',
    daysAgo: 5,
    helpfulCount: 6,
  },
  {
    activityId: 'a-ginastica-artistica',
    authorName: 'Larissa',
    rating: 5,
    comment: 'Minha filha ganhou uma consciência corporal impressionante em um semestre.',
    daysAgo: 16,
    helpfulCount: 4,
  },
  {
    activityId: 'a-artes-pequenos',
    authorName: 'Vanessa',
    rating: 5,
    comment:
      'Material todo incluso e atóxico, o que me deixou tranquila. Ela volta suja de tinta e feliz.',
    daysAgo: 3,
    helpfulCount: 14,
  },
  {
    activityId: 'a-artes-pequenos',
    authorName: 'Diego',
    rating: 4,
    comment: 'Proposta muito livre, sem cobrança de resultado. Meu filho adora.',
    daysAgo: 12,
    helpfulCount: 5,
  },
  {
    activityId: 'a-basquete-kids',
    authorName: 'Priscila',
    rating: 5,
    comment:
      'Cesta na altura certa faz toda diferença — ele acertou o primeiro arremesso e vibrou.',
    daysAgo: 7,
    helpfulCount: 6,
  },
  {
    activityId: 'a-tenis-mirim',
    authorName: 'Marcelo',
    rating: 4,
    comment: 'Raquete adaptada inclusa, ótimo para começar sem investir de cara.',
    daysAgo: 13,
    helpfulCount: 3,
  },
  {
    activityId: 'a-volei-kids',
    authorName: 'Sabrina',
    rating: 5,
    comment: 'Turma animada e professora que valoriza o trabalho em equipe acima do placar.',
    daysAgo: 10,
    helpfulCount: 7,
  },
];

export const REVIEWS: Review[] = SEEDS.map((seed, index) => {
  const createdAt = new Date();
  createdAt.setDate(createdAt.getDate() - seed.daysAgo);
  return {
    id: `r-${index + 1}`,
    activityId: seed.activityId,
    authorName: seed.authorName,
    rating: seed.rating,
    comment: seed.comment,
    createdAt: createdAt.toISOString(),
    helpfulCount: seed.helpfulCount,
  };
});

/**
 * Resume as notas de uma atividade. Quando ainda não há comentários,
 * cai para a nota do catálogo, para o card não mostrar "0,0 estrelas".
 */
export function summarize(
  reviews: Review[],
  fallback: { rating: number; reviewCount: number },
): RatingSummary {
  const distribution: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

  for (const review of reviews) {
    const key = Math.min(5, Math.max(1, Math.round(review.rating))) as 1 | 2 | 3 | 4 | 5;
    distribution[key] += 1;
  }

  if (reviews.length === 0) {
    return { average: fallback.rating, total: fallback.reviewCount, distribution };
  }

  const sum = reviews.reduce((acc, review) => acc + review.rating, 0);
  return {
    average: Math.round((sum / reviews.length) * 10) / 10,
    // O catálogo tem mais avaliações do que os comentários que exibimos.
    total: Math.max(fallback.reviewCount, reviews.length),
    distribution,
  };
}
