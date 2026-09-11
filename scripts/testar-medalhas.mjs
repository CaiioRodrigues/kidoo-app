/**
 * As doze medalhas estão desenhadas na grade de conquistas — e são desenhos,
 * não buracos.
 *
 * Duas metades, pela mesma razão do teste da moeda:
 *
 * 1. **O emoji não pode voltar.** Cada conquista trazia um emoji, e emoji é
 *    desenhado pela fonte do sistema: o app fica com a cara do Android, não com
 *    a do Kidoo, e dentro de linha de altura fixa o glifo é cortado.
 *
 * 2. **O desenho tem de pintar.** Contar o elemento não basta. Um ícone que
 *    renderiza nada deixa a caixa do tamanho certo, a grade inteira intacta e a
 *    legenda no lugar — foi assim que o mascote sumiu da abertura sem nenhum
 *    teste acusar. Então aqui os pixels são lidos: a asserção é sobre quanto da
 *    caixa deixou de ser fundo liso.
 *
 * Este mede "saiu do fundo", e não "é amarelo" como o da moeda, porque a
 * medalha bloqueada — que é o estado de quem acabou de se cadastrar, e o único
 * alcançável sem um parceiro confirmando presença — assume as cores de
 * superfície do tema. O que ela não pode é ser fundo liso.
 *
 * Roda contra o `expo export --platform web` servido em localhost:
 *
 *   npx expo export --platform web
 *   npx http-server dist -p 8095 --silent -P "http://localhost:8095?" &
 *   npm run test:medalhas
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';

import { pixels } from './lib/png.mjs';

const BASE = process.env.KIDOO_URL ?? 'http://localhost:8095/';
const executablePath = process.env.CHROMIUM_PATH || undefined;

/** Quantas regras existem. Bate com `ACHIEVEMENT_RULES`. */
const QUANTAS = 12;

let falhas = 0;
const ok = (c, d) => {
  console.log(`${c ? '  ok ' : 'FALHA'}  ${d}`);
  if (!c) falhas += 1;
};

// ------------------------------------------------ metade 1: o código-fonte --

console.log('Nenhuma conquista voltou a ser emoji\n');

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

// `emoji` continua existindo no domínio para categoria de atividade, que é
// outra coisa. O que não pode voltar é conquista com emoji.
const fonteDasRegras = readFileSync('src/lib/achievements.ts', 'utf8');
ok(!/emoji/i.test(fonteDasRegras), 'as regras de conquista não falam mais em emoji');

// Conta os `id:` de dentro do array, com a indentação dele: `isUnlocked:`
// apareceria uma vez a mais, na declaração do tipo logo acima.
const regras = (fonteDasRegras.match(/^ {4}id: '/gm) ?? []).length;
ok(regras === QUANTAS, `as ${QUANTAS} regras estão lá (${regras})`);

/*
  A varredura é só dos arquivos da conquista, e não da pasta inteira: a carteira
  de bônus, que mora ao lado, ainda usa 🎁. É o mesmo defeito e não foi
  consertado aqui — mas uma asserção que falasse pela tela toda estaria
  afirmando mais do que testa, e passaria a falhar por coisa que não é sua.
*/
const DA_CONQUISTA = [
  'src/lib/achievements.ts',
  ...arquivos('src/features/journey').filter((f) => /Achievement|Conquista/.test(f)),
];
const comEmoji = [];
for (const arquivo of DA_CONQUISTA) {
  for (const [i, linha] of readFileSync(arquivo, 'utf8').split('\n').entries()) {
    const cru = linha.trim();
    if (cru.startsWith('*') || cru.startsWith('//') || cru.startsWith('/*')) continue;
    if (/\p{Extended_Pictographic}/u.test(linha)) comEmoji.push(`${arquivo}:${i + 1}`);
  }
}
for (const c of comEmoji) console.error(`FALHA  ${c} usa emoji`);
ok(comEmoji.length === 0, `nenhuma conquista desenha com emoji (${DA_CONQUISTA.length} arquivos)`);

// ------------------------------------------------- metade 2: o que é pintado --

/**
 * Quanto de um pedaço da imagem deixou de ser a cor de fundo, de 0 a 1.
 *
 * A cor de fundo é descoberta, e não fixada: é a mais frequente do recorte.
 * Assim a medida vale nos dois temas e continua valendo se a cor do cartão
 * mudar — e o que não desenha nada dá zero, porque aí o recorte é de uma cor só.
 *
 * `margem` recorta uma fração de cada lado antes de contar.
 */
function fracaoPintada({ largura, altura, canais, dados }, margem = 0) {
  const x0 = Math.floor(largura * margem);
  const x1 = Math.ceil(largura * (1 - margem));
  const y0 = Math.floor(altura * margem);
  const y1 = Math.ceil(altura * (1 - margem));

  const contagem = new Map();
  let total = 0;
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const b = (y * largura + x) * canais;
      const c = (dados[b] << 16) | (dados[b + 1] << 8) | dados[b + 2];
      contagem.set(c, (contagem.get(c) ?? 0) + 1);
      total += 1;
    }
  }
  let dominante = 0;
  for (const quantos of contagem.values()) dominante = Math.max(dominante, quantos);
  return 1 - dominante / total;
}

/*
  O miolo: 30% de margem de cada lado, sobrando os 40% centrais.

  A medida da caixa inteira não serve para provar que *cada* glifo desenhou. Um
  `d` com erro de sintaxe não derruba nada — o react-native-svg simplesmente não
  desenha aquele caminho, e só aquele —, e a medalha continua com o disco e o
  anel: medido, isso deu 11,8% contra os 16,6% da medalha inteira. Perto demais
  para separar com um piso honesto.

  O anel tem raio 15,6 numa caixa de 40. Aos 30% de margem, a janela vai de 12 a
  28, e o ponto do anel mais próximo do centro está em 6,6 — fora dela. Então
  dentro do miolo só existe o glifo: se ele não desenhar, a leitura é zero.
*/
const MARGEM_DO_MIOLO = 0.3;

