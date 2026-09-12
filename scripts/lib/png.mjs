/**
 * PNG → pixels, escrito à mão.
 *
 * Vive num módulo próprio porque dois testes precisam dele — o da moeda e o das
 * medalhas — e um decodificador copiado é um decodificador que diverge: a
 * correção do caso RGB abaixo levaria só a metade das cópias.
 *
 * Escrito à mão, e não instalado, porque não há decodificador de imagem entre
 * as dependências e carregar um pacote inteiro para contar pixels seria
 * desproporcional.
 */
import { inflateSync } from 'node:zlib';

export function pixels(buffer) {
  let pos = 8; // assinatura
  let largura = 0;
  let altura = 0;
  let canais = 0;
  const partes = [];

  while (pos < buffer.length) {
    const tamanho = buffer.readUInt32BE(pos);
    const tipo = buffer.toString('ascii', pos + 4, pos + 8);
    const dados = buffer.subarray(pos + 8, pos + 8 + tamanho);
    if (tipo === 'IHDR') {
      largura = dados.readUInt32BE(0);
      altura = dados.readUInt32BE(4);
      const profundidade = dados[8];
      const cor = dados[9];
      if (profundidade !== 8 || (cor !== 2 && cor !== 6)) {
        throw new Error(`PNG inesperado: profundidade ${profundidade}, cor ${cor}`);
      }
      canais = cor === 2 ? 3 : 4;
    } else if (tipo === 'IDAT') {
      partes.push(dados);
    } else if (tipo === 'IEND') {
      break;
    }
    pos += 12 + tamanho;
  }

  const cru = inflateSync(Buffer.concat(partes));
  const porLinha = largura * canais;
  const saida = Buffer.alloc(altura * porLinha);

  for (let y = 0; y < altura; y += 1) {
    const filtro = cru[y * (porLinha + 1)];
    const entrada = cru.subarray(y * (porLinha + 1) + 1, (y + 1) * (porLinha + 1));
    const inicio = y * porLinha;

    for (let x = 0; x < porLinha; x += 1) {
      const esquerda = x >= canais ? saida[inicio + x - canais] : 0;
      const acima = y > 0 ? saida[inicio - porLinha + x] : 0;
      const diagonal = y > 0 && x >= canais ? saida[inicio - porLinha + x - canais] : 0;
      let soma;
      switch (filtro) {
        case 0:
          soma = 0;
          break;
        case 1:
          soma = esquerda;
          break;
        case 2:
          soma = acima;
          break;
        case 3:
          soma = (esquerda + acima) >> 1;
          break;
        case 4:
          soma = paeth(esquerda, acima, diagonal);
          break;
        default:
          throw new Error(`filtro PNG desconhecido: ${filtro}`);
      }
      saida[inicio + x] = (entrada[x] + soma) & 0xff;
    }
  }
  return { largura, altura, canais, dados: saida };
}

/** O preditor Paeth da especificação do PNG: escolhe o vizinho mais próximo. */
export function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
}
