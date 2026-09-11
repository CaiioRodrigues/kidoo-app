/**
 * Esqueci minha senha — o caminho inteiro, no painel do parceiro.
 *
 * O painel tem uma armadilha que o app não tem: ele roda com
 * `detectSessionInUrl: true`, então o cliente do Supabase lê os tokens do fim
 * da URL e abre a sessão sozinho. Para o link de confirmação isso é o
 * desejado; para o de redefinição seria um buraco — o parceiro pediria senha
 * nova, clicaria no e-mail, cairia no painel logado, e a senha antiga
 * continuaria valendo, sem nada na tela dizendo que o pedido não se completou.
 *
 * Por isso as duas asserções centrais aqui são negativas: não cair na vitrine
 * e não cair no painel. E por isso o link de confirmação é testado junto —
 * confundir os dois inverte as telas.
 *
 *   cd partner && npm run build:demo
 *   npx http-server partner/dist -p 8098 --silent &
 *   npm run test:senha-painel
 */
import { chromium } from 'playwright';

const BASE = process.env.PAINEL_URL ?? 'http://localhost:8098';
const executablePath = process.env.CHROMIUM_PATH || undefined;

const b = await chromium.launch(executablePath ? { executablePath } : {});
let p = await b.newPage({ viewport: { width: 1280, height: 900 } });
const txt = () => p.evaluate(() => document.body.innerText);
let f = 0;
const ok = (c, d) => {
  console.log(`${c ? '  ok ' : 'FALHA'}  ${d}`);
  if (!c) f++;
};

/*
  Cada link de e-mail é um carregamento novo da página. Trocar só o `#` na
  mesma aba é navegação no mesmo documento: o módulo não roda de novo, e a
  leitura do endereço — que acontece no carregamento, antes de o cliente do
  Supabase limpar a URL — ficaria com o valor da visita anterior.
*/
const abrir = async (caminho) => {
  await p.close();
  p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  await p.goto(`${BASE}${caminho}`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(1500);
};

console.log('--- pedir o link ---');
await p.goto(`${BASE}/`, { waitUntil: 'networkidle' });
await p.waitForTimeout(1200);
await p.getByText('Entrar', { exact: true }).first().click();
await p.waitForTimeout(900);
let t = await txt();
ok(t.includes('Esqueci minha senha'), 'o login oferece recuperar a senha');
await p.getByText('Esqueci minha senha').click();
await p.waitForTimeout(600);
t = await txt();
ok(t.includes('Recuperar acesso'), 'abriu a tela de recuperar');
ok(!t.includes('Senha'), 'o campo de senha some — não faz sentido para quem a esqueceu');
await p.locator('#email').fill('nao-existe@exemplo.com');
await p.getByText('Mandar o link').click();
await p.waitForTimeout(1200);
t = await txt();
ok(t.includes('Confira seu e-mail'), 'confirmou o envio');
ok(
  t.includes('Se ') && t.includes('tiver conta'),
  'a frase é condicional: não revela se o e-mail tem conta',
);

console.log('\n--- chegar pelo link ---');
await abrir('/#access_token=a.b.c&refresh_token=xyz&type=recovery');
t = await txt();
ok(t.includes('Escolha a senha nova'), 'o link de recuperação para na tela da senha nova');
// Afirmação sobre o que a falha produziria de fato: sem a interceptação, o
// link cai na vitrine (ou no painel, quando há sessão). A versão anterior
// desta linha checava a ausência de "Agenda" e passava mesmo sabotada — ela
// afirmava mais do que testava.
ok(
  !t.includes('Para estabelecimentos') && !t.includes('Agenda'),
  'não caiu na vitrine nem no painel — a troca de senha vem antes',
);
await p.locator('#nova').fill('kidoo12345');
await p.locator('#repetida').fill('kidoo54321');
await p.getByText('Salvar e entrar').click();
await p.waitForTimeout(700);
ok((await txt()).includes('precisam ser iguais'), 'senhas diferentes são recusadas');
await p.locator('#repetida').fill('kidoo12345');
await p.getByText('Salvar e entrar').click();
await p.waitForTimeout(2000);
t = await txt();
ok(!t.includes('Escolha a senha nova'), 'saiu da tela da senha depois de salvar');

console.log('\n--- link de confirmação NÃO é confundido ---');
await abrir('/#access_token=a.b.c&refresh_token=xyz&type=signup');
ok(
  !(await txt()).includes('Escolha a senha nova'),
  'o link de confirmação não abre a tela de senha nova',
);

console.log('\n--- link vencido ---');
await abrir(
  '/#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired',
);
t = await txt();
ok(t.includes('expirou'), 'link vencido é explicado, não vira login mudo');

console.log(f === 0 ? '\nTudo certo.' : `\n${f} falha(s).`);
await b.close();
process.exit(f === 0 ? 0 : 1);
