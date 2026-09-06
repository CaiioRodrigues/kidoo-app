import {
  COIN_TIERS,
  type Activity,
  type ActivityCategory,
  type CoinTier,
  type Partner,
  type Plan,
} from '@/types/domain';

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

/**
 * Economia dos Kidoo Coins.
 *
 * Cada atividade custa 2, 3 ou 4 coins conforme a estrutura exigida
 * (`COIN_TIERS`), o que dá um custo médio de ~3 coins no catálogo. A cota
 * semanal de cada plano é calibrada por esse custo médio:
 *
 *   Start  8 coins/semana  → ~3 atividades
 *   Plus  12 coins/semana  → ~4 atividades
 *   Max   18 coins/semana  → ~6 atividades (famílias com mais de uma criança)
 *
 * A cobrança é mensal, mas a cota é semanal e volta ao cheio toda segunda.
 * Coins não acumulam entre semanas — a ideia é incentivar frequência, não
 * estoque.
 */
export const PLANS: Plan[] = [
  {
    id: 'start',
    name: 'Start',
    priceCents: 7990,
    coinsPerWeek: 8,
    activitiesPerWeek: 3,
    tagline: 'Ideal para começar',
    highlighted: false,
    perks: [
      '8 Kidoo Coins por semana',
      'Cerca de 3 atividades semanais',
      'Acesso a todos os parceiros',
      'Cancelamento fácil',
    ],
  },
  {
    id: 'plus',
    name: 'Plus',
    priceCents: 10990,
    coinsPerWeek: 12,
    activitiesPerWeek: 4,
    tagline: 'Mais atividades e variedade',
    highlighted: true,
    perks: [
      '12 Kidoo Coins por semana',
      'Cerca de 4 atividades semanais',
      'Acesso a todos os parceiros',
      'Cancelamento fácil',
      'Suporte especializado',
    ],
  },
  {
    id: 'max',
    name: 'Max',
    priceCents: 14990,
    coinsPerWeek: 18,
    activitiesPerWeek: 6,
    tagline: 'Para famílias que amam explorar',
    highlighted: false,
    perks: [
      '18 Kidoo Coins por semana',
      'Cerca de 6 atividades semanais',
      'Ideal para mais de uma criança',
      'Acesso a todos os parceiros',
      'Prioridade em turmas concorridas',
    ],
  },
];

const PARTNERS = {
  arena: {
    id: 'p-arena',
    name: 'Academia Arena Kids',
    neighborhood: 'Buritis',
    city: 'Belo Horizonte',
    latitude: -19.9702,
    longitude: -43.9803,
    verified: true,
  },
  pampulha: {
    id: 'p-pampulha',
    name: 'Clube Pampulha',
    neighborhood: 'Pampulha',
    city: 'Belo Horizonte',
    latitude: -19.8551,
    longitude: -43.9797,
    verified: true,
  },
  savassi: {
    id: 'p-savassi',
    name: 'Dojo Savassi',
    neighborhood: 'Savassi',
    city: 'Belo Horizonte',
    latitude: -19.9381,
    longitude: -43.9331,
    verified: true,
  },
  bailar: {
    id: 'p-bailar',
    name: 'Studio Bailar',
    neighborhood: 'Funcionários',
    city: 'Belo Horizonte',
    latitude: -19.9334,
    longitude: -43.9282,
    verified: false,
  },
  cidadeJardim: {
    id: 'p-cidade-jardim',
    name: 'Espaço Cidade Jardim',
    neighborhood: 'Cidade Jardim',
    city: 'Belo Horizonte',
    latitude: -19.9424,
    longitude: -43.9518,
    verified: true,
  },
  ateliê: {
    id: 'p-atelie',
    name: 'Ateliê Cores',
    neighborhood: 'Santo Antônio',
    city: 'Belo Horizonte',
    latitude: -19.9479,
    longitude: -43.9447,
    verified: true,
  },
  castelo: {
    id: 'p-castelo',
    name: 'Centro Esportivo Castelo',
    neighborhood: 'Castelo',
    city: 'Belo Horizonte',
    latitude: -19.8903,
    longitude: -44.0104,
    verified: true,
  },
  serra: {
    id: 'p-serra',
    name: 'Vila Esportiva Serra',
    neighborhood: 'Serra',
    city: 'Belo Horizonte',
    latitude: -19.9432,
    longitude: -43.9203,
    verified: false,
  },
} satisfies Record<string, Partner>;

