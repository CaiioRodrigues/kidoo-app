import { Image } from 'expo-image';

/**
 * O guará, mascote do Kidoo.
 *
 * Substitui o boneco geométrico que existia enquanto o personagem não existia
 * em arquivo. É a mesma arte do material de marca e do painel do parceiro:
 * quem conhece o Kidoo pela escolinha e quem conhece pelo app passam a ver a
 * mesma criatura.
 */

/**
 * As poses.
 *
 * `rosto` é só a cabeça, e é o padrão porque na maioria dos lugares ele aparece
 * a 54px — um bicho de corpo inteiro nesse tamanho é uma mancha laranja, some
 * o rosto, que é a única parte que comunica alguma coisa.
 *
 * As outras são meio-corpo, com gesto, e existem para o tutorial: cada passo
 * ganha a pose que combina com o que está sendo dito. A regra é essa e não é
 * decorativa — gesto que não casa com a frase lê como agitação, não como fala.
 */
const POSES = {
  rosto: require('../../../assets/guara.webp'),
  /** Mão aberta, acolhendo. Para apresentar-se. */
  apresenta: require('../../../assets/guara-apresenta.webp'),
  /** As duas mãos apontando para frente: "olha isto aqui". */
  aponta: require('../../../assets/guara-aponta.webp'),
  /** Piscada e joinha: "é simples, vai dar certo". */
  joia: require('../../../assets/guara-joia.webp'),
  /** Punhos erguidos. Para conquista. */
  comemora: require('../../../assets/guara-comemora.webp'),
} as const;

export type PoseDoGuara = keyof typeof POSES;

export function Guara({ size = 96, pose = 'rosto' }: { size?: number; pose?: PoseDoGuara }) {
  return (
    <Image
      source={POSES[pose]}
      // As poses têm proporções diferentes entre si; `contain` acomoda todas no
      // quadrado que a tela reservou, sem esticar nenhuma.
      contentFit="contain"
      style={{ width: size, height: size }}
      accessibilityLabel="O guará, mascote do Kidoo"
      // Sem transição: ele aparece junto com o balão de fala, e um fade
      // separado faria a fala chegar antes de quem está falando.
      transition={0}
    />
  );
}
