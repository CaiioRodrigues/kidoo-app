/**
 * O link do mapa e o do telefone.
 *
 * Roda com `npm run test:local`. Existe porque estes dois erram em silêncio:
 * um esquema que a plataforma não conhece não dá erro nem aviso — o toque
 * simplesmente não faz nada, e o relato que chega é "o botão não funciona no
 * iPhone", meses depois, sem mais informação que essa.
 *
 * O caso que mais importa é o `geo:` no iOS. Ele é o formato que todo mundo
 * conhece, é o que aparece primeiro em qualquer busca, e é exatamente o que o
 * iOS ignora.
 */
import { linkDoMapa, linkDoTelefone, enderecoVisivel } from '../src/lib/local';

const falhas: string[] = [];
const ok = (cond: boolean, msg: string) => {
  console.log((cond ? '  OK    ' : '  FALHA ') + msg);
  if (!cond) falhas.push(msg);
};

const ARENA = {
  name: 'Academia Arena Kids',
  latitude: -19.9702,
  longitude: -43.9803,
};

console.log('\nO link do mapa\n');

const noIos = linkDoMapa(ARENA, 'ios');
const noAndroid = linkDoMapa(ARENA, 'android');
const naWeb = linkDoMapa(ARENA, 'web');

console.log(`  ios      ${noIos}`);
console.log(`  android  ${noAndroid}`);
console.log(`  web      ${naWeb}\n`);

ok(noIos.startsWith('maps:'), 'no iOS o esquema é `maps:`');
ok(
  !noIos.startsWith('geo:'),
  'e NÃO é `geo:` — no iOS ele não abre nada, e não abrir nada não dá erro nenhum',
);
ok(noAndroid.startsWith('geo:'), 'no Android o esquema é `geo:`');
ok(naWeb.startsWith('https://'), 'na web é um endereço que o navegador sabe abrir');

ok(
  [noIos, noAndroid, naWeb].every((l) => l.includes('-19.9702') && l.includes('-43.9803')),
  'os três levam a coordenada — é ela que posiciona, não o texto do endereço',
);
ok(
  noAndroid.includes('?q=-19.9702,-43.9803('),
  'no Android a coordenada se repete depois do `q`: sem isso o mapa centraliza mas não marca',
);

const COM_ESPACO = { name: 'Espaço Cidade Jardim', latitude: -19.9424, longitude: -43.9518 };
ok(
  !linkDoMapa(COM_ESPACO, 'android').includes(' '),
  'nome com espaço não vaza espaço cru para dentro da URL',
);
ok(
  linkDoMapa(COM_ESPACO, 'ios').includes('Espa%C3%A7o'),
  'nome com acento é escapado (o ç de "Espaço" quebraria a URL crua)',
);

/*
  Uma coordenada negativa com um `-` a menos é outro município. Como o link
  abre um mapa e não dá erro, o sintoma seria a família chegando ao lugar
  errado — e culpando o endereço, não o app.
*/
ok(
  linkDoMapa(ARENA, 'android').includes('geo:-19.9702,-43.9803'),
  'latitude antes da longitude, com o sinal de cada uma',
);

console.log('\nO link do telefone\n');

ok(linkDoTelefone('(31) 3291-4400') === 'tel:3132914400', 'parêntese, espaço e traço saem');
ok(linkDoTelefone('+55 31 99712-3388') === 'tel:+5531997123388', 'o + inicial fica');
ok(linkDoTelefone('31 3291 4400 ') === 'tel:3132914400', 'espaço no fim também sai');

console.log('\nO endereço na tela\n');

ok(
  enderecoVisivel({ address: 'Rua X, 10', neighborhood: 'Buritis', city: 'BH' }) === 'Rua X, 10',
  'com endereço cadastrado, é ele que aparece',
);
ok(
  enderecoVisivel({ address: null, neighborhood: 'Buritis', city: 'Belo Horizonte' }) ===
    'Buritis, Belo Horizonte',
  'sem endereço sobra o bairro — pouco, mas verdade, e é o que o app sempre teve',
);
ok(
  enderecoVisivel({ address: '', neighborhood: 'Buritis', city: 'Belo Horizonte' }) === '',
  'texto vazio é tratado como texto, não como ausência: quem grava vazio no painel ' +
    'vê vazio, e é o painel que deve recusar, não esta função adivinhar',
);

console.log(falhas.length === 0 ? '\nTudo certo.' : `\n${falhas.length} falha(s).`);
process.exit(falhas.length === 0 ? 0 : 1);
