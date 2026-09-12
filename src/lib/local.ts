import type { Partner } from '@/types/domain';

/** Em qual sistema o link vai ser aberto. */
export type Sistema = 'ios' | 'android' | 'web';

/**
 * Como chegar ao estabelecimento e como falar com ele.
 *
 * Funções puras, longe da tela, porque o que decide cada endereço destes é
 * plataforma e formato — coisas que se testam sem abrir o app, e que erradas
 * falham de um jeito silencioso: o link simplesmente não abre nada, e ninguém
 * relata "o botão não fez nada".
 */

/**
 * O link do mapa.
 *
 * Sai da **coordenada**, e não do texto do endereço, e isso é a decisão que
 * importa aqui: geocodificar um texto é um palpite que às vezes acerta a rua
 * errada, enquanto a coordenada já foi conferida quando o parceiro entrou. É
 * também o que faz o botão funcionar para quem ainda não preencheu o endereço.
 *
 * O nome vai junto só como rótulo do alfinete — o que posiciona é o número.
 *
 * Cada plataforma tem o seu:
 *
 * - **iOS** usa `maps:`, que o Apple Maps atende. Um `geo:` no iOS não abre
 *   nada, e não dá erro: o toque não faz coisa nenhuma.
 * - **Android** usa `geo:lat,lng?q=lat,lng(Nome)`. A repetição não é
 *   desperdício: sem o `q` o mapa centraliza mas não marca, e sem a coordenada
 *   antes do `?` alguns aparelhos ignoram o resto.
 * - **Web** cai no Google Maps, que é o que um navegador sabe abrir.
 *
 * O sistema entra por parâmetro em vez de vir de `Platform.OS` aqui dentro:
 * importar o react-native tornaria este arquivo impossível de rodar fora do
 * app, e é justamente a diferença entre as três plataformas que precisa de
 * teste — testar só a que o computador é deixaria as outras duas sem nada.
 */
export function linkDoMapa(
  partner: Pick<Partner, 'name' | 'latitude' | 'longitude'>,
  sistema: Sistema,
): string {
  const { latitude: lat, longitude: lng, name } = partner;
  const rotulo = encodeURIComponent(name);
  if (sistema === 'ios') return `maps:0,0?q=${rotulo}@${lat},${lng}`;
  if (sistema === 'android') return `geo:${lat},${lng}?q=${lat},${lng}(${rotulo})`;
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}

/**
 * O telefone como o discador o entende.
 *
 * `tel:` recusa espaço, parêntese e traço em boa parte dos aparelhos — o
 * número é guardado como a pessoa o escreveu, para ser lido na tela, e limpo
 * só na hora de discar. O `+` inicial sobrevive porque é o que faz o número
 * internacional funcionar.
 */
export function linkDoTelefone(telefone: string): string {
  const limpo = telefone.replace(/[^\d+]/g, '');
  return `tel:${limpo}`;
}

/**
 * O que mostrar como endereço.
 *
 * Sem endereço cadastrado sobra o bairro e a cidade, que é o que o app sempre
 * teve. É pouco, mas é verdade — e é melhor do que um espaço em branco onde
 * deveria estar o lugar da aula.
 */
export function enderecoVisivel(
  partner: Pick<Partner, 'address' | 'neighborhood' | 'city'>,
): string {
  return partner.address ?? `${partner.neighborhood}, ${partner.city}`;
}
