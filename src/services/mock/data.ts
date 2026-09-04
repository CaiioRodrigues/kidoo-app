import type { Activity, ActivityCategory, Partner, Plan } from '@/types/domain';

export const CATEGORIES: ActivityCategory[] = [
  { id: 'futebol', label: 'Futebol', emoji: '⚽' },
  { id: 'natacao', label: 'Natação', emoji: '🏊' },
  { id: 'judo', label: 'Judô', emoji: '🥋' },
  { id: 'danca', label: 'Dança', emoji: '🩰' },
  { id: 'ginastica', label: 'Ginástica', emoji: '🤸' },
  { id: 'tenis', label: 'Tênis', emoji: '🎾' },
  { id: 'basquete', label: 'Basquete', emoji: '🏀' },
  { id: 'volei', label: 'Vôlei', emoji: '🏐' },
  { id: 'artes', label: 'Artes', emoji: '🎨' },
];

export const PLANS: Plan[] = [
  {
    id: 'start',
    name: 'Start',
    priceCents: 7990,
    coins: 6,
    tagline: 'Ideal para começar',
    highlighted: false,
    perks: ['6 Kidoo Coins por mês', 'Acesso a todos os parceiros', 'Cancelamento fácil'],
  },
  {
    id: 'plus',
    name: 'Plus',
    priceCents: 10990,
    coins: 10,
    tagline: 'Mais atividades e variedade',
    highlighted: true,
    perks: [
      '10 Kidoo Coins por mês',
      'Acesso a todos os parceiros',
      'Cancelamento fácil',
      'Suporte especializado',
    ],
  },
  {
    id: 'max',
    name: 'Max',
    priceCents: 14990,
    coins: 15,
    tagline: 'Para famílias que amam explorar',
    highlighted: false,
    perks: [
      '15 Kidoo Coins por mês',
      'Acesso a todos os parceiros',
      'Cancelamento fácil',
      'Suporte especializado',
      'Prioridade em turmas concorridas',
    ],
  },
];

const PARTNERS: Record<string, Partner> = {
  arena: {
    id: 'p-arena',
    name: 'Academia Arena Kids',
    neighborhood: 'Buritis',
    city: 'Belo Horizonte',
    verified: true,
  },
  pampulha: {
    id: 'p-pampulha',
    name: 'Clube Pampulha',
    neighborhood: 'Pampulha',
    city: 'Belo Horizonte',
    verified: true,
  },
  savassi: {
    id: 'p-savassi',
    name: 'Dojo Savassi',
    neighborhood: 'Savassi',
    city: 'Belo Horizonte',
    verified: true,
  },
  funcionarios: {
    id: 'p-funcionarios',
    name: 'Studio Bailar',
    neighborhood: 'Funcionários',
    city: 'Belo Horizonte',
    verified: false,
  },
};

/** Horário fixo do dia corrente, para o mock não "envelhecer" entre execuções. */
function todayAt(hour: number, dayOffset = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + dayOffset);
  date.setHours(hour, 0, 0, 0);
  return date.toISOString();
}

const IMAGES = {
  futebol: 'https://images.unsplash.com/photo-1517649763962-0c623066013b?w=800&q=70',
  natacao: 'https://images.unsplash.com/photo-1600965962361-9035dbfd1c50?w=800&q=70',
  judo: 'https://images.unsplash.com/photo-1555597673-b21d5c935865?w=800&q=70',
  danca: 'https://images.unsplash.com/photo-1518834107812-67b0b7c58434?w=800&q=70',
  ginastica: 'https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?w=800&q=70',
  tenis: 'https://images.unsplash.com/photo-1554068865-24cecd4e34b8?w=800&q=70',
} as const;

export const ACTIVITIES: Activity[] = [
  {
    id: 'a-futebol-kids',
    title: 'Futebol Kids',
    category: 'futebol',
    partner: PARTNERS.arena!,
    imageUrl: IMAGES.futebol,
    rating: 4.9,
    reviewCount: 127,
    minAge: 6,
    maxAge: 9,
    distanceKm: 2.3,
    coinCost: 10,
    nextSessionAt: todayAt(17),
    description:
      'Aulas recreativas de futebol focadas em movimento, coordenação, socialização e diversão. Aqui a criança aprende brincando!',
    tags: ['Turma mista', 'Aulas recreativas'],
  },
  {
    id: 'a-natacao-infantil',
    title: 'Natação Infantil',
    category: 'natacao',
    partner: PARTNERS.pampulha!,
    imageUrl: IMAGES.natacao,
    rating: 4.8,
    reviewCount: 94,
    minAge: 5,
    maxAge: 10,
    distanceKm: 3.1,
    coinCost: 10,
    nextSessionAt: todayAt(9, 1),
    description:
      'Adaptação ao meio líquido e primeiros nados, com turmas pequenas e professores especializados em educação infantil.',
    tags: ['Turmas pequenas', 'Piscina aquecida'],
  },
  {
    id: 'a-judo-kids',
    title: 'Judô Kids',
    category: 'judo',
    partner: PARTNERS.savassi!,
    imageUrl: IMAGES.judo,
    rating: 4.9,
    reviewCount: 61,
    minAge: 6,
    maxAge: 12,
    distanceKm: 2.4,
    coinCost: 10,
    nextSessionAt: todayAt(18, 1),
    description:
      'Judô infantil com foco em disciplina, respeito e coordenação motora, em ambiente acolhedor e seguro.',
    tags: ['Disciplina', 'Faixas oficiais'],
  },
  {
    id: 'a-ballet-infantil',
    title: 'Ballet Infantil',
    category: 'danca',
    partner: PARTNERS.funcionarios!,
    imageUrl: IMAGES.danca,
    rating: 4.7,
    reviewCount: 48,
    minAge: 4,
    maxAge: 8,
    distanceKm: 4.2,
    coinCost: 10,
    nextSessionAt: todayAt(15, 2),
    description:
      'Primeiros passos no ballet clássico, trabalhando postura, ritmo e expressão corporal de forma lúdica.',
    tags: ['Lúdico', 'Apresentação anual'],
  },
  {
    id: 'a-ginastica-artistica',
    title: 'Ginástica Artística',
    category: 'ginastica',
    partner: PARTNERS.arena!,
    imageUrl: IMAGES.ginastica,
    rating: 4.8,
    reviewCount: 73,
    minAge: 6,
    maxAge: 12,
    distanceKm: 2.1,
    coinCost: 15,
    nextSessionAt: todayAt(16, 2),
    description:
      'Solo, trave e paralelas em nível iniciante, com foco em força, flexibilidade e consciência corporal.',
    tags: ['Equipamento completo', 'Turma iniciante'],
  },
  {
    id: 'a-tenis-mirim',
    title: 'Tênis Mirim',
    category: 'tenis',
    partner: PARTNERS.pampulha!,
    imageUrl: IMAGES.tenis,
    rating: 4.6,
    reviewCount: 35,
    minAge: 7,
    maxAge: 12,
    distanceKm: 3.4,
    coinCost: 15,
    nextSessionAt: todayAt(10, 3),
    description:
      'Iniciação ao tênis com raquetes adaptadas ao tamanho da criança e quadras reduzidas.',
    tags: ['Raquete inclusa', 'Quadra coberta'],
  },
];
