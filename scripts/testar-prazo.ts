/**
 * O prazo de cancelamento é UM número — em três lugares.
 *
 * Roda com `npm run test:prazo`. Existe porque a regra vive em três arquivos e
 * quem decide é o banco:
 *
 *   `shared/cancelamento.ts`   o que a tela promete
 *   a migration 000019        o que o servidor faz, e quem decide
 *   o texto do aviso          o que a família lê antes de confirmar
 *
 * Separados, o sintoma é o pior que existe: a tela diz "os coins voltam", a
 * pessoa confirma, e não voltam. Ninguém relata isso como bug de prazo — chega
 * como "sumiram meus coins", e a investigação começa no lugar errado.
 *
 * O prazo esteve seis horas no TypeScript e em lugar nenhum no SQL: até a
 * 000019, `cancel_booking` não olhava a hora. Quem chamasse a API direto
 * cancelava um minuto antes da aula e recebia tudo de volta.
 */
import { PRAZO_DE_CANCELAMENTO_H, desfechoDoCancelamento, horasAte } from '../shared/cancelamento';

const falhas: string[] = [];
const ok = (cond: boolean, msg: string) => {
  console.log((cond ? '  OK    ' : '  FALHA ') + msg);
  if (!cond) falhas.push(msg);
};

console.log('\nO número, fixado\n');

/*
  Fixado no literal, e não lido do SQL.

  Ler a migration daqui exigiria `node:fs`, e com ele `@types/node` no
  typecheck do app — que passaria a aceitar `process` e `Buffer` dentro de
  código React Native, onde eles não existem. `supabase/` já está fora do
  tsconfig por esse motivo.

  Então o par é pinado dos dois lados: cinco aqui, e
  `assert cancellation_cutoff() = interval '5 hours'` na suíte SQL. Mudar um só
  quebra o teste do próprio lado, com uma mensagem apontando para o outro.
*/
ok(
  PRAZO_DE_CANCELAMENTO_H === 5,
  'o prazo é de 5 horas — se mudou, mude junto `cancellation_cutoff()` na 000019 ' +
    'e a asserção correspondente em `supabase/tests/rls.sql`',
);

console.log('\nDe que lado do corte cada momento cai\n');

const AGORA = new Date('2026-09-12T12:00:00.000Z');
const daquiA = (horas: number) => new Date(AGORA.getTime() + horas * 3600_000).toISOString();

ok(desfechoDoCancelamento(daquiA(24), AGORA) === 'devolve', 'um dia antes: devolve');
ok(desfechoDoCancelamento(daquiA(6), AGORA) === 'devolve', 'seis horas antes: devolve');

/*
  Exatamente cinco horas devolve. A borda é escolhida a favor da família: quem
  cancela no minuto do prazo cumpriu o prazo, e um `>` em vez de `>=` tiraria o
  coin de quem fez certo — o tipo de erro que ninguém reporta porque parece
  regra.
*/
ok(desfechoDoCancelamento(daquiA(5), AGORA) === 'devolve', 'exatamente cinco horas: devolve');

ok(desfechoDoCancelamento(daquiA(4.99), AGORA) === 'cobra', 'um minuto depois do corte: cobra');
ok(desfechoDoCancelamento(daquiA(1), AGORA) === 'cobra', 'uma hora antes: cobra');
ok(desfechoDoCancelamento(daquiA(0), AGORA) === 'cobra', 'na hora da aula: cobra');

console.log('\nAs horas que faltam\n');

ok(Math.abs(horasAte(daquiA(3), AGORA) - 3) < 1e-9, 'três horas à frente são três horas');
ok(horasAte(daquiA(-2), AGORA) < 0, 'aula que já passou dá número negativo');

console.log(falhas.length === 0 ? '\nTudo certo.' : `\n${falhas.length} falha(s).`);
process.exit(falhas.length === 0 ? 0 : 1);
