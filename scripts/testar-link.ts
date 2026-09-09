/**
 * A leitura do link de confirmação.
 *
 * Roda com `npm run test:link`. Existe porque o erro aqui é do tipo que só
 * aparece no aparelho de outra pessoa: um link malformado que devolve `null` em
 * silêncio vira "confirmei e não entrou", sem nada no caminho para investigar.
 */
import { lerErroDoLink, lerSessaoDoLink } from '@/lib/confirmacao';

const falhas: string[] = [];
const ok = (cond: boolean, msg: string) => {
  console.log((cond ? '  OK   ' : '  FALHA ') + msg);
  if (!cond) falhas.push(msg);
};

const bom =
  'kidoo://confirmado#access_token=aaa.bbb.ccc&expires_in=3600' +
  '&refresh_token=rrr&token_type=bearer&type=signup';

const sessao = lerSessaoDoLink(bom);
ok(sessao?.accessToken === 'aaa.bbb.ccc', 'lê o token de acesso');
ok(sessao?.refreshToken === 'rrr', 'e o de renovação');
ok(lerErroDoLink(bom) === null, 'e não inventa erro num link bom');

// O Expo Go usa outro esquema e uma porta; o formato do fim da URL é o mesmo.
ok(
  lerSessaoDoLink('exp://192.168.0.10:8081/--/confirmado#access_token=x&refresh_token=y')
    ?.accessToken === 'x',
  'funciona também no endereço do Expo Go',
);

ok(lerSessaoDoLink(null) === null, 'sem URL não há sessão');
ok(lerSessaoDoLink('kidoo://confirmado') === null, 'sem o # também não');
ok(
  lerSessaoDoLink('kidoo://confirmado#type=signup&expires_in=3600') === null,
  'e um link sem os dois tokens é recusado por inteiro',
);
ok(
  lerSessaoDoLink('kidoo://confirmado#access_token=so-um') === null,
  'meia sessão não serve: sem o de renovação ela morreria em uma hora',
);

// O token NÃO pode ser lido de `?query`: ali ele iria para log de servidor.
ok(
  lerSessaoDoLink('kidoo://confirmado?access_token=x&refresh_token=y') === null,
  'token em query é ignorado — é depois do # que ele não vaza',
);

const expirado =
  'kidoo://confirmado#error=access_denied&error_code=otp_expired' +
  '&error_description=Email+link+is+invalid+or+has+expired';
ok(lerSessaoDoLink(expirado) === null, 'link expirado não vira sessão');
ok(
  lerErroDoLink(expirado) === 'Este link expirou. Peça um novo na tela de confirmação.',
  'e explica em português o que fazer',
);
ok(
  lerErroDoLink('kidoo://confirmado#error=server_error&error_description=algo')?.includes(
    'Peça um novo',
  ) === true,
  'qualquer outro erro também termina com um caminho de saída',
);

console.log(falhas.length ? `\n>>> ${falhas.length} FALHA(S)` : '\n>>> link ok');
process.exit(falhas.length ? 1 : 0);
