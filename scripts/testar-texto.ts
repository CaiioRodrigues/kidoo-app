/**
 * O plural dos coins.
 *
 * Roda com `npm run test:texto`. Existe porque "1 coins" não quebra nada, não
 * aparece em nenhum log e não gera reclamação — só faz o app parecer
 * descuidado na etiqueta que aparece em toda turma do catálogo. E turma de uma
 * moeda é o caso mais comum, então o erro aparecia mais que o acerto.
 *
 * O zero entra de propósito: em português ele é plural ("0 coins"), e é o
 * lugar onde uma condição escrita como `amount <= 1` passaria despercebida.
 */
import { formatCoins } from '../src/lib/format';

const falhas: string[] = [];
const ok = (cond: boolean, msg: string) => {
  console.log((cond ? '  OK    ' : '  FALHA ') + msg);
  if (!cond) falhas.push(msg);
};

console.log('\nForma curta — a etiqueta do card\n');
ok(formatCoins(0) === '0 coins', 'zero é plural em português');
ok(formatCoins(1) === '1 coin', 'um é singular — era isto que estava errado');
ok(formatCoins(2) === '2 coins', 'dois é plural');

console.log('\nForma da marca — o distintivo grande e o leitor de tela\n');
ok(formatCoins(1, 'marca') === '1 Kidoo Coin', 'um: "1 Kidoo Coin"');
ok(formatCoins(3, 'marca') === '3 Kidoo Coins', 'três: "3 Kidoo Coins"');

console.log(
  falhas.length === 0
    ? '\nTudo certo.\n'
    : `\n${falhas.length} falha(s):\n${falhas.map((f) => `  - ${f}`).join('\n')}\n`,
);
process.exitCode = falhas.length === 0 ? 0 : 1;
