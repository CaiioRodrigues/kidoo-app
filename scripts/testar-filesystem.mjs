/**
 * Nenhum arquivo nosso pode chamar método depreciado do `expo-file-system`.
 *
 * O defeito que este teste existe para impedir: `FileSystem.readAsStringAsync`
 * continuava compilando depois do SDK 57, porque o pacote mantém a função
 * exportada e tipada — só que o corpo dela agora é `throw`. Typecheck verde,
 * lint verde, e a foto da criança falhando em todo aparelho, antes mesmo de
 * tocar na rede. Nenhuma ferramenta nossa tinha como ver isso.
 *
 * A lista de proibidos não é escrita aqui: sai de `legacyWarnings` do próprio
 * pacote instalado. Uma lista minha envelheceria em silêncio no dia em que o
 * Expo depreciasse mais uma função — que é exatamente o dia em que ela
 * precisaria estar certa.
 *
 * `npm run test:filesystem`
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const MODULO = 'expo-file-system';
const PASTAS = ['src', 'app'];

let falhas = 0;
function ok(condicao, descricao) {
  if (condicao) {
    console.log(`  ok  ${descricao}`);
  } else {
    console.error(`FALHA  ${descricao}`);
    falhas += 1;
  }
}

/**
 * Os nomes que lançam em execução, lidos do pacote.
 *
 * Cada um aparece como `export async function <nome>(` num arquivo cujo corpo
 * inteiro é `throw errorOnLegacyMethodUse(...)`. Casar pela chamada do erro, e
 * não pela marca `@deprecated`, é de propósito: depreciado mas funcionando é
 * aviso, e aviso não quebra a foto de ninguém. O que interessa é o `throw`.
 */
function metodosQueLancam() {
  const fonte = readFileSync(join('node_modules', MODULO, 'src', 'legacyWarnings.ts'), 'utf8');
  const nomes = new Set();
  const declaracao = /export\s+(?:async\s+)?function\s+(\w+)\s*\(/g;

  for (const achado of fonte.matchAll(declaracao)) {
    const nome = achado[1];
    if (!nome) continue;
    // O corpo vai da declaração até a próxima, e precisa conter o `throw`.
    const daqui = fonte.slice(achado.index ?? 0);
    const fim = daqui.slice(1).search(/\nexport\s+(?:async\s+)?function\s/);
    const corpo = fim === -1 ? daqui : daqui.slice(0, fim + 1);
    if (corpo.includes('errorOnLegacyMethodUse')) nomes.add(nome);
  }
  return [...nomes];
}

function arquivosDeCodigo(raiz) {
  const achados = [];
  const andar = (pasta) => {
    for (const entrada of readdirSync(pasta)) {
      const caminho = join(pasta, entrada);
      if (statSync(caminho).isDirectory()) {
        andar(caminho);
      } else if (/\.tsx?$/.test(entrada)) {
        achados.push(caminho);
      }
    }
  };
  andar(raiz);
  return achados;
}

console.log('Métodos do expo-file-system que lançam em execução\n');

const proibidos = metodosQueLancam();

// Sem esta linha o teste passaria vazio para sempre se o formato do pacote
// mudasse: zero proibidos, zero violações, verde. Passar por não ter procurado
// é o jeito mais silencioso de um teste mentir.
ok(proibidos.length > 0, `a lista veio do pacote (${proibidos.length} métodos)`);
ok(
  proibidos.includes('readAsStringAsync'),
  'readAsStringAsync está na lista — é o que quebrou a foto da criança',
);

const violacoes = [];

for (const raiz of PASTAS) {
  for (const arquivo of arquivosDeCodigo(raiz)) {
    const codigo = readFileSync(arquivo, 'utf8');
    if (!codigo.includes(MODULO)) continue;

    // Só o módulo principal. `expo-file-system/legacy` é a saída oficial e
    // funciona: proibi-la seria proibir o conserto.
    const importaPrincipal = new RegExp(`from ['"]${MODULO}['"]`).test(codigo);
    if (!importaPrincipal) continue;

    for (const metodo of proibidos) {
      // `.metodo(` pega o namespace (`FileSystem.readAsStringAsync(`) e
      // `\bmetodo(` pega o import nomeado.
      const chamada = new RegExp(`(?:\\.|\\b)${metodo}\\s*\\(`);
      if (chamada.test(codigo)) {
        violacoes.push(`${arquivo} chama ${metodo}() do '${MODULO}'`);
      }
    }
  }
}

for (const violacao of violacoes) console.error(`FALHA  ${violacao}`);
ok(violacoes.length === 0, 'nenhum arquivo chama método que lança');

console.log(falhas === 0 ? '\nTudo certo.' : `\n${falhas} falha(s).`);
process.exit(falhas === 0 ? 0 : 1);
