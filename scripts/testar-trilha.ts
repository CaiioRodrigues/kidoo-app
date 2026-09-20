/**
 * A trilha: cada medalha no passo em que foi ganha.
 *
 * Roda com `npm run test:trilha`. Existe porque este é o tipo de erro que a
 * tela não denuncia: uma trilha com as medalhas no lugar errado continua
 * bonita, continua rolando, e conta uma história falsa sobre a criança — diz
 * que ela ganhou "Peixinho" na aula de futebol.
 *
 * O caso que mais importa é o da lista fora de ordem. `montarTrilha` ordena
 * antes de percorrer justamente porque nenhum dos dois adapters promete ordem
 * eterna: hoje os dois ordenam, e no dia em que um parar de ordenar, a conta
 * aqui dentro sai errada sem erro nenhum aparecer.
 */
import { montarTrilha, ultimosPassos } from '../src/lib/trilha';
import type { AulaFeita } from '../src/types/domain';

const falhas: string[] = [];
const ok = (cond: boolean, msg: string) => {
  console.log((cond ? '  OK    ' : '  FALHA ') + msg);
  if (!cond) falhas.push(msg);
};

const aula = (dia: number, category: AulaFeita['category'], nome: string): AulaFeita => ({
  id: `b-${dia}-${category}`,
  date: `2026-03-${String(dia).padStart(2, '0')}T15:00:00.000Z`,
  category,
  activityName: nome,
});

console.log('\nA primeira aula destrava a primeira medalha\n');

const uma = montarTrilha([aula(1, 'futebol', 'Futebol Kids')]);
ok(uma.length === 1, 'um passo para uma aula');
ok(uma[0]?.numero === 1, 'numerado a partir de 1');
ok(
  uma[0]?.conquistas.map((c) => c.id).join(',') === 'primeira-aula',
  'e só "primeira-aula" — não as doze de uma vez',
);
ok(
  uma[0]?.conquistas[0]?.unlockedAt === uma[0]?.aula.date,
  'a data da conquista é a da aula que a destravou, e não "agora"',
);

console.log('\nCinco aulas de futebol: o que cai, cai no passo certo\n');

const cinco = montarTrilha([
  aula(1, 'futebol', 'Futebol Kids'),
  aula(2, 'futebol', 'Futebol Kids'),
  aula(3, 'futebol', 'Futebol Kids'),
  aula(4, 'futebol', 'Futebol Kids'),
  aula(5, 'futebol', 'Futebol Kids'),
]);
const onde = (id: string) => cinco.findIndex((p) => p.conquistas.some((c) => c.id === id)) + 1;
for (const passo of cinco) {
  const nomes = passo.conquistas.map((c) => c.label).join(', ') || '—';
  console.log(`  aula ${passo.numero}: ${nomes}`);
}
ok(onde('primeira-aula') === 1, '"Primeira aula" na aula 1');
ok(onde('pequeno-craque') === 3, '"Pequeno craque" na aula 3 (3 de futebol)');
ok(onde('cinco-aulas') === 5, '"Cheio de energia" na aula 5');
ok(
  cinco.filter((p) => p.conquistas.length === 0).length === 2,
  'e duas aulas sem medalha nenhuma — é isso que faz a que tem valer algo',
);

console.log('\nNenhuma medalha é dada duas vezes\n');

const dez = montarTrilha(
  Array.from({ length: 10 }, (_, i) => aula(i + 1, 'futebol', 'Futebol Kids')),
);
const todas = dez.flatMap((p) => p.conquistas.map((c) => c.id));
ok(todas.length === new Set(todas).size, 'cada id aparece uma vez só na trilha inteira');
ok(todas.includes('dez-aulas'), 'e a de dez aulas apareceu');

console.log('\nA ordem da entrada não muda o resultado\n');

const embaralhada = montarTrilha([
  aula(5, 'natacao', 'Natação Infantil'),
  aula(1, 'futebol', 'Futebol Kids'),
  aula(3, 'natacao', 'Natação Infantil'),
  aula(2, 'futebol', 'Futebol Kids'),
  aula(4, 'natacao', 'Natação Infantil'),
]);
ok(
  embaralhada.map((p) => p.aula.date).join() ===
    [...embaralhada]
      .map((p) => p.aula.date)
      .sort()
      .join(),
  'os passos saem em ordem cronológica',
);
ok(
  embaralhada[0]?.conquistas.some((c) => c.id === 'primeira-aula') === true,
  '"Primeira aula" foi para a aula do dia 1, não para a primeira da lista',
);
// Duas aulas de natação, e elas caem nos dias 3 e 4 — então a medalha é do
// dia 4, e não do 5. Escrevi "3 de natação" na primeira versão e o teste
// reprovou: é o tipo de conferência que só serve se pegar quem a escreveu.
ok(
  embaralhada.findIndex((p) => p.conquistas.some((c) => c.id === 'peixinho')) + 1 === 4,
  '"Peixinho" (2 de natação) cai no dia 4, a segunda aula de natação',
);

console.log('\nA janela da tela\n');

const janela = ultimosPassos(dez, 4);
ok(janela.visiveis.length === 4, 'mostra quatro');
ok(janela.anteriores === 6, 'e diz que seis ficaram para trás');
ok(janela.visiveis[3]?.numero === 10, 'o último visível é a aula mais recente');

const cabe = ultimosPassos(cinco, 8);
ok(cabe.visiveis.length === 5 && cabe.anteriores === 0, 'trilha curta aparece inteira, sem corte');

console.log(
  falhas.length === 0
    ? '\nTudo certo.\n'
    : `\n${falhas.length} falha(s):\n${falhas.map((f) => `  - ${f}`).join('\n')}\n`,
);
process.exitCode = falhas.length === 0 ? 0 : 1;
