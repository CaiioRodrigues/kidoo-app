/**
 * A foto do responsável: colocar, ver, e tirar.
 *
 * A criança tem foto desde sempre; quem leva ela nunca teve. No cabeçalho do
 * Perfil o responsável era duas letras num círculo, ao lado do próprio nome.
 *
 * O teste dirige o seletor de imagens de verdade. Na web o `expo-image-picker`
 * vira um `input file`, e o Playwright sabe atendê-lo — então o caminho
 * exercitado é o mesmo do aparelho até a borda do sistema operacional: toque no
 * avatar, escolha do arquivo, envio, e o rosto na tela.
 *
 * O que ele cobre e o typecheck não vê: o avatar do responsável virou área
 * tocável (um `<Avatar>` continua compilando se o `Pressable` em volta sumir),
 * a foto vai parar na SESSÃO e não num cache à parte (é de lá que o cabeçalho
 * lê — guardar noutro lugar faz a tela não mudar até o próximo login), e
 * remover volta às iniciais em vez de deixar uma imagem quebrada.
 *
 * Roda contra o `expo export --platform web` servido em localhost:
 *
 *   npx expo export --platform web
 *   npx http-server dist -p 8095 --silent -P "http://localhost:8095?" &
 *   npm run test:foto-do-responsavel
 */
import { join } from 'node:path';
import { chromium } from 'playwright';

const BASE = process.env.KIDOO_URL ?? 'http://localhost:8095/';
const executablePath = process.env.CHROMIUM_PATH || undefined;
const ROSTO = join(import.meta.dirname, 'fixtures', 'rosto.png');

const b = await chromium.launch(executablePath ? { executablePath } : {});
const p = await b.newPage({ viewport: { width: 390, height: 844 } });

let falhas = 0;
const ok = (c, d) => {
  console.log(`${c ? '  ok ' : 'FALHA'}  ${d}`);
  if (!c) falhas += 1;
};

/** Os rótulos dos botões de foto que estão na tela agora. */
const botoesDeFoto = () =>
  p.evaluate(() =>
    [...document.querySelectorAll('[role="button"]')]
      .filter((el) => el.getBoundingClientRect().width > 0)
      .map((el) => el.getAttribute('aria-label'))
      .filter((rotulo) => rotulo && /foto/i.test(rotulo)),
  );

// ------------------------------------------------------- cadastro e perfil --

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

// Pela aba, e não por URL: recarregar zera o backend em memória junto com a
// conta que acabamos de criar.
await p.locator('a[href="/profile"]').last().click();
await p.waitForTimeout(2500);
ok(p.url().endsWith('/profile'), `abriu o Perfil (${p.url()})`);

console.log('\nAntes de ter foto\n');

const antes = await botoesDeFoto();
ok(antes.includes('Adicionar a sua foto'), 'o avatar do responsável convida a colocar uma foto');
ok(!antes.includes('Remover a sua foto'), 'e não oferece remover o que não existe');
/*
  A contagem é DENTRO do botão do avatar, e não da página.

  Contar `img` da tela inteira parecia servir e não serve: o número oscila —
  o `expo-image` desenha camadas a mais durante a transição, e uma volta de
  catálogo em cache muda o total sem nada a ver com esta tela. A pergunta certa
  é estreita: este avatar tem imagem dentro?
*/
const imagemNoAvatar = (rotulo) =>
  p.getByLabel(rotulo).filter({ visible: true }).first().locator('img').count();

ok((await imagemNoAvatar('Adicionar a sua foto')) === 0, 'e o avatar ainda não tem imagem nenhuma');

// ------------------------------------------------------------- colocar ------

console.log('\nColocando\n');

const espera = p.waitForEvent('filechooser', { timeout: 15000 });
await p.getByLabel('Adicionar a sua foto').filter({ visible: true }).first().click();
const seletor = await espera;
ok(true, 'o toque no avatar abre o seletor de imagens');
await seletor.setFiles(ROSTO);
await p.waitForTimeout(3000);

const noAvatar = await imagemNoAvatar('Trocar a sua foto');
ok(noAvatar > 0, `o avatar do responsável virou imagem (${noAvatar} dentro do botão)`);

const depois = await botoesDeFoto();
ok(depois.includes('Trocar a sua foto'), 'o botão passa a oferecer trocar');
ok(depois.includes('Remover a sua foto'), 'e aparece a saída para remover');

/*
  A foto da criança não pode ter mudado junto.

  As duas passam pelo mesmo seletor e pelo mesmo estado de erro nesta tela, e
  trocar um `childId` por outro — ou esquecer de passá-lo — é o engano que
  compila: o resultado seria a foto do pai aparecendo na linha da filha.
*/
ok(
  depois.includes('Adicionar foto de Alice Rodrigues'),
  'e a criança continua sem foto: as duas são independentes',
);

// -------------------------------------------------------------- tirar -------

console.log('\nTirando\n');

// `confirmAction` na web é o `confirm` do navegador. Sem isto o diálogo fica
// aberto e o teste espera por um botão que nunca vem.
p.on('dialog', (d) => void d.accept());
await p.getByLabel('Remover a sua foto').filter({ visible: true }).first().click();
await p.waitForTimeout(2500);

ok(
  (await imagemNoAvatar('Adicionar a sua foto')) === 0,
  'a imagem sai do avatar, que volta às iniciais',
);
const removido = await botoesDeFoto();
ok(
  removido.includes('Adicionar a sua foto') && !removido.includes('Remover a sua foto'),
  'e o botão volta a convidar, em vez de oferecer remover o que não há',
);

await b.close();
console.log(falhas === 0 ? '\nTudo certo.' : `\n${falhas} falha(s).`);
process.exit(falhas === 0 ? 0 : 1);
