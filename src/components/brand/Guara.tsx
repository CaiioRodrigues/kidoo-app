import { Image } from 'expo-image';

/**
 * O guará, mascote do Kidoo.
 *
 * Substitui o boneco geométrico que existia enquanto o personagem não existia
 * em arquivo. É a mesma arte do material de marca e do painel do parceiro:
 * quem conhece o Kidoo pela escolinha e quem conhece pelo app passam a ver a
 * mesma criatura.
 *
 * **É a cabeça, e não o corpo inteiro.** No app ele aparece a 54px em quatro
 * dos cinco lugares, e um bicho de pé nesse tamanho é uma mancha laranja: some
 * o rosto, que é a única parte que comunica alguma coisa. O corpo inteiro fica
 * para a vitrine, onde há 350px de altura para gastar.
 *
 * Perdeu o `waving` do antecessor de propósito. Imagem parada não acena, e
 * propriedade que não faz nada é pior do que propriedade que não existe: a
 * próxima pessoa passa meia hora procurando por que o aceno não aparece.
 */
export function Guara({ size = 96 }: { size?: number }) {
  return (
    <Image
      source={require('../../../assets/guara.webp')}
      // A arte é mais alta que larga; `contain` mantém a proporção dentro do
      // quadrado que cada tela reservou para o mascote antigo.
      contentFit="contain"
      style={{ width: size, height: size }}
      accessibilityLabel="O guará, mascote do Kidoo"
      // Sem transição: ele aparece junto com o balão de fala, e um fade
      // separado faria a fala chegar antes de quem está falando.
      transition={0}
    />
  );
}
