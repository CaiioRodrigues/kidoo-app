/**
 * A Jornada de quem ainda não teve aula nenhuma — e o nome da criança no
 * gênero certo.
 *
 * Três coisas que o typecheck não vê:
 *
 * 1. **O gênero chegou na tela.** `src/lib/genero.ts` tem teste próprio
 *    (`npm run test:genero`), e ele prova que a função acerta os três casos.
 *    O que ele não prova é que alguma tela a chama: o estado de onde viemos
 *    era exatamente uma tela que escrevia "do" à mão para todo mundo, e
 *    continuaria escrevendo com a função existindo ao lado, sem erro nenhum.
 *    Por isso aqui a criança é menina: "Jornada da Alice" só aparece se o
 *    caminho inteiro estiver ligado.
 *
 * 2. **A tela vazia é um convite, não um inventário de faltas.** Antes daqui
 *    ela respondia três "ainda não" seguidos. O teste cobra as duas metades:
 *    o cartão de primeira vez presente, e as seções de saldo, modalidades e
 *    evolução ausentes. Só a primeira metade deixaria passar o quadro em que
 *    o cartão novo entra e os três blocos antigos continuam embaixo.
 *
 * 3. **O troféu é desenho da fonte de ícones, e ele pinta.** Era um emoji, e
 *    emoji quem desenha é o sistema: o Kidoo ficava com a cara do Android.
 *    Um glifo só basta para a fonte inteira — o presente da carteira de bônus
 *    usa a mesma fonte, e o nome do ícone é união de tipos, então errá-lo não
 *    compila. O que nenhum tipo pega é a fonte não carregar, e é isso que a
 *    leitura de pixels aqui separa.
 *
 * Roda contra o `expo export --platform web` servido em localhost, com o
 * backend em memória:
 *
 *   npx expo export --platform web
 *   npx http-server dist -p 8097 --silent -P "http://localhost:8097?" &
 *   npm run test:jornada
 */
import { chromium } from 'playwright';

import { fracaoPintada, pixels } from './lib/png.mjs';

const BASE = process.env.KIDOO_URL ?? 'http://localhost:8097/';
const executablePath = process.env.CHROMIUM_PATH || undefined;

let falhas = 0;
const ok = (c, d) => {
  console.log(`${c ? '  ok ' : 'FALHA'}  ${d}`);
  if (!c) falhas++;
};

/**
 * Piso do troféu. Medido: o glifo desenhado pinta 36,6% da caixa; com a fonte
 * de ícones fora do ar o recorte fica de uma cor só e a leitura é 0%. O piso
 * fica longe dos dois lados — encostar no valor medido seria ajustar o teste
 * ao resultado.
 */
const PISO_DO_TROFEU = 0.1;

/** Qualquer emoji pictográfico. O que a fonte de ícones desenha não é isto. */
const EMOJI = /\p{Extended_Pictographic}/u;

const b = await chromium.launch(executablePath ? { executablePath } : {});
const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });
const txt = () => p.evaluate(() => document.body.innerText);

// Cadastro inteiro: a Jornada só existe com criança cadastrada, e recarregar a
// página zeraria o backend em memória junto com ela.
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

console.log('\nO gênero da criança, na Home\n');

const home = await txt();
ok(home.includes('movimentar a Alice'), 'a saudação concorda: "movimentar a Alice"');
ok(!home.includes('movimentar o Alice'), 'e não sobrou o masculino fixo de antes');

// `innerText` devolve a frase inteira mesmo quando o CSS a corta na tela, então
// a asserção acima passaria com "movimentar a Alice h…" aparecendo para a
// família. Num aparelho de 390px era exatamente o que acontecia.
const cortada = await p.evaluate(() => {
  const el = [...document.querySelectorAll('div')].find(
    (e) => e.children.length === 0 && (e.textContent ?? '').startsWith('Como vamos movimentar'),
  );
  return el ? el.scrollWidth > el.clientWidth + 1 : null;
});
ok(cortada === false, 'e a frase cabe inteira na tela, sem reticências');

