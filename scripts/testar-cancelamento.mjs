/**
 * O que a tela promete antes de você desmarcar.
 *
 * Roda com `npm run test:cancelamento`. É o único ponto do sistema em que a
 * família decide sabendo — ou não sabendo — que vai perder o coin.
 *
 * A regra nova tem um corte em cinco horas. Com folga, o coin volta. Em cima
 * da hora, não volta, e o parceiro recebe pelo lugar que segurou. Se o aviso
 * não mudar junto com o desfecho, a tela mente exatamente onde a pessoa ainda
 * podia desistir de desistir — e o relato que chega depois não é "o aviso
 * estava errado", é "sumiram meus coins".
 *
 * Na web `confirmAction` usa o `confirm` do navegador, e o Playwright entrega
 * o texto dele. Então dá para ler a promessa, palavra por palavra, sem depender
 * de como ela é desenhada.
 *
 * O prazo em si — de que lado do corte cada instante cai — é `test:prazo`, que
 * roda sem navegador. Aqui a pergunta é outra: a tela conta a verdade?
 *
 * Roda contra o `expo export --platform web` servido em localhost:
 *
 *   npx expo export --platform web
 *   npx http-server dist -p 8095 --silent -P "http://localhost:8095?" &
 *   npm run test:cancelamento
 */
import { chromium } from 'playwright';

const BASE = process.env.KIDOO_URL ?? 'http://localhost:8095/';
const executablePath = process.env.CHROMIUM_PATH || undefined;

const b = await chromium.launch(executablePath ? { executablePath } : {});
const p = await b.newPage({ viewport: { width: 390, height: 844 } });

let falhas = 0;
const ok = (c, d) => {
  console.log(`${c ? '  ok ' : 'FALHA'}  ${d}`);
  if (!c) falhas += 1;
};

// ------------------------------------------------------------- cadastro -----

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
await p.getByText('Judô', { exact: true }).last().click();
await p.getByText('Continuar').last().click();
await p.waitForTimeout(1800);
await p.getByText('Escolher plano').last().click();
await p.waitForTimeout(2400);
const pular = p.getByLabel('Pular tutorial');
await pular.waitFor({ state: 'visible', timeout: 20000 });
await pular.click();
await p.waitForTimeout(1200);

// ---------------------------------------------------- reserva e diálogo -----

/**
 * Reserva a primeira turma que aceitar, começando pelo dia pedido.
 *
 * `'perto'` procura da primeira data para a frente — no catálogo do mock a
 * turma de hoje começa em minutos, dentro do prazo. `'longe'` procura da última
 * para trás, onde há folga de dias.
 */
async function reservar(lado) {
  await p.getByLabel('Judô Kids, Dojo Savassi').filter({ visible: true }).first().click();
  await p.waitForTimeout(2500);

  const dias = p.getByLabel(/dia \d+, \d+ turma/).filter({ visible: true });
  const total = await dias.count();
  const ordem = lado === 'perto' ? [...Array(total).keys()] : [...Array(total).keys()].reverse();

  for (const i of ordem) {
    await dias.nth(i).click();
    await p.waitForTimeout(900);
    const turma = p.getByRole('button', { name: /vagas?, \d+ coins/ }).filter({ visible: true });
    if ((await turma.count()) === 0) continue;
    await turma.first().click();
    await p.waitForTimeout(1300);
    await p.getByText('Confirmar reserva').last().click();
    await p.waitForTimeout(2600);
    return /\/booking\//.test(p.url());
  }
  return false;
}

/** Toca em cancelar e devolve o texto do diálogo, sem confirmar. */
async function textoDoAviso() {
  let mensagem = null;
  const ouvir = (d) => {
    mensagem = d.message();
    void d.dismiss();
  };
  p.on('dialog', ouvir);
  const botao = p.getByRole('button', { name: /Cancelar reserva|Desmarcar/ }).filter({
    visible: true,
  });
  if ((await botao.count()) === 0) {
    p.off('dialog', ouvir);
    return null;
  }
  await botao.first().click();
  await p.waitForTimeout(1200);
  p.off('dialog', ouvir);
  return mensagem;
}

console.log('Com folga de prazo\n');

ok(await reservar('longe'), 'reservou uma turma distante');
const comFolga = await textoDoAviso();
console.log(`  >>> ${String(comFolga).replace(/\n+/g, ' | ')}`);
ok(comFolga !== null, 'o botão de cancelar abre um aviso');
ok(
  /voltam para a sua conta/i.test(comFolga ?? ''),
  'e ele promete a devolução dos coins — que é o que vai acontecer',
);
ok(!/não voltam/i.test(comFolga ?? ''), 'sem contradizer a si mesmo');

// Pelo botão de voltar da própria tela: a reserva é uma tela empilhada, não
// uma aba — não há barra inferior aqui para clicar.
await p.getByLabel('Voltar').filter({ visible: true }).first().click();
await p.waitForTimeout(2000);
await p.locator('a[href="/home"]').last().click();
await p.waitForTimeout(2000);

console.log('\nEm cima da hora\n');

ok(await reservar('perto'), 'reservou a turma mais próxima');
const emCima = await textoDoAviso();
console.log(`  >>> ${String(emCima).replace(/\n+/g, ' | ')}`);
ok(emCima !== null, 'o botão continua existindo — desmarcar tarde é melhor que não avisar');

/*
  Esta é a asserção que importa. Antes, passar do prazo travava o botão; agora
  ele funciona e cobra. Um aviso que repetisse "os coins voltam" aqui seria a
  tela cobrando sem avisar.
*/
ok(/não voltam/i.test(emCima ?? ''), 'e o aviso diz que os coins NÃO voltam');
ok(/5 horas/.test(emCima ?? ''), 'dizendo por quê: faltam menos de 5 horas para a aula');
ok(
  emCima !== comFolga,
  'os dois avisos são diferentes — se fossem iguais, um dos dois estaria mentindo',
);

await b.close();
console.log(falhas === 0 ? '\nTudo certo.' : `\n${falhas} falha(s).`);
process.exit(falhas === 0 ? 0 : 1);
