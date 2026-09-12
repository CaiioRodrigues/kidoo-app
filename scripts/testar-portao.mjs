/**
 * O portão da assinatura: escolher o plano não é ter o plano.
 *
 * Roda com `npm run test:portao`. Até a migration 000020, chamar
 * `subscribe_plan` ERA ter o plano — qualquer conta criada saía com a cota
 * cheia, para sempre, sem ninguém ter pago nada.
 *
 * Isso sempre foi verdade e nunca custou nada, porque não havia dinheiro
 * saindo. Depois que o cancelamento tardio e a falta passaram a gerar repasse,
 * virou furo de caixa: conta grátis, assinatura grátis, reserva, não aparece —
 * e o Kidoo paga R$8 a R$18 a um parceiro de verdade.
 *
 * O portão em si é testado no banco (`test:sql`), que é quem decide. Aqui a
 * pergunta é a do outro lado: a família ENTENDE que não pode reservar, antes
 * de escolher a turma? Um portão que recusa sem avisar é pior que nenhum —
 * a recusa chega depois de a pessoa ter escolhido horário, e parece defeito.
 *
 * Roda contra o `expo export --platform web` servido em localhost:
 *
 *   npx expo export --platform web
 *   npx http-server dist -p 8095 --silent -P "http://localhost:8095?" &
 *   npm run test:portao
 */
import { chromium } from 'playwright';

const BASE = process.env.KIDOO_URL ?? 'http://localhost:8095/';
const executablePath = process.env.CHROMIUM_PATH || undefined;

const b = await chromium.launch(executablePath ? { executablePath } : {});
const p = await b.newPage({ viewport: { width: 390, height: 844 } });
const txt = () => p.evaluate(() => document.body.innerText);

let falhas = 0;
const ok = (c, d) => {
  console.log(`${c ? '  ok ' : 'FALHA'}  ${d}`);
  if (!c) falhas += 1;
};

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

console.log('Na tela de planos\n');

const noPlano = await txt();
ok(/nada é cobrado nesta tela/i.test(noPlano), 'o rodapé diz que nada é cobrado aqui');

/*
  A frase antiga era "A cobrança só acontece após a confirmação no próximo
  passo" — e não havia próximo passo nenhum. Texto sobre cobrança que não
  corresponde ao que acontece é o pior lugar para uma imprecisão, e é o tipo
  de linha que ninguém relê depois de escrita.
*/
ok(!/no próximo passo/i.test(noPlano), 'e não promete um "próximo passo" que não existe');

await p.getByText('Escolher plano').last().click();
await p.waitForTimeout(2600);
const pular = p.getByLabel('Pular tutorial');
if (await pular.count()) {
  await pular.click();
  await p.waitForTimeout(1200);
}

console.log('\nNa Home, depois de escolher\n');

const naHome = await txt();
ok(/Assinatura aguardando confirmação/i.test(naHome), 'a Home avisa que a assinatura espera');

/*
  Acima da dobra, e essa é a asserção que importa.

  Na primeira versão o aviso ficou junto do cartão de coins, no pé da página —
  tecnicamente presente, e invisível. A família rolava pelos cartões, escolhia
  um horário, tentava, e levava a recusa como defeito. Medido pela posição do
  cartão na tela de 844px, não pela sua existência no DOM.
*/
const aviso = await p
  .getByText('Assinatura aguardando confirmação')
  .filter({ visible: true })
  .first()
  .boundingBox();
ok(aviso !== null, 'o aviso tem caixa medível');
if (aviso) {
  console.log(`  >>> o aviso começa a ${aviso.y.toFixed(0)}px do topo (tela de 844px)`);
  ok(aviso.y < 700, `e aparece sem rolar a página (${aviso.y.toFixed(0)}px)`);
}

// O saldo NÃO aparece: 12 coins que não dá para gastar é uma promessa falsa.
ok(
  !/de 12 coins nesta semana/.test(naHome),
  'e a cota não é anunciada — mostrar 12 coins que não dá para usar seria pior que não mostrar nada',
);

console.log('\nTentando reservar assim mesmo\n');

await p.getByLabel('Judô Kids, Dojo Savassi').filter({ visible: true }).first().click();
await p.waitForTimeout(2500);

const dias = p.getByLabel(/dia \d+, \d+ turma/).filter({ visible: true });
let achou = false;
for (let i = 0; i < (await dias.count()); i += 1) {
  await dias.nth(i).click();
  await p.waitForTimeout(800);
  const turma = p.getByRole('button', { name: /vagas?, \d+ coins/ }).filter({ visible: true });
  if ((await turma.count()) === 0) continue;
  await turma.first().click();
  achou = true;
  break;
}
ok(achou, 'há turma para tentar — o portão não esconde o catálogo, só barra a reserva');

await p.waitForTimeout(1300);
await p.getByText('Confirmar reserva').last().click();
await p.waitForTimeout(2800);

const apos = await txt();
ok(
  /aguardando a confirmação do pagamento/i.test(apos),
  'a recusa explica o motivo, em vez de um erro genérico',
);
ok(!/\/booking\/[^c]/.test(p.url()), `e a reserva NÃO foi feita (${p.url()})`);

await b.close();
console.log(falhas === 0 ? '\nTudo certo.' : `\n${falhas} falha(s).`);
process.exit(falhas === 0 ? 0 : 1);
