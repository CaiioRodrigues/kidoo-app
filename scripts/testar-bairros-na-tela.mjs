/**
 * A fileira de bairros sugeridos, no Explorar.
 *
 * `test:bairros` prova que a função junta "Buritis" e "buritis" e ordena
 * direito. O que ele não prova é que alguma tela a chama — e esse é
 * exatamente o estado de onde viemos: a busca por bairro JÁ funcionava, o
 * campo já dizia "Buscar atividade ou bairro...", e ninguém descobria porque
 * não havia nada na tela dizendo quais bairros existem.
 *
 * Três coisas que só o navegador responde:
 *
 *   1. A fileira aparece, com bairros que estão mesmo no catálogo.
 *   2. Tocar num chip filtra a lista — e a lista não fica vazia. Um atalho
 *      que devolve nada é pior que não existir.
 *   3. Bairro e "Perto de mim" não se somam. Somados, dariam "Savassi a menos
 *      de 3 km de onde eu estou": zero resultados, com a tela parecendo
 *      quebrada por ter obedecido.
 *
 *   npx expo export --platform web
 *   npx http-server dist -p 8099 --silent -P "http://localhost:8099?" &
 *   npm run test:bairros-na-tela
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

const busca = () => p.getByPlaceholder('Buscar atividade ou bairro...').filter({ visible: true });
const botao = (nome) => p.getByRole('button', { name: nome, exact: true }).filter({ visible: true });
/*
  Quantos cartões a lista está mostrando.

  Pelo botão que contém a faixa etária, e não por um texto solto: cada item da
  lista é um Pressable, e a faixa etária ("6-9 anos") é o único pedaço que só
  existe em cartão de atividade — chip de modalidade e de bairro não têm
  idade. Contar por texto solto me deu zero com a lista cheia, e três falhas
  que não eram do produto.
*/
const quantas = () =>
  p
    .getByRole('button')
    .filter({ hasText: /\d+-\d+ anos/ })
    .filter({ visible: true })
    .count();

// O Explorar é público: dá para chegar nele sem conta.
await p.goto(`${BASE}/explore`, { waitUntil: 'networkidle' });
await p.waitForTimeout(4500);

console.log('\n--- a fileira existe ---');
let t = await txt();
ok(t.includes('Explorar'), 'o Explorar abriu');
ok(t.includes('Perto de mim'), 'e a fileira do "onde" está lá');

// Os bairros do catálogo de demonstração. Não precisam estar todos na
// fileira — o limite é 10 —, mas os mais cheios precisam.
const candidatos = ['Buritis', 'Pampulha', 'Savassi', 'Serra', 'Funcionários'];
const presentes = [];
for (const bairro of candidatos) {
  if ((await botao(bairro).count()) > 0) presentes.push(bairro);
}
ok(presentes.length >= 3, `bairros do catálogo na fileira: ${presentes.join(', ') || 'nenhum'}`);

console.log('\n--- o chip filtra, e não esvazia ---');
const antes = await quantas();
ok(antes > 0, `a lista começa cheia (${antes} atividades)`);

const alvo = presentes[0];
await botao(alvo).first().click();
await p.waitForTimeout(1500);
ok((await busca().inputValue()) === alvo, `o toque escreveu "${alvo}" na busca`);
const depois = await quantas();
ok(depois > 0, `e a lista NÃO ficou vazia (${depois} atividades)`);
ok(depois < antes, `mas filtrou mesmo (${antes} → ${depois})`);
/*
  E TODOS os cartões são daquele bairro, não só algum.

  Procurar "Buritis" no texto da página passaria com a lista vazia — o chip
  está lá. Procurar o nome do estabelecimento também não serve: o cartão
  mostra o bairro, e o nome do lugar só existe no rótulo de acessibilidade.
  O que a família vê é a linha do lugar, e é ela que tem de bater em todas.
*/
const cartoesDoBairro = await p
  .getByRole('button')
  .filter({ hasText: /\d+-\d+ anos/ })
  .filter({ hasText: alvo })
  .filter({ visible: true })
  .count();
ok(cartoesDoBairro === depois, `os ${depois} cartões são do ${alvo} (${cartoesDoBairro} batem)`);

console.log('\n--- tocar de novo desfaz ---');
await botao(alvo).first().click();
await p.waitForTimeout(1500);
ok((await busca().inputValue()) === '', 'a busca voltou a ficar vazia');
ok((await quantas()) === antes, `e a lista voltou ao tamanho de antes (${antes})`);

console.log('\n--- bairro e distância não se somam ---');
await botao(alvo).first().click();
await p.waitForTimeout(1200);
ok((await busca().inputValue()) === alvo, `${alvo} escolhido de novo`);
await botao('Perto de mim').first().click();
await p.waitForTimeout(2000);
ok(
  (await busca().inputValue()) === '',
  'ligar "Perto de mim" desfez o bairro em vez de somar os dois',
);

console.log('\n--- uma busca digitada sobrevive ---');
// O contrário do caso acima: "natação" não é bairro, é outra pergunta.
await busca().fill('natação');
await p.waitForTimeout(1500);
await botao('Perto de mim').first().click();
await p.waitForTimeout(1500);
ok((await busca().inputValue()) === 'natação', 'o texto digitado continua valendo');

console.log(falhas === 0 ? '\nTudo certo.' : `\n${falhas} falha(s).`);
await b.close();
process.exit(falhas === 0 ? 0 : 1);
