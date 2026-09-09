/**
 * O que vem de volta no link de confirmação — e como ler sem se enganar.
 *
 * Fica separado de `deep-link.ts`, que importa `expo-linking`, por um motivo
 * prático: o que importa React Native não roda fora do app, e este é
 * justamente o trecho que precisa de teste. Um link malformado que devolve
 * `null` em silêncio vira "confirmei e não entrou", sem nada no caminho para
 * investigar.
 */

/**
 * A sessão que o Supabase devolve no fim do link.
 *
 * Ela vem depois do `#`, e não como parâmetro de consulta, de propósito: o que
 * está depois do `#` não é enviado ao servidor em requisição nenhuma. Um token
 * em `?query` acabaria em log de servidor, de proxy e de CDN.
 */
export type SessaoDoLink = { accessToken: string; refreshToken: string };

export function lerSessaoDoLink(url: string | null): SessaoDoLink | null {
  if (!url) return null;

  const corte = url.indexOf('#');
  if (corte === -1) return null;

  const campos = new URLSearchParams(url.slice(corte + 1));
  const accessToken = campos.get('access_token');
  const refreshToken = campos.get('refresh_token');
  if (!accessToken || !refreshToken) return null;

  return { accessToken, refreshToken };
}

/** O erro que o Supabase devolve no mesmo lugar quando o link não vale mais. */
export function lerErroDoLink(url: string | null): string | null {
  if (!url) return null;
  const corte = url.indexOf('#');
  if (corte === -1) return null;

  const campos = new URLSearchParams(url.slice(corte + 1));
  const codigo = campos.get('error_code');
  const descricao = campos.get('error_description');
  if (!codigo && !descricao) return null;

  // A frase do Supabase vem em inglês e com jargão ("otp_expired"). Quem
  // recebeu o e-mail ontem e clicou hoje precisa saber o que fazer, não o nome
  // do erro.
  if (codigo === 'otp_expired' || descricao?.includes('expired')) {
    return 'Este link expirou. Peça um novo na tela de confirmação.';
  }
  return 'Não consegui confirmar por este link. Peça um novo e tente de novo.';
}
