import type { ActivityCategoryId } from '@/types/domain';

/**
 * Imagem de capa de uma atividade.
 *
 * O parceiro sobe a dele pelo painel. Enquanto não sobe — e no começo é o caso
 * de todo mundo — cai numa foto por modalidade, em vez de um retângulo vazio.
 *
 * Um cartão sem imagem não é neutro: ele parece defeito, e o catálogo inteiro
 * parece abandonado. É melhor uma foto genérica de natação do que um buraco
 * cinza onde deveria estar a piscina.
 *
 * O caminho para trocar é o painel do parceiro, e não uma escolha nossa por
 * ele: a foto da fachada dele vende melhor que qualquer banco de imagem.
 */
const POR_MODALIDADE: Record<string, string> = {
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

const PADRAO = POR_MODALIDADE.futebol as string;

/**
 * A imagem a exibir: a do parceiro, ou a da modalidade.
 *
 * String vazia conta como ausente. O banco guarda `null`, mas o mapeamento
 * antigo virava `''`, e `<Image source={{ uri: '' }}>` desenha um retângulo
 * vazio sem nenhum erro — a falha mais fácil de deixar passar.
 */
export function imagemDaAtividade(
  imageUrl: string | null | undefined,
  categoria: ActivityCategoryId | string,
): string {
  if (imageUrl && imageUrl.trim().length > 0) return imageUrl;
  return POR_MODALIDADE[categoria] ?? PADRAO;
}