type PartnerKey = keyof typeof PARTNERS;

/**
 * Imagens de demonstração (Unsplash). São placeholders por modalidade — a
 * mídia real de cada parceiro entra no lugar quando o catálogo for de verdade.
 */
const IMAGES: Record<string, string> = {
  futebol: 'https://images.unsplash.com/photo-1517649763962-0c623066013b?w=800&q=70',
  natacao: 'https://images.unsplash.com/photo-1600965962361-9035dbfd1c50?w=800&q=70',
  judo: 'https://images.unsplash.com/photo-1555597673-b21d5c935865?w=800&q=70',
  danca: 'https://images.unsplash.com/photo-1518834107812-67b0b7c58434?w=800&q=70',
  ginastica: 'https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?w=800&q=70',
  tenis: 'https://images.unsplash.com/photo-1554068865-24cecd4e34b8?w=800&q=70',
  basquete: 'https://images.unsplash.com/photo-1546519638-68e109498ffc?w=800&q=70',
  volei: 'https://images.unsplash.com/photo-1612872087720-bb876e2e67d1?w=800&q=70',
  artes: 'https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?w=800&q=70',
};

/** Horário fixo do dia, para o mock não "envelhecer" entre execuções. */
function sessionAt(hour: number, dayOffset: number): string {
  const date = new Date();
  date.setDate(date.getDate() + dayOffset);
  date.setHours(hour, 0, 0, 0);
  return date.toISOString();
}

type Seed = {
  id: string;
  title: string;
  category: Activity['category'];
  partner: PartnerKey;
  tier: CoinTier;
  rating: number;
  reviewCount: number;
  minAge: number;
  maxAge: number;
  hour: number;
  dayOffset: number;
  description: string;
  tags: string[];
};

