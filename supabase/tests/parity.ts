/**
 * As regras de nível e bônus existem duas vezes: em `src/lib/levels.ts`, para a
 * tela prever o resultado, e em SQL, porque o banco é quem credita de verdade.
 *
 * Duplicação em duas linguagens é onde este tipo de projeto racha em silêncio:
 * alguém ajusta a curva de um lado, o app mostra um número e o banco credita
 * outro. Este teste compara as duas implementações sobre a mesma faixa de XP.
 *
 *   npx tsx supabase/tests/parity.ts
 */
import { execFileSync } from 'node:child_process';

import { bonusForLevel, levelFromXp, MAX_LEVEL, xpToLeaveLevel } from '../../src/lib/levels';

const PGHOST = process.env.PGDATA_DIR ?? '/var/lib/postgresql/kidoo-test';
const PGPORT = process.env.PORT ?? '5433';

function sql(query: string): string[] {
  const out = execFileSync(
    'psql',
    ['-h', PGHOST, '-p', PGPORT, '-U', 'postgres', '-d', 'kidoo_test', '-X', '-q', '-t', '-A', '-c', query],
    { encoding: 'utf8' },
  );
  return out.trim().split('\n').filter(Boolean);
}

const XPS = Array.from({ length: 120 }, (_, i) => i * 250);
const LEVELS = Array.from({ length: MAX_LEVEL + 2 }, (_, i) => i);

let failures = 0;
const fail = (message: string) => {
  console.error('  ✗ ' + message);
  failures += 1;
};

const dbLevels = sql(`select level_from_xp(x) from unnest(array[${XPS.join(',')}]) as t(x)`);
XPS.forEach((xp, index) => {
  const ts = levelFromXp(xp).level;
  const db = Number(dbLevels[index]);
  if (ts !== db) fail(`nível para ${xp} XP: TypeScript diz ${ts}, SQL diz ${db}`);
});

const dbBonus = sql(`select bonus_for_level(n) from unnest(array[${LEVELS.join(',')}]) as t(n)`);
LEVELS.forEach((level, index) => {
  const ts = bonusForLevel(level);
  const db = Number(dbBonus[index]);
  if (ts !== db) fail(`bônus do nível ${level}: TypeScript diz ${ts}, SQL diz ${db}`);
});

const dbCost = sql(`select xp_to_leave_level(n) from unnest(array[${LEVELS.join(',')}]) as t(n)`);
LEVELS.forEach((level, index) => {
  const ts = xpToLeaveLevel(level);
  const db = Number(dbCost[index]);
  if (ts !== db) fail(`custo do nível ${level}: TypeScript diz ${ts}, SQL diz ${db}`);
});

if (failures > 0) {
  console.error(`\n${failures} divergência(s) entre TypeScript e SQL.`);
  process.exit(1);
}
console.log(
  `paridade ok: ${XPS.length} valores de XP, ${LEVELS.length} níveis, as duas implementações concordam`,
);
