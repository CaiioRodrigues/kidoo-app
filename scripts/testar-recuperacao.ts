/**
 * A leitura do link de redefinição de senha do painel.
 *
 * Roda com `npm run test:recuperacao`. Existe porque o engano aqui é
 * silencioso: o painel roda com `detectSessionInUrl: true`, então um `hash`
 * lido errado não quebra nada — apenas deixa de parar a pessoa na tela da
 * senha nova. Ela cai no painel logada, com a senha antiga ainda valendo, e
 * nada na tela diz que o pedido não se completou.
 *
 * O que parece filigrana e não é: o link de confirmação traz `type=signup` e o
 * de redefinição traz `type=recovery`, no mesmo formato e no mesmo lugar.
 * Confundir os dois inverte as duas telas.
 */
import { ehLinkDeRecuperacao, erroDoLink } from '../partner/src/recuperacao';

const falhas: string[] = [];
const ok = (cond: boolean, msg: string) => {
  console.log((cond ? '  OK    ' : '  FALHA ') + msg);
  if (!cond) falhas.push(msg);
};

// O formato que o Supabase devolve de verdade, com os tokens abreviados.
const RECUPERACAO =
  '#access_token=eyJhbG.abc&expires_at=1789&refresh_token=xY9&token_type=bearer&type=recovery';
const CONFIRMACAO =
  '#access_token=eyJhbG.abc&expires_at=1789&refresh_token=xY9&token_type=bearer&type=signup';

ok(ehLinkDeRecuperacao(RECUPERACAO), 'o link de redefinição é reconhecido');
ok(
  !ehLinkDeRecuperacao(CONFIRMACAO),
  'o link de confirmação NÃO é tratado como redefinição — senão as duas telas trocam de lugar',
);
ok(!ehLinkDeRecuperacao(''), 'sem hash não é redefinição');
ok(!ehLinkDeRecuperacao('#'), 'hash vazio não é redefinição');
ok(
  !ehLinkDeRecuperacao('?type=recovery'),
  'só o fragmento conta: em `?query` o token iria para log de servidor, e não é ali que ele vem',
);
ok(!ehLinkDeRecuperacao('#type=recovery_outro'), 'o valor é comparado inteiro, não por prefixo');

// O link vencido não traz `type`, só o erro — e sem lê-lo a pessoa volta ao
// login sem explicação, achando que clicou errado.
const vencido =
  '#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired';
ok(!ehLinkDeRecuperacao(vencido), 'link vencido não abre a tela de senha nova');
ok(erroDoLink(vencido)?.includes('expirou') === true, 'link vencido é dito como vencido');
ok(erroDoLink(RECUPERACAO) === null, 'link bom não inventa erro');
ok(erroDoLink('') === null, 'sem hash não há erro a mostrar');

const outro = '#error=server_error&error_description=Unexpected+failure';
ok(
  erroDoLink(outro) !== null && !erroDoLink(outro)!.includes('expirou'),
  'erro que não é vencimento não é anunciado como vencimento',
);

console.log(falhas.length === 0 ? '\ntudo certo' : `\n${falhas.length} falha(s)`);
process.exit(falhas.length === 0 ? 0 : 1);
