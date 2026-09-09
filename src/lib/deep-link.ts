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

export { lerErroDoLink, lerSessaoDoLink, type SessaoDoLink } from './confirmacao';
