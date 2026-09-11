/**
 * Esqueci minha senha — o caminho inteiro, no app.
 *
 * Este arquivo existe porque até agora não havia caminho nenhum: quem esquecia
 * a senha ficava trancado para fora do Kidoo para sempre. Três coisas aqui não
 * se conferem de olho:
 *
 *   1. A tela responde a MESMA coisa para e-mail com conta e sem conta. Dizer
 *      "não encontramos este e-mail" seria simpático e seria um vazamento —
 *      quem quisesse saber quais famílias são clientes bastaria digitar uma
 *      lista aqui.
 *
 *   2. O link de redefinição PARA na tela da senha nova. Ele abre uma sessão,
 *      então sem essa parada a pessoa cairia na Home com a senha antiga ainda
 *      valendo: ela pediu a troca, clicou no e-mail, e nada aconteceu.
 *
 *   3. O link vencido é explicado. Sem isso ele vira uma tela muda, e a pessoa
 *      tenta o mesmo link de novo.
 *
 * Roda contra o `expo export --platform web` com backend em memória, servido
 * COM fallback de SPA — a tela da senha nova é alcançada por endereço direto:
 *
 *   npx expo export --platform web
 *   npx http-server dist -p 8097 --silent -P "http://localhost:8097?" &
 *   npm run test:senha
 *
 * Precisa do `playwright` (`npm i --no-save playwright`); o Chromium do
 * ambiente vem de CHROMIUM_PATH quando não é o padrão.
 */
import { chromium } from 'playwright';

const BASE = process.env.KIDOO_URL ?? 'http://localhost:8097';
const executablePath = process.env.CHROMIUM_PATH || undefined;

const b = await chromium.launch(executablePath ? { executablePath } : {});
const txt = (pg) => pg.evaluate(() => document.body.innerText);
let f = 0;
const ok = (c, d) => {
  console.log(`${c ? '  ok ' : 'FALHA'}  ${d}`);
  if (!c) f++;
};

/*
  Cada link de e-mail é um carregamento novo da página. Reaproveitar a aba e
  trocar só o `#` é navegação no mesmo documento: o app não remonta, e a
  leitura do endereço ficaria com o valor da visita anterior.
*/
const abrir = async (caminho) => {
  const pg = await b.newPage({ viewport: { width: 390, height: 844 } });
  await pg.goto(`${BASE}${caminho}`, { waitUntil: 'networkidle' });
  await pg.waitForTimeout(5000);
  return pg;
};

const RECUPERACAO = '/nova-senha#access_token=a.b.c&refresh_token=xyz&type=recovery';
const VENCIDO =
  '/nova-senha#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired';

console.log('--- pedir o link ---');
let p = await abrir('/');
await p.getByText('Entrar', { exact: true }).first().click();
await p.waitForTimeout(1500);
let t = await txt(p);
ok(p.url().endsWith('/sign-in'), `abriu o login (${p.url()})`);
ok(t.includes('Esqueci minha senha'), 'o login oferece recuperar a senha');

// O e-mail já digitado tem de viajar junto.
await p.locator('input:not([readonly])').nth(0).fill('caio@exemplo.com');
await p.getByText('Esqueci minha senha').last().click();
await p.waitForTimeout(1500);
ok(p.url().includes('forgot-password'), `abriu a tela de recuperar (${p.url()})`);
const preenchido = await p.locator('input:not([readonly])').first().inputValue();
ok(preenchido === 'caio@exemplo.com', `o e-mail veio junto (veio "${preenchido}")`);

await p.getByText('Mandar o link').last().click();
await p.waitForTimeout(1800);
t = await txt(p);
ok(t.includes('Confira seu e-mail'), 'confirmou o envio');
ok(t.includes('tiver conta no Kidoo'), 'a frase é condicional: não revela quem tem conta');

console.log('\n--- chegar pelo link ---');
await p.close();
p = await abrir(RECUPERACAO);
t = await txt(p);
ok(
  t.includes('Escolha a senha nova'),
  `parou para pedir a senha nova (${t.slice(0, 60).replace(/\n/g, ' | ')})`,
);
ok(!t.includes('Recomendados'), 'NÃO caiu na Home com a senha antiga ainda valendo');

const campos = p.locator('input:not([readonly])');
await campos.nth(0).fill('kidoo12345');
await campos.nth(1).fill('kidoo54321');
await p.getByText('Salvar e entrar').last().click();
await p.waitForTimeout(900);
ok((await txt(p)).includes('precisam ser iguais'), 'senhas diferentes são recusadas');

await campos.nth(1).fill('kidoo12345');
await p.getByText('Salvar e entrar').last().click();
await p.waitForTimeout(2500);
ok(p.url().endsWith('/home'), `salvou e entrou (${p.url()})`);
await p.close();

console.log('\n--- senha curta ---');
p = await abrir(RECUPERACAO);
const c2 = p.locator('input:not([readonly])');
await c2.nth(0).fill('kid1');
await c2.nth(1).fill('kid1');
await p.getByText('Salvar e entrar').last().click();
await p.waitForTimeout(900);
ok((await txt(p)).includes('8 caracteres'), 'senha curta é recusada antes de ir ao servidor');
await p.close();

console.log('\n--- link vencido ---');
p = await abrir(VENCIDO);
t = await txt(p);
ok(t.includes('não vale mais') || t.includes('expirou'), 'link vencido é explicado');
ok(t.includes('Pedir um link novo'), 'e oferece a saída');
await p.close();

console.log(f === 0 ? '\nTudo certo.' : `\n${f} falha(s).`);
await b.close();
process.exit(f === 0 ? 0 : 1);
