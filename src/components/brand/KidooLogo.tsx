import { Image } from 'expo-image';

/**
 * A marca do Kidoo.
 *
 * Era uma reconstrução: a palavra "Kid" em Poppins mais dois círculos com
 * sorrisos desenhados por cima. Funcionava porque o logotipo não existia em
 * arquivo — e divergia da arte de verdade em tudo que uma reconstrução
 * diverge: peso das letras, curva do sorriso, espaçamento.
 *
 * Agora é o arquivo. A mesma marca no app, no painel do parceiro e no
 * material impresso.
 *
 * `onDark` saiu junto: a arte tem contorno branco próprio e se sustenta sobre
 * fundo claro e escuro. Manter a propriedade seria oferecer um botão que não
 * liga nada.
 */

/** Proporção da arte (439 × 180). Fixa aqui para reservar o espaço certo. */
const PROPORCAO = 439 / 180;

export function KidooLogo({ size = 44 }: { size?: number }) {
  // `size` continua significando o corpo da palavra, como na versão anterior,
  // para as telas não precisarem reaprender o número. A altura total inclui os
  // pingos acima do "o", que é o que o 1.12 traz.
  const altura = size * 1.12;

  return (
    <Image
      source={require('../../../assets/kidoo-logo.webp')}
      contentFit="contain"
      style={{ width: altura * PROPORCAO, height: altura }}
      accessibilityLabel="Kidoo"
      transition={0}
    />
  );
}
