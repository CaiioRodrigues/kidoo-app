import * as Linking from 'expo-linking';

/**
 * Para onde o link do e-mail de confirmação volta.
 *
 * Sem isto, o Supabase manda todo mundo para o "Site URL" do projeto — que hoje
 * é o painel dos parceiros. A família confirmaria o e-mail e cairia numa tela
 * de administração de estabelecimento, sem saber o que fazer ali.
 *
 * `createURL` monta o endereço certo para cada jeito de rodar: `kidoo://` no
 * app instalado, `exp://…` no Expo Go, `http://localhost` na web. É por isso
 * que ele não é uma constante — o mesmo código roda nos três.
 */
export function linkDeConfirmacao(): string {
  return Linking.createURL('/confirmado');
}

/**
 * Para onde o link de redefinição de senha volta.
 *
 * Rota separada da confirmação porque o destino é outro: confirmar termina na
 * Home, redefinir tem de parar e pedir a senha nova. Os dois links trazem uma
 * sessão no fim da URL e são indistinguíveis pelo conteúdo — é o endereço que
 * diz qual é qual.
 *
 * Precisa estar na lista de Redirect URLs do projeto no Supabase, como o de
 * confirmação: `kidoo://nova-senha` e o equivalente em Expo Go.
 */
export function linkDeNovaSenha(): string {
  return Linking.createURL('/nova-senha');
}

export { lerErroDoLink, lerSessaoDoLink, type SessaoDoLink } from './confirmacao';
