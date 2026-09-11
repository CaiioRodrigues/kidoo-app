/**
 * As conquistas e a decisão de quando comemorar.
 *
 * Roda com `npm run test:conquistas`. São duas coisas diferentes no mesmo
 * arquivo porque uma sustenta a outra:
 *
 * 1. **As regras** derivam do histórico e não são guardadas em coluna nenhuma.
 *    Um limiar errado aqui não quebra nada — só destrava cedo demais ou nunca,
 *    e ninguém percebe sem contar as aulas na mão.
 *
 * 2. **Quando comemorar.** Como conquista não tem memória — `unlockedAt` é
 *    sempre "agora" —, quem decide é a lista do que já foi comemorado no
 *    aparelho. Os dois modos de errar são caros e opostos: comemorar de novo o
 *    que a criança já viu (irritante, e a cada abertura), ou despejar de uma
 *    vez tudo o que ela já tinha antes da atualização.
 */
import { ACHIEVEMENT_RULES, buildAchievements } from '../src/lib/achievements';
import { conquistasNovas, guardarVistas, lerVistas } from '../src/lib/conquistas-vistas';
import type { ActivityCategoryId } from '../src/types/domain';

const falhas: string[] = [];
const ok = (cond: boolean, msg: string) => {
  console.log((cond ? '  OK    ' : '  FALHA ') + msg);
  if (!cond) falhas.push(msg);
};

const AGORA = '2026-09-11T12:00:00.000Z';
const aulas = (pares: Partial<Record<ActivityCategoryId, number>>) => {
  const mapa = new Map<ActivityCategoryId, number>();
  let total = 0;
  for (const [categoria, quantas] of Object.entries(pares)) {
    mapa.set(categoria as ActivityCategoryId, quantas);
    total += quantas;
  }
  return { total, byCategory: mapa };
};
const destravadas = (pares: Partial<Record<ActivityCategoryId, number>>) => {
  const { total, byCategory } = aulas(pares);
  return buildAchievements(total, byCategory, AGORA)
    .filter((c) => c.unlockedAt !== null)
    .map((c) => c.id);
};

console.log('\nAs regras\n');

ok(destravadas({}).length === 0, 'quem nunca fez aula não tem conquista nenhuma');
ok(
  destravadas({ futebol: 1 }).join() === 'primeira-aula',
  'a primeira aula destrava a primeira conquista, e só ela',
);
ok(destravadas({ futebol: 3 }).includes('pequeno-craque'), 'três de futebol viram Pequeno craque');
ok(
  !destravadas({ futebol: 2 }).includes('pequeno-craque'),
  'duas de futebol ainda não — o limiar é comparado, não arredondado',
);
ok(
  destravadas({ futebol: 5 }).includes('cinco-aulas'),
  'cinco aulas viram Cheio de energia, mesmo todas da mesma modalidade',
);
ok(
  !destravadas({ futebol: 1, natacao: 1 }).includes('explorador'),
  'duas modalidades não são três',
);
ok(
  destravadas({ futebol: 1, natacao: 1, danca: 1 }).includes('explorador'),
  'três modalidades viram Explorador',
);
ok(
  destravadas({ futebol: 1, natacao: 1, danca: 1, judo: 1, artes: 1 }).includes('multitalento'),
  'cinco modalidades viram Multitalento',
);

/*
  Uma conquista destravada não pode voltar a travar, e isto não é hipótese: as
  regras são monotônicas porque o histórico só cresce. Se alguém escrever um
  limiar com `===` em vez de `>=`, a conquista sumiria da grade quando a criança
  fizesse a aula seguinte — e o app pediria de volta uma medalha já dada.
*/
const crescente = [
  destravadas({ futebol: 1 }),
  destravadas({ futebol: 3 }),
  destravadas({ futebol: 3, natacao: 2 }),
  destravadas({ futebol: 5, natacao: 3, danca: 3 }),
  destravadas({ futebol: 10, natacao: 8, danca: 5, judo: 3, artes: 3 }),
];
let sempreCresce = true;
for (let i = 1; i < crescente.length; i += 1) {
  const antes = new Set(crescente[i - 1]);
  const depois = new Set(crescente[i]);
  for (const id of antes) if (!depois.has(id)) sempreCresce = false;
}
ok(sempreCresce, 'nenhuma conquista some quando a criança faz mais aulas');

