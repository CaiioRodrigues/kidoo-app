/**
 * O lugar da aula tem uma página, e dá para ir e voltar dela.
 *
 * Dois pedidos que são o mesmo caminho em sentidos opostos:
 *
 *   1. Na reserva feita, tocar no local abre o perfil com endereço, telefone e
 *      o botão do mapa.
 *   2. Da página do local, chegar de volta na reserva.
 *
 * Este arquivo existe porque o caminho inteiro depende de coisas que o
 * typecheck não vê: o nome do local virou área tocável (e `Text` dentro de
 * `Pressable` continua compilando se o `Pressable` sumir), a rota
 * `/partner/[id]` precisa existir com esse nome exato, e a lista de reservas
 * daqui é filtrada pelo `partner.id` — trocar por `activity.id` compila e
 * mostra uma lista sempre vazia.
 *
 * O botão do mapa é conferido em `test:local`, que roda sem navegador: o que
 * pode dar errado nele é o formato da URL por plataforma, e isso não se vê aqui
 * (a web abre um Google Maps que funciona em qualquer caso).
 *
 * Roda contra o `expo export --platform web` servido em localhost:
 *
 *   npx expo export --platform web
 *   npx http-server dist -p 8095 --silent -P "http://localhost:8095?" &
 *   npm run test:local-do-parceiro
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

// ------------------------------------------------ cadastro e uma reserva ----

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

/*
  Abre o portão da assinatura.

  Escolher o plano deixou de liberar: a assinatura nasce `aguardando` e alguém
  do Kidoo confirma o pagamento. Na demonstração não há painel de administração,
  então o próprio aviso traz o botão de simular — e é por ele que este teste
  passa, pela mesma porta que a pessoa passaria.
*/
const simular = p.getByText('Simular confirmação do pagamento').filter({ visible: true });
await simular.waitFor({ state: 'visible', timeout: 15000 });
await simular.click();
await p.waitForTimeout(2000);

await p.getByLabel('Judô Kids, Dojo Savassi').filter({ visible: true }).first().click();
await p.waitForTimeout(2500);

console.log('Da atividade para o local\n');

const daAtividade = p
  .getByRole('button', { name: /Ver Dojo Savassi: endereço, telefone e mapa/ })
  .filter({ visible: true });
ok((await daAtividade.count()) > 0, 'o nome do local, na atividade, é tocável');

