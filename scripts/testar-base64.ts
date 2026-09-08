/**
 * Confere o decoder de base64 contra os vetores da RFC 4648.
 *
 * Roda com `npm run test:base64`. Existe porque decoder escrito à mão é onde
 * dado se corrompe em silêncio: uma foto com um byte errado no fim abre torta
 * ou não abre, e o erro só aparece semanas depois, no aparelho de alguém.
 *
 * Os vetores vêm da RFC, e não de um `Buffer.from(...).toString('base64')`:
 * comparar com a resposta oficial é uma verificação de verdade; comparar com
 * outra implementação minha só provaria que as duas erram igual.
 */
import { base64ParaBytes } from '@/lib/base64';

let falhas = 0;
const ok = (cond: boolean, msg: string) => {
  if (!cond) {
    console.log('  FALHA ' + msg);
    falhas++;
  }
};

const paraTexto = (bytes: Uint8Array) => String.fromCharCode(...bytes);

// RFC 4648, seção 10. Cobre os três restos possíveis: sem sobra, um byte
// sobrando (`==`) e dois (`=`) — é onde erro de preenchimento aparece.
const VETORES: [string, string][] = [
  ['', ''],
  ['Zg==', 'f'],
  ['Zm8=', 'fo'],
  ['Zm9v', 'foo'],
  ['Zm9vYg==', 'foob'],
  ['Zm9vYmE=', 'fooba'],
  ['Zm9vYmFy', 'foobar'],
];

for (const [entrada, esperado] of VETORES) {
  const saida = paraTexto(base64ParaBytes(entrada));
  ok(saida === esperado, `"${entrada}" → esperado "${esperado}", veio "${saida}"`);
  ok(
    base64ParaBytes(entrada).length === esperado.length,
    `"${entrada}" → esperado ${esperado.length} bytes, veio ${base64ParaBytes(entrada).length}`,
  );
}

// Um arquivo de verdade: o cabeçalho de 16 bytes de um PNG, que tem byte alto
// (0x89) e zeros — os dois casos que um decoder desatento estraga.
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
             0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52];
const decodificado = base64ParaBytes('iVBORw0KGgoAAAANSUhEUg==');
ok(decodificado.length === 16, `cabeçalho PNG: esperado 16 bytes, veio ${decodificado.length}`);
ok(
  PNG.every((b, i) => decodificado[i] === b),
  'cabeçalho PNG: os bytes não bateram',
);

// Quebra de linha no meio: o `readAsStringAsync` pode devolver base64 com
// quebras, e ignorá-las é o que a limpeza da função faz.
ok(paraTexto(base64ParaBytes('Zm9v\nYmFy')) === 'foobar', 'base64 com quebra de linha');

console.log(falhas === 0 ? '>>> base64 ok: RFC 4648 + cabeçalho PNG' : `>>> ${falhas} FALHA(S)`);
process.exit(falhas ? 1 : 0);
