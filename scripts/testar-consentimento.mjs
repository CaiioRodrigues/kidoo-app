/**
 * O aceite do cadastro leva a documentos que existem.
 *
 * Por muito tempo a caixa obrigatória dizia "Li e aceito os Termos de Uso e a
 * Política de Privacidade" com os dois nomes em TEXTO PURO: sem link, sem
 * tela, sem documento. A família marcava que tinha lido dois papéis que não
 * foram escritos — e é essa declaração que a LGPD chama de consentimento
 * informado.
 *
 * O typecheck nunca veria isso, e o teste de conteúdo (`test:documentos`)
 * também não: ele prova que o texto existe, não que alguma tela o alcança.
 *
 * Tem uma armadilha própria: o link é um `Text` com `onPress` DENTRO do
 * `Pressable` da caixa de aceite. Se a precedência do toque estiver errada,
 * tocar no link marca a caixa em vez de abrir o documento — e ninguém
 * percebe, porque a caixa marcar é o que se espera dali.
 *
 *   npx expo export --platform web
 *   npx http-server dist -p 8099 --silent -P "http://localhost:8099?" &
 *   npm run test:consentimento
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

await p.goto(BASE, { waitUntil: 'networkidle' });
await p.waitForTimeout(4500);

console.log('\n--- as boas-vindas ---');
let t = await txt();
ok(t.includes('Termos de Uso'), 'a tela de entrada cita os Termos de Uso');
ok(
  (await p.getByRole('link', { name: 'Política de Privacidade' }).count()) > 0,
  'e a Política de Privacidade é link, não texto morto',
);

console.log('\n--- do cadastro até o documento ---');
await p.getByText('Criar conta', { exact: true }).first().click();
await p.waitForTimeout(1500);
t = await txt();
ok(t.includes('Li e aceito'), 'o cadastro pede o aceite');

const link = p.getByRole('link', { name: 'Política de Privacidade' }).filter({ visible: true });
ok((await link.count()) > 0, 'e os dois nomes do aceite são links');
await link.first().click();
await p.waitForTimeout(1800);
t = await txt();
ok(t.includes('O Kidoo guarda dados de crianças'), 'tocar no link abre a Política de verdade');
ok(t.includes('Quem consegue ver o quê'), 'com o conteúdo inteiro, não um resumo');
ok(t.includes('Atualizado em'), 'e com a data de atualização');

console.log('\n--- os Termos também ---');
await p.goto(`${BASE}/documento/termos`, { waitUntil: 'networkidle' });
await p.waitForTimeout(2500);
t = await txt();
ok(t.includes('Termos de Uso'), 'os Termos abrem pelo endereço direto');
ok(t.includes('mais de 5 horas'), 'e trazem a regra de cancelamento que o app aplica');

console.log('\n--- um documento que não existe não quebra a tela ---');
await p.goto(`${BASE}/documento/inventado`, { waitUntil: 'networkidle' });
await p.waitForTimeout(2000);
ok((await txt()).includes('Não encontramos este documento'), 'endereço inválido explica em vez de estourar');

console.log(falhas === 0 ? '\nTudo certo.' : `\n${falhas} falha(s).`);
await b.close();
process.exit(falhas === 0 ? 0 : 1);
