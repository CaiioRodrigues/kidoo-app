/**
 * Uma família cadastra o segundo filho — e não passa de novo pela tela de planos.
 *
 * Este arquivo existe por causa de duas coisas que o typecheck não vê:
 *
 *   1. O botão de cadastrar criança só aparecia com a lista vazia, então quem
 *      tinha o primeiro filho cadastrado não tinha por onde cadastrar o
 *      segundo. O banco sempre aceitou vários; era a tela que fechava a porta.
 *
 *   2. `subscribe_plan` resolve o conflito com `renews_at = excluded.renews_at`.
 *      Mandar quem já assina para a tela de planos e deixar confirmar empurra a
 *      renovação um mês para a frente — um mês grátis por filho, sem nada na
 *      tela denunciando. É erro de cobrança, e cobrança não se confere de olho.
 *
 * Roda contra o `expo export --platform web` servido em localhost, com o
 * backend em memória:
 *
 *   npx expo export --platform web
 *   npx http-server dist -p 8099 --silent &
 *   npm run test:irmaos
 *
 * Precisa do `playwright` instalado (`npm i --no-save playwright`); o Chromium
 * do ambiente é encontrado por PLAYWRIGHT_BROWSERS_PATH ou por CHROMIUM_PATH.
 */
import { chromium } from 'playwright';

const BASE = process.env.KIDOO_URL ?? 'http://localhost:8099/';
const executablePath = process.env.CHROMIUM_PATH || undefined;

const b = await chromium.launch(executablePath ? { executablePath } : {});
const p = await b.newPage({ viewport: { width: 390, height: 844 } });
const txt = () => p.evaluate(() => document.body.innerText);
let falhas = 0;
const ok = (c, d) => {
  console.log(`${c ? '  ok ' : 'FALHA'}  ${d}`);
  if (!c) falhas++;
};

// Quantos pontinhos o StepIndicator está mostrando.
const pontos = () =>
  p.evaluate(() => {
    const alvos = [...document.querySelectorAll('div')].filter((el) => {
      const s = getComputedStyle(el);
      const l = parseFloat(s.height);
      return (
        l >= 4 &&
        l <= 12 &&
        parseFloat(s.borderTopLeftRadius) >= l / 2 - 0.5 &&
        el.childElementCount === 0 &&
        parseFloat(s.width) >= 4
      );
    });
    return alvos.length;
  });

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

console.log('\n--- primeira criança (família sem plano) ---');
ok(p.url().endsWith('/child'), 'abriu o cadastro da criança');
ok((await pontos()) === 4, `indicador com 4 etapas (veio ${await pontos()})`);
campos = p.locator('input');
await campos.nth(0).fill('Alice Rodrigues');
await campos.nth(1).fill('10/05/2018');
await p.getByText('Menina').click();
await p.getByText('Continuar').last().click();
await p.waitForTimeout(1500);
ok(p.url().endsWith('/interests'), 'foi para interesses');
const tPrimeira = await txt();
ok(
  tPrimeira.includes('Continuar') && !tPrimeira.includes('Concluir cadastro'),
  'botão diz "Continuar" (ainda falta o plano)',
);
await p.getByText('Futebol', { exact: true }).last().click();
await p.getByText('Continuar').last().click();
await p.waitForTimeout(1800);
ok(p.url().endsWith('/plan'), `foi para a tela de planos (${p.url()})`);
await p.getByText('Escolher plano').last().click();
await p.waitForTimeout(2200);
ok(p.url().endsWith('/home'), `chegou na Home (${p.url()})`);

// O tutorial abre por cima da Home na primeira visita e intercepta os toques.
// O tutorial monta com animação, depois da Home. Esperar por ele e fechar —
// e só seguir quando o botão de fechar tiver saído da árvore, senão ele
// continua cobrindo a tela inteira e engolindo os toques seguintes.
const pular = p.getByLabel('Pular tutorial');
await pular.waitFor({ state: 'visible', timeout: 15000 });
await pular.click();
await p.waitForTimeout(1200);
ok((await p.getByLabel('Fechar tutorial').count()) === 0, 'o tutorial foi fechado');

console.log('\n--- segunda criança (família já com plano) ---');
// Pela aba, e não por URL: o export é uma página só, e recarregar zeraria
// o backend em memória junto com a família que acabamos de cadastrar.
await p.getByLabel('Abrir perfil').filter({ visible: true }).last().click();
await p.waitForTimeout(2000);
ok(p.url().endsWith('/profile'), `abriu a tela de Perfil (${p.url()})`);
const perfil = await txt();
ok(perfil.includes('Adicionar outra criança'), 'o Perfil oferece adicionar outra criança');
ok(perfil.includes('Alice'), 'a primeira criança está listada');

await p.getByText('Adicionar outra criança').last().click();
await p.waitForTimeout(1600);
ok(p.url().endsWith('/child'), `abriu o cadastro (${p.url()})`);
ok((await pontos()) === 2, `indicador com 2 etapas (veio ${await pontos()})`);
campos = p.locator('input:not([readonly])');
ok((await campos.nth(0).inputValue()) === '', 'o formulário veio em branco, sem o nome do irmão');
// A Home segue montada atrás da rota; o campo de busca dela é `readonly` e
// entrava no seletor genérico de `input`.
const form = p.locator('input:not([readonly])');
await form.nth(0).fill('Bento Rodrigues');
await form.nth(1).fill('03/02/2021');
await p.getByText('Menino').click();
await p.getByText('Continuar').last().click();
await p.waitForTimeout(1600);
ok(p.url().endsWith('/interests'), 'foi para interesses');
const t = await txt();
ok(t.includes('Concluir cadastro'), 'o botão diz "Concluir cadastro", não "Continuar"');
await p.getByText('Natação', { exact: true }).last().click();
await p.getByText('Concluir cadastro').last().click();
await p.waitForTimeout(2500);
ok(p.url().endsWith('/home'), `foi direto para a Home, pulando os planos (${p.url()})`);

await p.getByLabel('Abrir perfil').filter({ visible: true }).last().click();
await p.waitForTimeout(2000);
ok(p.url().endsWith('/profile'), `voltou ao Perfil (${p.url()})`);
const final = await txt();
ok(final.includes('Alice') && final.includes('Bento'), 'as duas crianças aparecem no Perfil');

console.log(falhas === 0 ? '\nTudo certo.' : `\n${falhas} falha(s).`);
await b.close();
process.exit(falhas === 0 ? 0 : 1);
