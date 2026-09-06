/**
 * O adapter fala com o banco por nome: nome de tabela, de coluna, de função e
 * de parâmetro. Nada disso o TypeScript confere — `rpc('book_sesion', ...)`
 * compila e só quebra na mão do usuário.
 *
 * Este teste lê o adapter e os mappers, extrai todo nome que eles usam e
 * pergunta ao Postgres se ele existe. Roda contra o mesmo banco descartável de
 * `run.sh`, então prova contra as migrations de verdade.
 *
 *     npx tsx supabase/tests/contract.ts
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const HERE = import.meta.dirname;
const PGDATA = process.env.PGDATA_DIR ?? '/var/lib/postgresql/kidoo-test';
const PORT = process.env.PORT ?? '5433';

function sql(query: string): string[] {
  const out = execFileSync(
    'psql',
    ['-h', PGDATA, '-p', PORT, '-U', 'postgres', '-d', 'kidoo_test', '-tAc', query],
    { encoding: 'utf8' },
  );
  return out.split('\n').map((line) => line.trim()).filter(Boolean);
}

const adapter = readFileSync(join(HERE, '../../src/services/supabase/index.ts'), 'utf8');
const mappers = readFileSync(join(HERE, '../../src/services/supabase/mappers.ts'), 'utf8');

const falhas: string[] = [];
function checa(condicao: boolean, mensagem: string): void {
  if (!condicao) falhas.push(mensagem);
}

// ------------------------------------------------------------- funções ------

const funcoes = new Map(
  sql(`select p.proname || ' ' || coalesce(array_to_string(p.proargnames, ','), '')
         from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public'`).map((linha) => {
    const [nome, args = ''] = linha.split(' ');
    return [nome as string, new Set(args.split(',').filter(Boolean))];
  }),
);

// rpc('nome', { p_x: ..., p_y: ... })
const rpcs = [...adapter.matchAll(/\.rpc\(\s*'([a-z_]+)'(?:,\s*\{([^}]*)\})?/g)];
checa(rpcs.length >= 7, `esperava ao menos 7 chamadas de RPC, achei ${rpcs.length}`);

for (const [, nome, corpo = ''] of rpcs) {
  const esperados = funcoes.get(nome as string);
  if (!esperados) {
    falhas.push(`função ${nome} não existe no banco`);
    continue;
  }
  for (const [, param] of corpo.matchAll(/^\s*(p_[a-z_]+)\s*:/gm)) {
    checa(
      esperados.has(param as string),
      `${nome} não tem o parâmetro ${param} (tem: ${[...esperados].join(', ')})`,
    );
  }
}

// ------------------------------------------------- tabelas, visões, colunas --

const colunas = new Map<string, Set<string>>();
for (const linha of sql(`select table_name || ' ' || column_name
                           from information_schema.columns
                          where table_schema = 'public'`)) {
  const [tabela, coluna] = linha.split(' ');
  if (!colunas.has(tabela as string)) colunas.set(tabela as string, new Set());
  colunas.get(tabela as string)?.add(coluna as string);
}

// from('tabela') ... .select('a, b, rel:outra(c)')
for (const [, tabela, lista] of adapter.matchAll(/\.from\('([a-z_]+)'\)\s*\n?\s*\.select\(\s*'([^']*)'/g)) {
  const disponiveis = colunas.get(tabela as string);
  if (!disponiveis) {
    falhas.push(`tabela ou visão ${tabela} não existe`);
    continue;
  }
  if (lista === '*') continue;

  for (const campo of (lista as string).split(',')) {
    const nome = campo.trim();
    // embeds (`activity:activities(category_id)`) são conferidos à parte
    if (!nome || nome.includes('(') || nome.includes(':')) continue;
    checa(disponiveis.has(nome), `${tabela} não tem a coluna ${nome}`);
  }
}

// os embeds: alias:tabela(colunas)
for (const [, tabela, campos] of adapter.matchAll(/[a-z_]+:([a-z_]+)\(([^)]*)\)/g)) {
  const disponiveis = colunas.get(tabela as string);
  if (!disponiveis) {
    falhas.push(`tabela embutida ${tabela} não existe`);
    continue;
  }
  for (const campo of (campos as string).split(',')) {
    const nome = campo.trim();
    if (nome) checa(disponiveis.has(nome), `${tabela} (embutida) não tem a coluna ${nome}`);
  }
}

// filtros e ordenações: .eq('coluna', ...), .order('coluna'), .in('coluna', ...)
// Conferidos contra a união das colunas de todas as tabelas — saber a tabela de
// cada chamada exigiria interpretar a cadeia, e o ganho não pagaria a
// complexidade: um nome que não existe em lugar nenhum já é o erro comum.
const todasColunas = new Set([...colunas.values()].flatMap((set) => [...set]));
for (const [, coluna] of adapter.matchAll(/\.(?:eq|in|order)\(\s*'([a-z_]+)'/g)) {
  checa(todasColunas.has(coluna as string), `nenhuma tabela tem a coluna ${coluna}`);
}

// --------------------------------------------------- colunas dos mappers ----
// Cada `type XRow = { ... }` descreve uma linha que o banco devolve. Se um
// campo não existe, o mapper devolve `undefined` silenciosamente.

const TABELA_DE = new Map([
  ['CategoryRow', 'activity_categories'],
  ['ActivityRow', 'activities_public'],
  ['SessionRow', 'class_sessions_open'],
  ['ChildRow', 'children'],
  ['BookingRow', 'bookings'],
  ['ReviewRow', 'reviews'],
  ['BonusGrantRow', 'bonus_grants'],
  ['SubscriptionRow', 'subscriptions'],
  ['PlanRow', 'plans'],
]);

for (const [tipo, tabela] of TABELA_DE) {
  const bloco = mappers.match(new RegExp(`export type ${tipo} = \\{([^}]*(?:\\{[^}]*\\}[^}]*)*)\\};`));
  if (!bloco) {
    falhas.push(`mapper ${tipo} não encontrado`);
    continue;
  }
  const disponiveis = colunas.get(tabela);
  if (!disponiveis) {
    falhas.push(`tabela ${tabela} do mapper ${tipo} não existe`);
    continue;
  }
  for (const [, campo] of bloco[1]?.matchAll(/^\s{2}([a-z_]+)\??:/gm) ?? []) {
    checa(disponiveis.has(campo as string), `${tabela} não tem a coluna ${campo} (de ${tipo})`);
  }
}

// ---------------------------------------------------------------- veredito ---

if (falhas.length > 0) {
  console.error(`contrato quebrado em ${falhas.length} ponto(s):`);
  for (const falha of falhas) console.error(`  - ${falha}`);
  process.exit(1);
}
console.log(
  `contrato ok: ${rpcs.length} RPCs, ${TABELA_DE.size} mappers e ${colunas.size} relações conferidos`,
);
