/**
 * O Kidoo Coin está desenhado na tela — e é uma moeda, não um buraco.
 *
 * Duas metades, porque o defeito tinha duas causas:
 *
 * 1. **O emoji não pode voltar.** `🪙` é U+1FA99, do Emoji 12.0 (2019): em
 *    Android 9 e anteriores ele não existe e vira quadradinho, e o `minSdk` do
 *    projeto é 24 (Android 7). Além disso emoji é desenhado pela fonte do
 *    sistema, com métricas mais altas que as da Poppins — dentro de uma
 *    variante de texto com `lineHeight` fixo, o Android corta o glifo. Era a
 *    metade de moeda que aparecia na Home.
 *
 * 2. **O desenho tem de pintar.** Contar o elemento não basta: um componente
 *    que renderiza nada deixa o layout intacto e o espaço do tamanho certo —
 *    foi exatamente assim que o mascote sumiu da abertura sem nenhum teste
 *    acusar. Então aqui os pixels são lidos de verdade, e a asserção é sobre
 *    quanto da caixa está pintada de amarelo.
 *
 * Roda contra o `expo export --platform web` servido em localhost:
 *
 *   npx expo export --platform web
 *   npx http-server dist -p 8095 --silent -P "http://localhost:8095?" &
 *   npm run test:moeda
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { inflateSync } from 'node:zlib';
import { chromium } from 'playwright';

const BASE = process.env.KIDOO_URL ?? 'http://localhost:8095/';
const executablePath = process.env.CHROMIUM_PATH || undefined;

/** O amarelo da face, como `CoinIcon` o define. */
const FACE = [0xff, 0xc8, 0x39];
const MOEDA = '\u{1FA99}';

let falhas = 0;
const ok = (c, d) => {
  console.log(`${c ? '  ok ' : 'FALHA'}  ${d}`);
  if (!c) falhas += 1;
};

// ------------------------------------------------ metade 1: o código-fonte --

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

console.log('O emoji da moeda não voltou\n');

const comEmoji = [];
for (const raiz of ['src', 'app']) {
  for (const arquivo of arquivos(raiz)) {
    for (const [i, linha] of readFileSync(arquivo, 'utf8').split('\n').entries()) {
      if (!linha.includes(MOEDA)) continue;
      // O próprio `CoinIcon` cita o emoji para explicar por que ele saiu. Linha
      // de comentário não chega à tela de ninguém.
      const cru = linha.trim();
      if (cru.startsWith('*') || cru.startsWith('//') || cru.startsWith('/*')) continue;
      comEmoji.push(`${arquivo}:${i + 1}`);
    }
  }
}
for (const c of comEmoji) console.error(`FALHA  ${c} usa o emoji da moeda`);
ok(comEmoji.length === 0, 'nenhuma tela usa o emoji da moeda — só comentário explicando');

// ------------------------------------------------- metade 2: o que é pintado --

/**
 * PNG → pixels.
 *
 * Escrito à mão porque não há decodificador de imagem entre as dependências, e
 * carregar um pacote inteiro para contar pixels amarelos seria desproporcional.
 *
 * Cobre 8 bits em RGB e em RGBA: o Playwright entrega um ou outro conforme o
 * recorte tenha transparência, e a primeira versão disto assumia RGBA e
 * desistia num PNG perfeitamente válido. Os cinco filtros estão implementados
 * pelo mesmo motivo — o codificador escolhe um por linha, e não cabe a este
 * script opinar sobre a escolha.
 */
function pixels(buffer) {
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
function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
}

/** Quanto da imagem está perto do amarelo da face, de 0 a 1. */
function fracaoAmarela({ largura, altura, canais, dados }) {
  let amarelos = 0;
  for (let i = 0; i < largura * altura; i += 1) {
    const base = i * canais;
    const [r, g, b] = [dados[base], dados[base + 1], dados[base + 2]];
    const perto =
      Math.abs(r - FACE[0]) < 26 && Math.abs(g - FACE[1]) < 26 && Math.abs(b - FACE[2]) < 26;
    if (perto) amarelos += 1;
  }
  return amarelos / (largura * altura);
}

const b = await chromium.launch(executablePath ? { executablePath } : {});
const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });

await p.goto(BASE, { waitUntil: 'networkidle' });
await p.waitForTimeout(4500);
await p.getByText('Continuar como visitante').click();
await p.waitForTimeout(3000);
const pular = p.getByLabel('Pular tutorial');
if (await pular.count()) {
  await pular.click();
  await p.waitForTimeout(1000);
}

console.log('\nA moeda desenhada, na Home\n');

// A etiqueta do custo da turma, que é onde a moeda aparece em toda listagem.
const etiqueta = p.getByText('coins', { exact: false }).first();
await etiqueta.scrollIntoViewIfNeeded();
await p.waitForTimeout(500);
ok((await etiqueta.count()) > 0, 'a etiqueta de custo está na tela');

const svg = p.locator('svg').filter({ has: p.locator('circle[fill="#FFC839"]') });
const quantas = await svg.count();
ok(quantas > 0, `há moeda desenhada na tela (${quantas})`);

// Sem moeda nenhuma, o resto não tem o que medir — e a primeira versão disto
// morria num timeout cru do Playwright em vez de dizer o que faltou.
if (quantas === 0) {
  await b.close();
  console.log(`\n${falhas} falha(s).`);
  process.exit(1);
}

const caixa = await svg.first().boundingBox();
ok(caixa !== null, 'a moeda tem caixa medível');
if (caixa) {
  ok(
    Math.abs(caixa.width - caixa.height) < 0.6,
    `a moeda é quadrada — ${caixa.width.toFixed(1)}x${caixa.height.toFixed(1)}. ` +
      'Era assim que o emoji falhava: a altura da linha achatava o glifo',
  );
  ok(caixa.width >= 12, `e não encolheu abaixo do pedido (${caixa.width.toFixed(1)}px)`);
}

const recorte = await svg.first().screenshot();
const img = pixels(recorte);
const fracao = fracaoAmarela(img);
console.log(`  >>> ${img.largura}x${img.altura} pixels, ${(fracao * 100).toFixed(1)}% amarelo`);

/*
  O piso é escolhido pelo que ele precisa separar, não pelo número que saiu.

  A falha que importa — componente que não desenha nada, deixando a caixa do
  tamanho certo e vazia — dá zero. Uma moeda inteira mede em torno de 35%: o
  disco ocupa π/4 do quadrado, o anel e o K comem um pedaço, e a 13px de tela
  boa parte da borda é mistura de antisserrilhado, que não conta como amarelo.

  20% fica longe dos dois: bem acima do zero que a falha produz, e com folga
  para um ajuste de espessura do anel não derrubar o teste. Encostar o piso nos
  35,7% medidos seria ajustar o teste ao resultado.
*/
ok(fracao > 0.2, `a face está pintada de amarelo (${(fracao * 100).toFixed(1)}%)`);
ok(fracao < 0.95, 'e não é um quadrado amarelo cheio — o anel e o K estão lá');

await b.close();
console.log(falhas === 0 ? '\nTudo certo.' : `\n${falhas} falha(s).`);
process.exit(falhas === 0 ? 0 : 1);
