/**
 * Os bairros sugeridos na busca.
 *
 * Roda com `npm run test:bairros`. Existe porque a fileira é derivada de texto
 * que o parceiro digita à mão — `<input maxLength={60}>`, sem lista e sem
 * validação. O typecheck garante que o bairro chega aqui como `string`; nada
 * garante que "Buritis", "buritis" e " Buritis " não virem três chips do mesmo
 * lugar na tela da família.
 *
 * E a ordem importa mais do que parece: uma fileira que sai numa ordem a cada
 * carregamento não é uma fileira, é ruído. O desempate alfabético existe por
 * isso, e só um teste prova que ele está lá.
 */
import { bairrosDoCatalogo, mesmoBairro } from '../src/lib/bairros';

const falhas: string[] = [];
const ok = (cond: boolean, msg: string) => {
  console.log((cond ? '  OK    ' : '  FALHA ') + msg);
  if (!cond) falhas.push(msg);
};

const cat = (...bairros: string[]) => bairros.map((b) => ({ partner: { neighborhood: b } }));

console.log('\nJuntar o que é o mesmo bairro\n');
{
  const r = bairrosDoCatalogo(cat('Buritis', 'buritis', ' Buritis ', 'Savassi'));
  ok(r.length === 2, `dois bairros, não quatro (veio ${r.length})`);
  ok(r[0]?.nome === 'Buritis' && r[0]?.quantas === 3, 'maiúscula e espaço não criam bairro novo');
}
{
  const r = bairrosDoCatalogo(cat('Funcionários', 'FUNCIONARIOS', 'funcionários'));
  ok(r.length === 1, `acento também não (veio ${r.length})`);
  ok(r[0]?.quantas === 3, 'e as três contam juntas');
}

console.log('\nA grafia que aparece é a mais comum\n');
{
  const r = bairrosDoCatalogo(cat('buritis', 'Buritis', 'Buritis'));
  ok(r[0]?.nome === 'Buritis', `ganha "Buritis", não a primeira que chegou (veio "${r[0]?.nome}")`);
}
{
  // Empate: some e a fileira muda de cara a cada carregamento.
  const a = bairrosDoCatalogo(cat('buritis', 'Buritis'))[0]?.nome;
  const b = bairrosDoCatalogo(cat('Buritis', 'buritis'))[0]?.nome;
  ok(a === b, `empate dá sempre o mesmo resultado (${a} vs ${b})`);
}

console.log('\nOrdem: o bairro com mais opções primeiro\n');
{
  const r = bairrosDoCatalogo(cat('Savassi', 'Buritis', 'Buritis', 'Serra', 'Serra', 'Serra'));
  ok(
    r.map((x) => x.nome).join(',') === 'Serra,Buritis,Savassi',
    `veio "${r.map((x) => x.nome).join(',')}"`,
  );
}
{
  const r = bairrosDoCatalogo(cat('Serra', 'Buritis', 'Alípio de Melo'));
  ok(
    r.map((x) => x.nome).join(',') === 'Alípio de Melo,Buritis,Serra',
    `todos com um: alfabético em pt-BR (veio "${r.map((x) => x.nome).join(',')}")`,
  );
}

console.log('\nO que não entra na fileira\n');
{
  const r = bairrosDoCatalogo(cat('Buritis', '', '   ', 'Serra'));
  ok(r.length === 2, `bairro em branco não vira chip vazio (veio ${r.length})`);
}
{
  const muitos = cat(...Array.from({ length: 30 }, (_, i) => `Bairro ${i}`));
  ok(bairrosDoCatalogo(muitos).length === 10, 'o limite padrão é 10');
  ok(bairrosDoCatalogo(muitos, 3).length === 3, 'e é ajustável');
}
{
  ok(bairrosDoCatalogo([]).length === 0, 'catálogo vazio, fileira vazia — sem chip fantasma');
}

console.log('\nMarcar o chip escolhido\n');
ok(mesmoBairro(' buritis ', 'Buritis'), 'a busca digitada casa com o bairro do chip');
ok(mesmoBairro('FUNCIONARIOS', 'Funcionários'), 'mesmo sem acento');
ok(!mesmoBairro('Buritis II', 'Buritis'), 'mas "Buritis II" não é "Buritis"');
ok(!mesmoBairro('natação', 'Buritis'), 'e uma busca comum não marca bairro nenhum');

console.log(falhas.length === 0 ? '\nTudo certo.' : `\n${falhas.length} falha(s).`);
process.exit(falhas.length === 0 ? 0 : 1);
