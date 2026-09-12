import * as ImagePicker from 'expo-image-picker';

/**
 * Escolher uma imagem quadrada da galeria.
 *
 * Vive aqui porque a mesma sequência serve à foto da criança e à do
 * responsável, e ela tem três decisões que não deveriam ser reescritas duas
 * vezes: pedir permissão antes, recortar em quadrado e comprimir **antes** de
 * subir.
 *
 * Os três desfechos são distintos de propósito. `negado` e `cancelado` viravam
 * o mesmo `null` quando isto morava na tela, e a diferença importa: quem negou
 * a permissão precisa ler por que nada aconteceu; quem desistiu, não precisa
 * ler nada.
 */
export type EscolhaDeFoto =
  { estado: 'escolhida'; uri: string } | { estado: 'cancelado' } | { estado: 'negado' };

export async function escolherImagem(): Promise<EscolhaDeFoto> {
  const permissao = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permissao.granted) return { estado: 'negado' };

  const escolha = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    // O recorte quadrado e a compressão acontecem aqui, antes de subir: é um
    // avatar de algumas dezenas de pixels, e mandar 8 MB do celular para o
    // bucket seria gastar dado da família para nada.
    quality: 0.7,
  });

  const uri = escolha.canceled ? null : escolha.assets[0]?.uri;
  return uri ? { estado: 'escolhida', uri } : { estado: 'cancelado' };
}
