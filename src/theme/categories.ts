import type { ActivityCategoryId } from '@/types/domain';

/**
 * Cor própria de cada modalidade.
 *
 * O app estava monocromático: roxo em tudo, com o resto da paleta aparecendo
 * só em detalhes. Dar uma cor a cada modalidade usa a identidade inteira e
 * ainda ajuda a bater o olho e reconhecer — a cor vira informação, não
 * enfeite.
 *
 * As quatro primeiras são as cores da marca. As outras cinco são extensões
 * harmonizadas: mesma saturação alta e mesmo tom de brincadeira, para não
 * parecerem de outra paleta.
 *
 * A cor nunca carrega significado sozinha: o rótulo da modalidade está sempre
 * junto, para quem não distingue as cores.
 */
export type CategoryTone = {
  /** Traço e texto sobre fundo claro. */
  solid: string;
  /** Fundo do chip/tile no tema claro. */
  soft: string;
  /** Fundo do chip/tile no tema escuro. */
  softDark: string;
  /** Traço e texto no tema escuro, clareado para manter contraste. */
  solidDark: string;
};

const TONES: Record<ActivityCategoryId, CategoryTone> = {
  // Marca
  futebol: { solid: '#6A3FC6', soft: '#EFE9FB', softDark: '#2A2247', solidDark: '#A382F0' },
  natacao: { solid: '#0E9BA0', soft: '#DFF6F6', softDark: '#123437', solidDark: '#3FD8DA' },
  danca: { solid: '#D93E76', soft: '#FFE9F1', softDark: '#3A1B29', solidDark: '#FF8AB8' },
  artes: { solid: '#B07500', soft: '#FFF3D6', softDark: '#3A2E0F', solidDark: '#FFD466' },
  // Extensões harmonizadas
  judo: { solid: '#3D4B9E', soft: '#E6E9F8', softDark: '#1E2340', solidDark: '#8B99E8' },
  ginastica: { solid: '#C2410C', soft: '#FFEBE0', softDark: '#3A2015', solidDark: '#FF9666' },
  tenis: { solid: '#3F8A2B', soft: '#E6F5E0', softDark: '#1B2F16', solidDark: '#7FD463' },
  basquete: { solid: '#B45309', soft: '#FFF0DC', softDark: '#3A2812', solidDark: '#F0A05A' },
  volei: { solid: '#1D6FA8', soft: '#E2F0FA', softDark: '#152A3A', solidDark: '#66B9EB' },
};

export function categoryTone(
  category: ActivityCategoryId,
  isDark: boolean,
): { solid: string; soft: string } {
  const tone = TONES[category];
  return isDark
    ? { solid: tone.solidDark, soft: tone.softDark }
    : { solid: tone.solid, soft: tone.soft };
}