// Reserva primeiro: a lista "suas reservas aqui" só tem o que provar depois
// que existe uma reserva. Sem isto o teste passaria com a seção ausente.
/*
  Percorre os dias até achar um com turma reservável, em vez de fixar um.

  O catálogo do mock é gerado a partir de "agora", então qual dia tem turma
  muda conforme a hora em que o teste roda — e a turma de hoje pode já estar em
  andamento. Fixar um dia faz este teste falhar de madrugada e passar de manhã,
  que é o pior tipo de teste: o que ninguém acredita.
*/
const dias = p.getByLabel(/dia \d+, \d+ turma/).filter({ visible: true });
let turma = null;
for (let i = 0; i < (await dias.count()); i += 1) {
  await dias.nth(i).click();
  await p.waitForTimeout(900);
  const candidata = p.getByRole('button', { name: /vagas?, \d+ coins/ }).filter({ visible: true });
  if ((await candidata.count()) > 0) {
    turma = candidata.first();
    break;
  }
}
ok(turma !== null, 'há uma turma com vaga para reservar');
if (turma === null) {
  await b.close();
  console.log(`\n${falhas} falha(s).`);
  process.exit(1);
}
await turma.click();
await p.waitForTimeout(1400);
await p.getByText('Confirmar reserva').last().click();
await p.waitForTimeout(2600);
ok(/\/booking\//.test(p.url()), `a reserva foi feita e abriu a tela dela (${p.url()})`);

// ------------------------------------------------ da reserva para o local ----

console.log('\nDa reserva para o local\n');

const daReserva = p
  .getByRole('button', { name: /Ver Dojo Savassi: endereço, telefone e mapa/ })
  .filter({ visible: true });
ok((await daReserva.count()) > 0, 'o nome do local, na reserva, é tocável');
await daReserva.first().click();
await p.waitForTimeout(2500);

ok(/\/partner\/p-savassi$/.test(p.url()), `abriu a página do local (${p.url()})`);

const doLocal = await txt();
ok(doLocal.includes('Dojo Savassi'), 'a página é do estabelecimento certo');
ok(
  doLocal.includes('Rua Antônio de Albuquerque'),
  'o endereço da rua está na tela — era o que a família não tinha em lugar nenhum',
);
ok(doLocal.includes('(31) 3261-7755'), 'o telefone está na tela');
ok(
  (await p
    .getByRole('button', { name: /Abrir .* no mapa/ })
    .filter({ visible: true })
    .count()) > 0,
  'há botão para abrir no mapa',
);
ok(
  (await p
    .getByRole('button', { name: /Ligar para/ })
    .filter({ visible: true })
    .count()) > 0,
  'há botão para ligar',
);

// ------------------------------------------------ do local para a reserva ----

console.log('\nDo local de volta para a reserva\n');

ok(doLocal.includes('Sua reserva aqui'), 'a reserva desta família neste lugar aparece');
const voltar = p
  .getByRole('button', { name: /Abrir a reserva de Judô Kids/ })
  .filter({ visible: true });
ok((await voltar.count()) > 0, 'e ela é tocável');
await voltar.first().click();
await p.waitForTimeout(2500);
ok(/\/booking\//.test(p.url()), `voltou para a reserva pelo perfil do local (${p.url()})`);

// ------------------------------------- o local que ainda não preencheu nada --

/*
  O caso que some sem ninguém notar. A maioria dos parceiros do banco de
  produção tem endereço — ele veio do formulário de cadastro —, mas quem foi
  criado direto por SQL não tem. Nesse estado a tela tem de continuar servindo
  para alguma coisa, e não virar um cartão com um espaço em branco.
*/
console.log('\nO local sem endereço nem telefone\n');

const sem = await b.newPage({ viewport: { width: 390, height: 844 } });
await sem.goto(`${BASE}partner/p-serra`, { waitUntil: 'networkidle' });
await sem.waitForTimeout(5000);
const semTexto = await sem.evaluate(() => document.body.innerText);

ok(semTexto.includes('Vila Esportiva Serra'), 'a página abre mesmo sem endereço cadastrado');
ok(
  semTexto.includes('Serra, Belo Horizonte'),
  'o bairro entra no lugar do endereço — pouco, mas é o que o app sempre teve',
);
ok(
  semTexto.includes('ainda não cadastrou o endereço'),
  'e a falta é dita, não escondida: sem isso a família procura o que ninguém escondeu dela',
);
ok(
  (await sem
    .getByRole('button', { name: /Abrir .* no mapa/ })
    .filter({ visible: true })
    .count()) > 0,
  'o botão do mapa continua lá — quem posiciona o alfinete é a coordenada, não o texto',
);
ok(
  (await sem
    .getByRole('button', { name: /Ligar para/ })
    .filter({ visible: true })
    .count()) === 0,
  'e não há botão de ligar para um telefone que não existe',
);

// ---------------------------------- o estabelecimento que não faz mais parte --

/*
  Alcançável só por reserva antiga, que é o ponto: o catálogo esconde quem
  saiu. Se esta tela se comportasse como as outras, a família marcaria aula num
  lugar que não existe mais — e descobriria na porta.
*/
console.log('\nO estabelecimento que saiu\n');

const fora = await b.newPage({ viewport: { width: 390, height: 844 } });
await fora.goto(`${BASE}partner/p-bom-tempo`, { waitUntil: 'networkidle' });
await fora.waitForTimeout(5000);
const foraTexto = await fora.evaluate(() => document.body.innerText);

ok(foraTexto.includes('Escolinha Bom Tempo'), 'a página ainda abre — o histórico é da família');
ok(
  foraTexto.includes('não faz mais parte do Kidoo'),
  'e diz que o lugar saiu, antes de a pessoa sair de casa',
);
ok(
  !foraTexto.includes('Parceiro verificado'),
  'o selo NÃO aparece: "verificado" num lugar que saiu diz o contrário do aviso logo abaixo',
);
ok(
  foraTexto.includes('(31) 3334-5566'),
  'o telefone continua, e é de propósito — é por ele que se confirma a aula já marcada',
);
ok(
  !/Atividades? neste local/.test(foraTexto),
  'a lista de atividades some: seria um catálogo de aulas que não dá para reservar',
);

// E some do catálogo, que é a outra metade da mesma regra.
const busca = await b.newPage({ viewport: { width: 390, height: 844 } });
await busca.goto(BASE, { waitUntil: 'networkidle' });
await busca.waitForTimeout(4500);
await busca.getByText('Continuar como visitante').click();
await busca.waitForTimeout(3000);
const pularBusca = busca.getByLabel('Pular tutorial');
if (await pularBusca.count()) {
  await pularBusca.click();
  await busca.waitForTimeout(1000);
}
await busca.locator('a[href="/explore"]').last().click();
await busca.waitForTimeout(2500);

/*
  A URL vem antes do conteúdo, e vem porque já me enganei assim: uma asserção
  de ausência passa de graça na tela errada. "Bom Tempo" não está na Home
  tampouco — se o clique falhasse, o teste passaria sem nunca abrir a busca.
*/
ok(busca.url().endsWith('/explore'), `abriu o Explorar (${busca.url()})`);
const naBusca = await busca.evaluate(() => document.body.innerText);
ok(naBusca.includes('Futebol Kids'), 'e o catálogo carregou de verdade (há atividade na tela)');

/*
  O Bom Tempo TEM atividade no mock, e é isso que torna esta asserção não
  vazia: sem a atividade, "não aparece" seria verdade por não haver nada para
  aparecer, e o teste passaria com o filtro apagado.
*/
ok(!naBusca.includes('Bom Tempo'), 'e a atividade de quem saiu não aparece nele');
ok(!naBusca.includes('Gutierrez'), 'nem o bairro dele, que é o que o cartão mostra');

await b.close();
console.log(falhas === 0 ? '\nTudo certo.' : `\n${falhas} falha(s).`);
process.exit(falhas === 0 ? 0 : 1);
