/**
 * Trocar de criança — o caminho inteiro, com dois filhos cadastrados.
 *
 * O chip da Home tinha a setinha para baixo desde o primeiro dia e nunca abriu
 * nada: `Chip` sem `onPress` não é nem pressionável, então o que parecia um
 * seletor era desenho. Com dois filhos, a família via sempre o último
 * cadastrado na sessão — e, depois de reabrir o app, sempre o primeiro da
 * lista. Não havia por onde mudar, nem na Home nem na Jornada.
 *
 * O typecheck nunca veria isso: uma prop opcional que ninguém passa está
 * certa em TypeScript. Só o navegador diz se a gaveta abre.
 *
 * O chip de cidade entra junto pelo motivo inverso: ele PERDEU a setinha, e
 * ela não pode voltar sem querer. O Kidoo só tem catálogo em Belo Horizonte,
 * e prometer uma escolha que não existe é o mesmo defeito com outro nome.
 *
 *   npx expo export --platform web
 *   npx http-server dist -p 8099 --silent -P "http://localhost:8099?" &
 *   npm run test:troca-de-crianca
 *
 * Precisa do `playwright` instalado (`npm i --no-save playwright`); o Chromium
 * do ambiente é encontrado por PLAYWRIGHT_BROWSERS_PATH ou por CHROMIUM_PATH.
 */
import { chromium } from 'playwright';

/* Sem barra no fim, sempre — e cada uso escreve a sua. */
const BASE = (process.env.KIDOO_URL ?? 'http://localhost:8099').replace(/\/+$/, '');
const executablePath = process.env.CHROMIUM_PATH || undefined;

const b = await chromium.launch(executablePath ? { executablePath } : {});
const p = await b.newPage({ viewport: { width: 390, height: 844 } });
const txt = () => p.evaluate(() => document.body.innerText);
let falhas = 0;
const ok = (c, d) => {
  console.log(`${c ? '  ok ' : 'FALHA'}  ${d}`);
  if (!c) falhas++;
};

const botao = (nome) => p.getByRole('button', { name: nome }).filter({ visible: true });

// ---- a família, com dois filhos -------------------------------------------
await p.goto(BASE, { waitUntil: 'networkidle' });
await p.waitForTimeout(4500);
await p.getByText('Criar conta', { exact: true }).first().click();
await p.waitForTimeout(1200);
let campos = p.locator('input');
await campos.nth(0).fill('Caio Rodrigues');
await campos.nth(1).fill('caio@exemplo.com');
await campos.nth(2).fill('kidoo12345');
await p.getByText('Li e aceito').click();
await p.getByText('Criar conta', { exact: true }).last().click();
await p.waitForTimeout(1800);

campos = p.locator('input');
await campos.nth(0).fill('Alice Rodrigues');
await campos.nth(1).fill('10/05/2018');
await p.getByText('Menina').click();
await p.getByText('Continuar').last().click();
await p.waitForTimeout(1500);
await p.getByText('Futebol', { exact: true }).last().click();
await p.getByText('Continuar').last().click();
await p.waitForTimeout(1800);
await p.getByText('Escolher plano').last().click();
await p.waitForTimeout(2200);

const pular = p.getByLabel('Pular tutorial');
await pular.waitFor({ state: 'visible', timeout: 15000 });
await pular.click();
await p.waitForTimeout(1200);

await p.getByLabel('Abrir perfil').filter({ visible: true }).last().click();
await p.waitForTimeout(2000);
await p.getByText('Adicionar outra criança').last().click();
await p.waitForTimeout(1600);
let form = p.locator('input:not([readonly])');
await form.nth(0).fill('Bento Rodrigues');
await form.nth(1).fill('03/02/2021');
await p.getByText('Menino').click();
await p.getByText('Continuar').last().click();
await p.waitForTimeout(1600);
await p.getByText('Natação', { exact: true }).last().click();
await p.getByText('Concluir cadastro').last().click();
await p.waitForTimeout(2500);
ok(p.url().endsWith('/home'), `as duas crianças cadastradas, de volta na Home (${p.url()})`);

// ---- o chip abre de verdade ------------------------------------------------
console.log('\n--- o chip da Home ---');
let t = await txt();
ok(t.includes('movimentar o Bento'), 'a Home está no Bento, o último cadastrado');

const chipCrianca = botao(/^Bento/);
ok((await chipCrianca.count()) > 0, 'o chip da criança é um botão de verdade');
await chipCrianca.first().click();
await p.waitForTimeout(900);
t = await txt();
ok(t.includes('Quem vai se movimentar?'), 'a gaveta abriu');
ok(t.includes('Alice') && t.includes('Bento'), 'as duas crianças estão na gaveta');
ok(t.includes('Adicionar outra criança'), 'e dá para cadastrar mais uma por ali');

// ---- fechar pelo fundo -----------------------------------------------------
await botao('Fechar').first().click();
await p.waitForTimeout(800);
ok(!(await txt()).includes('Quem vai se movimentar?'), 'o toque no fundo fecha a gaveta');

// ---- a troca muda a tela ---------------------------------------------------
console.log('\n--- a troca ---');
await botao(/^Bento/).first().click();
await p.waitForTimeout(900);
await botao(/^Alice/).first().click();
await p.waitForTimeout(1600);
t = await txt();
ok(!t.includes('Quem vai se movimentar?'), 'escolher fecha a gaveta');
ok(t.includes('movimentar a Alice'), 'a saudação passou para a Alice');
ok(t.includes('Recomendados para Alice'), 'e as recomendações também');

// ---- a cidade não promete o que não tem ------------------------------------
console.log('\n--- o chip de cidade ---');
ok(
  (await botao('Belo Horizonte').count()) === 0,
  'a cidade não é botão: não há segunda cidade para escolher',
);
ok((await txt()).includes('Belo Horizonte'), 'mas ela continua escrita na tela');

// ---- a Jornada troca pelo cartão do topo -----------------------------------
console.log('\n--- a Jornada ---');
await p.getByText('Jornada', { exact: true }).filter({ visible: true }).last().click();
await p.waitForTimeout(2500);
// A Home segue montada atrás no export web, então o texto da página tem as
// duas telas. O título da Jornada carrega o nome e o artigo, e só existe lá.
t = await txt();
ok(t.includes('Jornada da Alice'), 'a Jornada abriu na Alice');
ok(!t.includes('Jornada do Bento'), 'e não na do irmão');

const cartao = p.getByLabel(/trocar de criança/).filter({ visible: true });
ok((await cartao.count()) > 0, 'o cartão do topo diz que troca de criança');
await cartao.first().click();
await p.waitForTimeout(900);
ok((await txt()).includes('Quem vai se movimentar?'), 'a mesma gaveta abre aqui');
await botao(/^Bento/).first().click();
await p.waitForTimeout(1800);
t = await txt();
ok(t.includes('Jornada do Bento'), 'a Jornada trocou para o Bento, com o artigo certo');

console.log(falhas === 0 ? '\nTudo certo.' : `\n${falhas} falha(s).`);
await b.close();
process.exit(falhas === 0 ? 0 : 1);
