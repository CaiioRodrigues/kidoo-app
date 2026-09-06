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

/**
 * Os dois clientes do banco: o app das famílias e o painel do parceiro. O
 * painel chama seis funções que o app não chama — deixá-lo de fora seria
 * conferir metade do contrato.
 */
const adapter = [
  '../../src/services/supabase/index.ts',
  '../../partner/src/api/supabase.ts',
]
  .map((caminho) => readFileSync(join(HERE, caminho), 'utf8'))
  .join('\n');
const mappers = readFileSync(join(HERE, '../../src/services/supabase/mappers.ts'), 'utf8');

const falhas: string[] = [];
function checa(condicao: boolean, mensagem: string): void {
  if (!condicao) falhas.push(mensagem);
}

// ------------------------------------------------------------- funções ------

const funcoes = new Map(
  // Só os parâmetros de ENTRADA. Numa função "returns table", `proargnames`
  // traz junto os nomes das colunas de saída — sem este filtro, uma coluna
  // devolvida passaria como se fosse um parâmetro aceito.
  sql(`select p.proname || ' ' || coalesce((
           select string_agg(t.nome, ',' order by t.ordem)
             from unnest(p.proargnames) with ordinality as t(nome, ordem)
            where p.proargmodes is null
               or p.proargmodes[t.ordem] in ('i', 'b', 'v')
         ), '')
         from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public'`).map((linha) => {
    const [nome, args = ''] = linha.split(' ');
    return [nome as string, new Set(args.split(',').filter(Boolean))];
  }),
);

// Duas formas de chamar: `rpc('nome', {...})` direto, e o auxiliar do painel
// `linhasDe<T>('nome', {...})` para funções que devolvem conjunto. A segunda
// escapava do teste — justamente as três RPCs de leitura do painel.
const rpcs = [
  ...adapter.matchAll(/\.rpc\(\s*'([a-z_]+)'(?:,\s*\{([^}]*)\})?/g),
  ...adapter.matchAll(/linhasDe<[^>]*>\(\s*'([a-z_]+)',\s*\{([^}]*)\}/g),
];
checa(rpcs.length >= 13, `esperava ao menos 13 chamadas de RPC, achei ${rpcs.length}`);

for (const [, nome, corpo = ''] of rpcs) {
  const esperados = funcoes.get(nome as string);
  if (!esperados) {
    falhas.push(`função ${nome} não existe no banco`);
    continue;
  }
  // Cada chave do objeto de argumentos, e não só as que começam com `p_`:
  // um nome fora da convenção é exatamente o que o Postgres recusaria em
  // runtime. E a chave é reconhecida por vir depois de `{` ou `,`, porque
  // ancorar no início da linha só conferia o primeiro parâmetro de um objeto
  // escrito numa linha só.
  // Comentários saem antes: um `// o nome não vai daqui: ...` no meio do
  // objeto de argumentos era lido como um parâmetro chamado "daqui".
  const semComentarios = (corpo as string).replace(/\/\/[^\n]*/g, '');

  for (const [, param] of semComentarios.matchAll(/[{,]?\s*([a-z_][a-z0-9_]*)\s*:/g)) {
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

  // Os embeds saem antes da quebra por vírgula: senão
  // `partner:partners(id, name, city)` viraria as colunas soltas `name` e
  // `city)`, conferidas contra a tabela de fora. São conferidos logo abaixo.
  const semEmbeds = (lista as string).replace(/[a-z_]+:[a-z_]+\([^)]*\)/g, '');

  for (const campo of semEmbeds.split(',')) {
    const nome = campo.trim();
    if (!nome) continue;
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
