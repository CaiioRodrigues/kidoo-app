/**
 * Reconhecer o link de redefinição de senha antes do cliente consumi-lo.
 *
 * O painel roda com `detectSessionInUrl: true`, então o cliente do Supabase lê
 * os tokens do fim da URL e abre a sessão sozinho. Para o link de confirmação
 * isso é exatamente o desejado. Para o de redefinição é uma armadilha: quem
 * pediu senha nova cairia direto no painel, logado, com a senha antiga ainda
 * valendo — sem nenhuma tela pedindo a nova, e sem nada indicando que o pedido
 * não se completou.
 *
 * Daí a leitura acontecer aqui, sobre o texto cru do `hash`, e o resultado ser
 * capturado no carregamento do módulo: `supabase()` é preguiçoso, o cliente só
 * nasce na primeira chamada, e até lá o endereço ainda está inteiro.
 *
 * Funções puras, de propósito — `window` não entra aqui. É o que permite
 * exercitá-las fora do navegador (`npm run test:recuperacao`), e este é
 * justamente o trecho onde um engano é invisível: um `hash` lido errado não
 * quebra nada, só deixa de parar a pessoa na tela certa.
 */

/** O que o Supabase escreve no fim do link de redefinição. */
export function ehLinkDeRecuperacao(hash: string): boolean {
  const campos = camposDoHash(hash);
  if (!campos) return false;
  return campos.get('type') === 'recovery';
}

/**
 * O erro que vem no mesmo lugar quando o link não vale mais.
 *
 * Um link vencido não traz `type=recovery` — traz só o erro. Sem esta leitura
 * a pessoa voltaria para a tela de login sem explicação nenhuma, achando que
 * clicou errado.
 */
export function erroDoLink(hash: string): string | null {
  const campos = camposDoHash(hash);
  if (!campos) return null;

  const codigo = campos.get('error_code');
  const descricao = campos.get('error_description');
  if (!codigo && !descricao) return null;

  if (codigo === 'otp_expired' || descricao?.includes('expired')) {
    return 'Este link expirou. Peça outro e use dentro de uma hora.';
  }
  return 'Não consegui abrir este link. Peça outro e tente de novo.';
}

function camposDoHash(hash: string): URLSearchParams | null {
  if (!hash || !hash.startsWith('#')) return null;
  return new URLSearchParams(hash.slice(1));
}