const b = await chromium.launch(executablePath ? { executablePath } : {});
const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });

// Cadastro completo: a grade de conquistas só existe com criança cadastrada, e
// recarregar a página zeraria o backend em memória junto com ela.
await p.goto(BASE, { waitUntil: 'networkidle' });
await p.waitForTimeout(4500);
await p.getByText('Criar conta', { exact: true }).first().click();
await p.waitForTimeout(1200);
let campos = p.locator('input:not([readonly])');
await campos.nth(0).fill('Caio Rodrigues');
await campos.nth(1).fill('caio@exemplo.com');
await campos.nth(2).fill('kidoo12345');
await p.getByText('Li e aceito').click();
await p.getByText('Criar conta', { exact: true }).last().click();
await p.waitForTimeout(1800);
campos = p.locator('input:not([readonly])');
await campos.nth(0).fill('Alice Rodrigues');
await campos.nth(1).fill('10/05/2018');
await p.getByText('Menina').click();
await p.getByText('Continuar').last().click();
await p.waitForTimeout(1500);
await p.getByText('Futebol', { exact: true }).last().click();
await p.getByText('Continuar').last().click();
await p.waitForTimeout(1800);
await p.getByText('Escolher plano').last().click();
await p.waitForTimeout(2400);
const pular = p.getByLabel('Pular tutorial');
await pular.waitFor({ state: 'visible', timeout: 20000 });
await pular.click();
await p.waitForTimeout(1200);

// Pela aba, e não por URL: recarregar zera o backend em memória.
await p.locator('a[href="/journey"]').last().click();
await p.waitForTimeout(2500);

console.log('\nAs medalhas desenhadas, na Jornada\n');

ok(p.url().endsWith('/journey'), `abriu a Jornada (${p.url()})`);

const titulo = p.getByText('Minhas conquistas').filter({ visible: true }).last();
await titulo.scrollIntoViewIfNeeded();
await p.waitForTimeout(700);

// A medalha é o único SVG de viewBox 40 na tela — os ícones de modalidade e a
// moeda usam 32, e os do @expo/vector-icons vêm como fonte, não como SVG.
const medalhas = p.locator('svg[viewBox="0 0 40 40"]').filter({ visible: true });
const quantas = await medalhas.count();
ok(quantas === QUANTAS, `as ${QUANTAS} medalhas estão na grade (${quantas})`);

if (quantas === 0) {
  await b.close();
  console.log(`\n${falhas} falha(s).`);
  process.exit(1);
}

const caixa = await medalhas.first().boundingBox();
ok(caixa !== null, 'a medalha tem caixa medível');
if (caixa) {
  ok(
    Math.abs(caixa.width - caixa.height) < 0.6,
    `a medalha é quadrada — ${caixa.width.toFixed(1)}x${caixa.height.toFixed(1)}. ` +
      'Era assim que o emoji falhava: a altura da linha achatava o glifo',
  );
  ok(caixa.width >= 36, `e não encolheu abaixo do pedido (${caixa.width.toFixed(1)}px)`);
}

/*
  Todas as doze, e não uma amostra: cada glifo é um `Path` escrito à mão, e cada
  um pode falhar sozinho. Medir uma medalha provaria que uma funciona.

  Duas leituras por medalha, porque são duas falhas diferentes:

  - **A caixa inteira** separa "o ícone não desenhou nada" (zero, porque o
    recorte fica todo da cor do cartão) da medalha bloqueada, que mede em torno
    de 17% — o disco dela assume a cor de superfície e some contra o cartão,
    então quem pinta é o anel e o glifo.

  - **O miolo** separa "este glifo não desenhou" de "desenhou". Ali não há anel
    nem disco: ou o caminho pintou, ou a leitura é zero.

  Os pisos ficam longe dos dois lados em ambos os casos, e nenhum encosta no
  valor medido — encostar seria ajustar o teste ao resultado.
*/
let piorCaixa = 1;
let piorMiolo = 1;
let piorIndice = -1;
for (let i = 0; i < quantas; i += 1) {
  const img = pixels(await medalhas.nth(i).screenshot());
  const caixaToda = fracaoPintada(img);
  const miolo = fracaoPintada(img, MARGEM_DO_MIOLO);
  piorCaixa = Math.min(piorCaixa, caixaToda);
  if (miolo < piorMiolo) {
    piorMiolo = miolo;
    piorIndice = i;
  }
}
console.log(
  `  >>> pior caixa: ${(piorCaixa * 100).toFixed(1)}% · ` +
    `pior miolo: ${(piorMiolo * 100).toFixed(1)}% (medalha #${piorIndice + 1})`,
);
ok(
  piorCaixa > 0.06,
  `todas as doze pintam alguma coisa (a pior: ${(piorCaixa * 100).toFixed(1)}%)`,
);
ok(piorCaixa < 0.98, 'e nenhuma é um quadrado chapado — o anel e o glifo estão lá');
ok(
  piorMiolo > 0.1,
  `e todos os doze glifos desenharam, não só o disco (o mais vazio: ${(piorMiolo * 100).toFixed(1)}%)`,
);

await b.close();
console.log(falhas === 0 ? '\nTudo certo.' : `\n${falhas} falha(s).`);
process.exit(falhas === 0 ? 0 : 1);
