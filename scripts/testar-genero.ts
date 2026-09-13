/**
 * A concordância de gênero no nome da criança.
 *
 * Roda com `npm run test:genero`. Existe porque este é o tipo de erro que
 * nenhuma ferramenta pega e ninguém reporta: "Jornada do Alice" compila,
 * passa no lint, e a família que lê não abre chamado — só acha o app
 * desleixado. O typecheck garante que o gênero chega na função; só um teste
 * garante que a função faz alguma coisa com ele.
 *
 * Os três casos importam pelo mesmo motivo: um `if` que só acerta o masculino
 * é exatamente o estado de onde viemos.
 */
import { comArtigo, possessivo } from '../src/lib/genero';

const falhas: string[] = [];
const ok = (cond: boolean, msg: string) => {
  console.log((cond ? '  OK    ' : '  FALHA ') + msg);
  if (!cond) falhas.push(msg);
};

console.log('\nPosse — "Jornada ___"\n');
ok(possessivo('Bento', 'boy') === 'do Bento', 'menino recebe "do"');
ok(possessivo('Alice', 'girl') === 'da Alice', 'menina recebe "da"');
ok(
  possessivo('Alex', 'undisclosed') === 'de Alex',
  'sem gênero informado recebe "de" — a forma que não escolhe por ninguém',
);

console.log('\nObjeto — "Como vamos movimentar ___ hoje?"\n');
ok(comArtigo('Bento', 'boy') === 'o Bento', 'menino recebe "o"');
ok(comArtigo('Alice', 'girl') === 'a Alice', 'menina recebe "a"');
ok(
  comArtigo('Alex', 'undisclosed') === 'Alex',
  'sem gênero informado vai sem artigo, e não com um artigo chutado',
);

console.log('\nA frase inteira, como ela aparece na tela\n');
for (const [genero, esperado] of [
  ['boy', 'Jornada do Bento'],
  ['girl', 'Jornada da Bento'],
  ['undisclosed', 'Jornada de Bento'],
] as const) {
  const frase = `Jornada ${possessivo('Bento', genero)}`;
  console.log(`  ${genero.padEnd(12)} ${frase}`);
  ok(frase === esperado, `${genero}: "${frase}"`);
}

console.log(
  falhas.length === 0
    ? '\nTudo certo.\n'
    : `\n${falhas.length} falha(s):\n${falhas.map((f) => `  - ${f}`).join('\n')}\n`,
);
process.exitCode = falhas.length === 0 ? 0 : 1;