const SEEDS: Seed[] = [
  {
    id: 'a-futebol-kids',
    title: 'Futebol Kids',
    category: 'futebol',
    partner: 'arena',
    tier: 'padrao',
    rating: 4.9,
    reviewCount: 127,
    minAge: 6,
    maxAge: 9,
    hour: 17,
    dayOffset: 0,
    description:
      'Aulas recreativas de futebol focadas em movimento, coordenação, socialização e diversão. Aqui a criança aprende brincando!',
    tags: ['Turma mista', 'Aulas recreativas'],
  },
  {
    id: 'a-futebol-society',
    title: 'Futebol Society Mirim',
    category: 'futebol',
    partner: 'castelo',
    tier: 'basico',
    rating: 4.6,
    reviewCount: 58,
    minAge: 9,
    maxAge: 13,
    hour: 18,
    dayOffset: 1,
    description:
      'Society em campo reduzido, com foco em jogo coletivo, posicionamento e espírito de equipe.',
    tags: ['Campo sintético', 'Turma avançada'],
  },
  {
    id: 'a-natacao-infantil',
    title: 'Natação Infantil',
    category: 'natacao',
    partner: 'pampulha',
    tier: 'padrao',
    rating: 4.8,
    reviewCount: 94,
    minAge: 5,
    maxAge: 10,
    hour: 9,
    dayOffset: 1,
    description:
      'Adaptação ao meio líquido e primeiros nados, com turmas pequenas e professores especializados em educação infantil.',
    tags: ['Turmas pequenas', 'Piscina aquecida'],
  },
  {
    id: 'a-natacao-bebes',
    title: 'Natação para Bebês',
    category: 'natacao',
    partner: 'pampulha',
    tier: 'premium',
    rating: 4.9,
    reviewCount: 41,
    minAge: 2,
    maxAge: 4,
    hour: 10,
    dayOffset: 2,
    description:
      'Aulas com participação de um responsável na água, trabalhando segurança aquática e vínculo afetivo.',
    tags: ['Com responsável', 'Piscina aquecida'],
  },
  {
    id: 'a-judo-kids',
    title: 'Judô Kids',
    category: 'judo',
    partner: 'savassi',
    tier: 'padrao',
    rating: 4.9,
    reviewCount: 61,
    minAge: 6,
    maxAge: 12,
    hour: 18,
    dayOffset: 1,
    description:
      'Judô infantil com foco em disciplina, respeito e coordenação motora, em ambiente acolhedor e seguro.',
    tags: ['Disciplina', 'Faixas oficiais'],
  },
  {
    id: 'a-jiu-jitsu-mirim',
    title: 'Jiu-Jitsu Mirim',
    category: 'judo',
    partner: 'serra',
    tier: 'basico',
    rating: 4.5,
    reviewCount: 29,
    minAge: 7,
    maxAge: 12,
    hour: 17,
    dayOffset: 3,
    description:
      'Iniciação ao jiu-jitsu com ênfase em autocontrole, defesa pessoal e respeito ao colega.',
    tags: ['Kimono incluso', 'Turma iniciante'],
  },
  {
    id: 'a-ballet-infantil',
    title: 'Ballet Infantil',
    category: 'danca',
    partner: 'bailar',
    tier: 'padrao',
    rating: 4.7,
    reviewCount: 48,
    minAge: 4,
    maxAge: 8,
    hour: 15,
    dayOffset: 2,
    description:
      'Primeiros passos no ballet clássico, trabalhando postura, ritmo e expressão corporal de forma lúdica.',
    tags: ['Lúdico', 'Apresentação anual'],
  },
  {
    id: 'a-danca-criativa',
    title: 'Dança Criativa',
    category: 'danca',
    partner: 'cidadeJardim',
    tier: 'basico',
    rating: 4.6,
    reviewCount: 33,
    minAge: 5,
    maxAge: 10,
    hour: 16,
    dayOffset: 4,
    description:
      'Aulas de dança livre com improviso e música ao vivo, para soltar o corpo e a imaginação.',
    tags: ['Música ao vivo', 'Turma mista'],
  },
  {
    id: 'a-ginastica-artistica',
    title: 'Ginástica Artística',
    category: 'ginastica',
    partner: 'arena',
    tier: 'premium',
    rating: 4.8,
    reviewCount: 73,
    minAge: 6,
    maxAge: 12,
    hour: 16,
    dayOffset: 2,
    description:
      'Solo, trave e paralelas em nível iniciante, com foco em força, flexibilidade e consciência corporal.',
    tags: ['Equipamento completo', 'Turma iniciante'],
  },
  {
    id: 'a-ginastica-ritmica',
    title: 'Ginástica Rítmica',
    category: 'ginastica',
    partner: 'cidadeJardim',
    tier: 'padrao',
    rating: 4.7,
    reviewCount: 37,
    minAge: 5,
    maxAge: 11,
    hour: 14,
    dayOffset: 5,
    description:
      'Fita, arco e bola em coreografias simples, unindo dança, ritmo e coordenação fina.',
    tags: ['Materiais inclusos', 'Coreografias'],
  },
  {
    id: 'a-tenis-mirim',
    title: 'Tênis Mirim',
    category: 'tenis',
    partner: 'pampulha',
    tier: 'premium',
    rating: 4.6,
    reviewCount: 35,
    minAge: 7,
    maxAge: 12,
    hour: 10,
    dayOffset: 3,
    description:
      'Iniciação ao tênis com raquetes adaptadas ao tamanho da criança e quadras reduzidas.',
    tags: ['Raquete inclusa', 'Quadra coberta'],
  },
  {
    id: 'a-beach-tennis-kids',
    title: 'Beach Tennis Kids',
    category: 'tenis',
    partner: 'serra',
    tier: 'padrao',
    rating: 4.5,
    reviewCount: 22,
    minAge: 8,
    maxAge: 14,
    hour: 9,
    dayOffset: 6,
    description:
      'Beach tennis na areia, em duplas, trabalhando reflexo, equilíbrio e jogo cooperativo.',
    tags: ['Quadra de areia', 'Em duplas'],
  },
  {
    id: 'a-basquete-kids',
    title: 'Basquete Kids',
    category: 'basquete',
    partner: 'castelo',
    tier: 'basico',
    rating: 4.7,
    reviewCount: 52,
    minAge: 7,
    maxAge: 12,
    hour: 17,
    dayOffset: 2,
    description:
      'Fundamentos do basquete com cestas em altura reduzida e muito jogo, do primeiro drible ao arremesso.',
    tags: ['Cesta adaptada', 'Ginásio coberto'],
  },
  {
    id: 'a-basquete-3x3',
    title: 'Basquete 3x3 Juvenil',
    category: 'basquete',
    partner: 'arena',
    tier: 'padrao',
    rating: 4.8,
    reviewCount: 26,
    minAge: 11,
    maxAge: 15,
    hour: 19,
    dayOffset: 4,
    description:
      'Formato 3x3, jogos rápidos e muita participação — ideal para quem já tem alguma vivência na quadra.',
    tags: ['Turma avançada', 'Jogos rápidos'],
  },
  {
    id: 'a-volei-kids',
    title: 'Vôlei Kids',
    category: 'volei',
    partner: 'castelo',
    tier: 'basico',
    rating: 4.6,
    reviewCount: 44,
    minAge: 8,
    maxAge: 13,
    hour: 16,
    dayOffset: 3,
    description:
      'Mini vôlei com rede baixa e bola leve, focado em toque, manchete e trabalho em equipe.',
    tags: ['Rede adaptada', 'Turma mista'],
  },
  {
    id: 'a-volei-praia',
    title: 'Vôlei de Areia Mirim',
    category: 'volei',
    partner: 'serra',
    tier: 'padrao',
    rating: 4.4,
    reviewCount: 18,
    minAge: 9,
    maxAge: 14,
    hour: 8,
    dayOffset: 6,
    description:
      'Vôlei na areia em duplas, ótimo para condicionamento e para quem gosta de treinar ao ar livre.',
    tags: ['Ao ar livre', 'Em duplas'],
  },
  {
    id: 'a-artes-pequenos',
    title: 'Artes para Pequenos',
    category: 'artes',
    partner: 'ateliê',
    tier: 'basico',
    rating: 4.9,
    reviewCount: 66,
    minAge: 3,
    maxAge: 7,
    hour: 14,
    dayOffset: 1,
    description:
      'Pintura, colagem e modelagem com materiais atóxicos, explorando cor, textura e imaginação.',
    tags: ['Material incluso', 'Materiais atóxicos'],
  },
  {
    id: 'a-teatro-infantil',
    title: 'Teatro Infantil',
    category: 'artes',
    partner: 'ateliê',
    tier: 'padrao',
    rating: 4.8,
    reviewCount: 31,
    minAge: 7,
    maxAge: 12,
    hour: 15,
    dayOffset: 5,
    description:
      'Jogos teatrais, improviso e construção de personagens — excelente para timidez e expressão oral.',
    tags: ['Improviso', 'Mostra semestral'],
  },
];

export const ACTIVITIES: Activity[] = SEEDS.map((seed) => ({
  id: seed.id,
  title: seed.title,
  category: seed.category,
  partner: PARTNERS[seed.partner],
  imageUrl: IMAGES[seed.category] ?? IMAGES.futebol!,
  rating: seed.rating,
  reviewCount: seed.reviewCount,
  minAge: seed.minAge,
  maxAge: seed.maxAge,
  // Derivada em tempo de consulta, a partir de onde o usuário está.
  distanceKm: null,
  coinCost: COIN_TIERS[seed.tier],
  nextSessionAt: sessionAt(seed.hour, seed.dayOffset),
  description: seed.description,
  tags: seed.tags,
}));

/** Custo médio de uma atividade — base do cálculo da cota semanal dos planos. */
export const AVERAGE_ACTIVITY_COST =
  ACTIVITIES.reduce((sum, activity) => sum + activity.coinCost, 0) / ACTIVITIES.length;