ok(
  new Set(ACHIEVEMENT_RULES.map((r) => r.id)).size === ACHIEVEMENT_RULES.length,
  'nenhum id repetido — id repetido faz a comemoração pular uma das duas',
);
ok(
  ACHIEVEMENT_RULES.every((r) => r.hint.trim().length > 0),
  'toda conquista diz o que falta fazer: medalha bloqueada sem dica não ensina nada',
);

console.log('\nQuando comemorar\n');

const conquistasDe = (pares: Partial<Record<ActivityCategoryId, number>>) => {
  const { total, byCategory } = aulas(pares);
  return buildAchievements(total, byCategory, AGORA);
};

/*
  O caso que mais importa: a criança que já jogava antes desta atualização.
  Sem o silêncio da primeira vez ela abre o app e leva cinco telas de parabéns
  em sequência por coisas que fez meses atrás.
*/
const primeiraVez = conquistasNovas(conquistasDe({ futebol: 5, natacao: 3 }), null);
ok(
  primeiraVez.comemorar.length === 0,
  'na primeira vez que olhamos a criança, nada é comemorado — só registrado',
);
ok(
  primeiraVez.guardar.length === destravadas({ futebol: 5, natacao: 3 }).length,
  'e tudo o que ela já tinha fica registrado como visto',
);

const nadaNovo = conquistasNovas(conquistasDe({ futebol: 5 }), primeiraVez.guardar);
ok(nadaNovo.comemorar.length === 0, 'abrir o app de novo sem aula nova não comemora nada');

const comNova = conquistasNovas(conquistasDe({ futebol: 5, natacao: 2 }), primeiraVez.guardar);
ok(
  comNova.comemorar.length === 0,
  'e o que já estava registrado continua quieto mesmo com aula nova',
);

const zerada = conquistasNovas(conquistasDe({}), null);
const primeira = conquistasNovas(conquistasDe({ futebol: 1 }), zerada.guardar);
ok(
  primeira.comemorar.map((c) => c.id).join() === 'primeira-aula',
  'quem começa do zero comemora a primeira aula — o silêncio inicial não a engole',
);

/*
  Duas de uma vez acontece de verdade: a terceira aula de futebol de quem já fez
  natação e dança é "Pequeno craque" e é também a terceira modalidade, que é
  "Explorador". Se a tela mostrasse só uma, a outra apareceria na grade sem
  nunca ter sido anunciada.
*/
const antes = conquistasNovas(conquistasDe({ futebol: 2, natacao: 1 }), []).guardar;
const duas = conquistasNovas(conquistasDe({ futebol: 3, natacao: 1, danca: 1 }), antes);
ok(duas.comemorar.length >= 2, `uma confirmação pode destravar duas (${duas.comemorar.length})`);

console.log('\nO que foi guardado no aparelho\n');

ok(lerVistas(null) === null, 'nunca registrado é `null` — é o que dispara o silêncio inicial');
ok(
  lerVistas('{"nao":"lista"}') === null,
  'conteúdo estragado também é `null`: não sabemos o que já foi visto, e chutar lista vazia ' +
    'comemoraria tudo de uma vez',
);
ok(lerVistas('quebrado{') === null, 'JSON inválido idem');
ok(lerVistas(guardarVistas(['a', 'b']))?.join() === 'a,b', 'o que foi guardado volta igual');
ok(
  lerVistas('["a", 3, null, "b"]')?.join() === 'a,b',
  'lixo no meio da lista é descartado item a item, sem derrubar o resto',
);

/*
  A união, e não só o que está desbloqueado agora: se um limiar mudar e uma
  conquista "sumir", ela não pode voltar a comemorar quando reaparecer.
*/
const guardadoAntes = ['conquista-que-sumiu', 'primeira-aula'];
const depoisDeSumir = conquistasNovas(conquistasDe({ futebol: 1 }), guardadoAntes);
ok(
  depoisDeSumir.guardar.includes('conquista-que-sumiu'),
  'o registro não esquece uma conquista que saiu das regras',
);

console.log(falhas.length === 0 ? '\nTudo certo.' : `\n${falhas.length} falha(s).`);
process.exit(falhas.length === 0 ? 0 : 1);