// Pela aba, e não por URL: recarregar zera o backend em memória.
await p.locator('a[href="/journey"]').last().click();
await p.waitForTimeout(2500);
ok(p.url().endsWith('/journey'), `abriu a Jornada (${p.url()})`);

console.log('\nO gênero da criança, na Jornada\n');

const jornada = await txt();
ok(jornada.includes('Jornada da Alice'), 'o título concorda: "Jornada da Alice"');
ok(!jornada.includes('Jornada do Alice'), 'e não sobrou "Jornada do Alice"');

console.log('\nA primeira visita: um convite no lugar de três ausências\n');

ok(
  jornada.includes('A jornada da Alice começa na primeira aula'),
  'o cartão de primeira vez está na tela — e também concorda em gênero',
);
ok(jornada.includes('Explorar atividades'), 'e oferece para onde ir');

for (const secao of ['Moedas bônus', 'Minhas atividades', 'Minha evolução']) {
  ok(!jornada.includes(secao), `a seção "${secao}" não aparece com zero aula`);
}
ok(
  jornada.includes('Minhas conquistas'),
  'as conquistas ficam — são a única parte da tela vazia que promete em vez de constatar falta',
);

// O mascote já sumiu uma vez sem nenhum teste acusar: o elemento fica na
// árvore, do tamanho certo, e o arquivo é que não chega.
const guara = p.locator('img[alt="O guará, mascote do Kidoo"]').filter({ visible: true });
const temGuara = (await guara.count()) === 1;
ok(temGuara, 'o guará está no cartão');
if (temGuara) {
  // `naturalWidth` é o que separa as duas falhas: o elemento continua na
  // árvore, com a caixa do tamanho pedido, quando o arquivo é que não chega.
  const largura = await guara.evaluate((el) => el.naturalWidth);
  ok(largura > 0, `e a arte dele carregou de verdade (${largura}px de origem)`);
}

console.log('\nO troféu do XP: fonte de ícones, não emoji\n');

ok(!EMOJI.test(jornada), 'nenhum emoji sobrou no texto da tela');

// O distintivo amarelo do XP tem exatamente dois filhos: o glifo e o número.
// Marcar o primeiro por aí é mais firme que pescar o primeiro Ionicons da
// página — a tela tem outros, e a ordem deles não é contrato de nada.
const marcou = await p.evaluate(() => {
  const alvo = [...document.querySelectorAll('div')].find(
    (el) => el.children.length === 2 && /^\d+ XP$/.test(el.children[1]?.textContent ?? ''),
  );
  if (!alvo) return false;
  alvo.children[0].setAttribute('data-teste', 'trofeu');
  return true;
});
ok(marcou, 'achou o distintivo de XP no cabeçalho');

if (marcou) {
  const glifo = p.locator('[data-teste="trofeu"]');
  const caixa = await glifo.boundingBox();
  ok(
    caixa !== null && caixa.width >= 12,
    `o glifo tem caixa medível (${caixa?.width.toFixed(1)}px)`,
  );
  const pintado = fracaoPintada(pixels(await glifo.screenshot()));
  console.log(`  >>> o troféu pintou ${(pintado * 100).toFixed(1)}% da caixa`);
  ok(
    pintado > PISO_DO_TROFEU,
    `o troféu desenhou (${(pintado * 100).toFixed(1)}%) — fonte que não carrega ` +
      'deixa o recorte de uma cor só, e a leitura cai para perto de zero',
  );
}

console.log('\nO botão leva para onde diz\n');

await p.getByText('Explorar atividades').last().click();
await p.waitForTimeout(2000);
ok(p.url().endsWith('/explore'), `"Explorar atividades" abriu o Explorar (${p.url()})`);

await b.close();
console.log(falhas === 0 ? '\nTudo certo.\n' : `\n${falhas} falha(s).\n`);
process.exit(falhas === 0 ? 0 : 1);
