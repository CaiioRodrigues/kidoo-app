/**
 * O painel não pode importar VALOR de dentro do app.
 *
 * O defeito que este teste impede, que só apareceu no build da Vercel:
 *
 * O painel sempre importou coisas do app por `@app/*` — `ClassSession`,
 * `SlotKind`, a curva de níveis. Todas eram `import type`, que o compilador
 * apaga, então o Vite nunca precisou **transformar** nenhum arquivo do app.
 *
 * No dia em que entrou o primeiro import de valor (`erroDeEnvio`, uma função),
 * o esbuild passou a compilar aquele arquivo de verdade — e, para compilar, ele
 * procura o tsconfig mais próximo, subindo diretório por diretório. Chegou ao
 * `tsconfig.json` da raiz, que estende `expo/tsconfig.base`. O build do painel
 * roda a partir de `partner/`, onde o `expo` não está instalado. Build vermelho.
 *
 * Localmente nada disso aparece: o `node_modules` da raiz existe, e o extends
 * resolve. Typecheck verde, lint verde, `npm run build:demo` verde. O único
 * lugar onde o erro existe é o ambiente de publicação.
 *
 * O que é compartilhado como valor vive em `shared/`, que tem tsconfig próprio
 * e sem extends — é ele que faz a busca do esbuild parar antes da raiz.
 *
 * `npm run test:compartilhado`
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const PASTA = join('partner', 'src');

let falhas = 0;
function ok(condicao, descricao) {
  if (condicao) {
    console.log(`  ok  ${descricao}`);
  } else {
    console.error(`FALHA  ${descricao}`);
    falhas += 1;
  }
}

function arquivos(raiz) {
  const achados = [];
  const andar = (pasta) => {
    for (const entrada of readdirSync(pasta)) {
      const caminho = join(pasta, entrada);
      if (statSync(caminho).isDirectory()) andar(caminho);
      else if (/\.tsx?$/.test(entrada)) achados.push(caminho);
    }
  };
  andar(raiz);
  return achados;
}

/**
 * Todo `import ... from '@app/...'` do painel, com o texto que o abre.
 *
 * Casa o `import` inteiro até o `from` para conseguir olhar se ele começa com
 * `import type`. Um `import { type X } from '@app/...'` também é apagado pelo
 * compilador, então conta como tipo.
 */
function importsDoApp(codigo) {
  const achados = [];
  // `[^;]` e não `[\s\S]`: o ponto e vírgula fecha cada import, e sem essa
  // barreira a busca preguiçosa atravessava os imports anteriores até achar o
  // primeiro `@app/` — reportando como violação a primeira linha do arquivo,
  // que não tinha nada a ver.
  const padrao = /import\s+[^;]*?\s+from\s+['"]@app\/[^'"]+['"]/g;
  for (const m of codigo.matchAll(padrao)) achados.push(m[0]);
  return achados;
}

function ehSomenteTipo(trecho) {
  // `import type { … } from` — a forma que o compilador apaga inteira.
  if (/^import\s+type\b/.test(trecho)) return true;
  // `import { type A, type B } from` — apagada peça por peça. Só vale se TODO
  // nome trouxer o `type`; um único sem ele traz o arquivo para o bundle.
  const chaves = trecho.match(/\{([\s\S]*?)\}/);
  if (!chaves || !chaves[1]) return false;
  const nomes = chaves[1]
    .split(',')
    .map((n) => n.trim())
    .filter(Boolean);
  return nomes.length > 0 && nomes.every((n) => /^type\s/.test(n));
}

console.log('O painel só importa TIPO de dentro do app\n');

const lista = arquivos(PASTA);
// Sem esta linha o teste passaria vazio se a pasta mudasse de lugar: zero
// arquivos, zero violações, verde. Passar por não ter procurado é o jeito mais
// silencioso de um teste mentir.
ok(lista.length > 0, `achou os arquivos do painel (${lista.length})`);

let comImport = 0;
const violacoes = [];

for (const arquivo of lista) {
  const codigo = readFileSync(arquivo, 'utf8');
  for (const trecho of importsDoApp(codigo)) {
    comImport += 1;
    if (!ehSomenteTipo(trecho)) {
      const linha = trecho.replace(/\s+/g, ' ').slice(0, 90);
      violacoes.push(`${arquivo}: ${linha}`);
    }
  }
}

ok(comImport > 0, `e que eles realmente importam do app (${comImport} imports)`);

for (const v of violacoes) {
  console.error(`FALHA  ${v}`);
}
ok(
  violacoes.length === 0,
  "nenhum import de valor vindo de '@app/…' — o que os dois usam vive em 'shared/'",
);

console.log(falhas === 0 ? '\nTudo certo.' : `\n${falhas} falha(s).`);
process.exit(falhas === 0 ? 0 : 1);
