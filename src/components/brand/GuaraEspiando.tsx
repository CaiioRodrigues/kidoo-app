import { Image } from 'expo-image';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';


/**
 * O guará espia da borda da tela e some.
 *
 * A abertura segura a marca por três segundos, e três segundos de logo parada
 * é tempo demais para pedir de alguém. Ele entra depois que a frase assentou,
 * fica o tempo de ser notado e se recolhe — a graça está em ele sair sozinho,
 * sem virar mais uma coisa esperando toque.
 *
 * A arte é uma pose própria: ele agarra uma borda e se debruça. Antes eu usava
 * a pose de pé, recortada — e mão na cintura não lê como espiar, lê como
 * posar. O que faz a cena funcionar é a mão segurando alguma coisa, e o corte
 * do quadro emprestando a borda da tela para ela ser essa coisa.
 */
/** Proporção da arte (244 × 420). Fixa para reservar o espaço certo. */
const PROPORCAO = 244 / 420;

export function GuaraEspiando({
  altura = 210,
  /**
   * Depois de quanto tempo ele aparece. A marca e a frase assentam em ~750 ms;
   * ele entra logo depois.
   */
  atraso = 900,
  /**
   * Quanto tempo fica à mostra antes de recolher.
   *
   * A conta inteira tem de caber nos 3,2 s da abertura, e sobrar folga: com
   * 1000 aqui, o recolhimento só começava aos 2,67 s e a tela cortava no meio
   * dele — ele não saía, era interrompido. Com 800 a saída termina aos 2,58 s
   * e ainda restam seis décimos de calmaria antes do corte.
   */
  permanencia = 800,
}: {
  altura?: number;
  atraso?: number;
  permanencia?: number;
}) {
  const largura = altura * PROPORCAO;
  // Quem pediu menos movimento no sistema costuma ter um motivo — enjoo,
  // vertigem, epilepsia fotossensível. Ele continua ali, parado no ponto onde
  // pararia: some o movimento, não o personagem.
  const semMovimento = useReducedMotion();

  /*
    Deslocamentos em px, para a direita. O elemento está preso em `right: 0`,
    então o que fica visível é `largura - deslocamento`.

    `escondido` é a largura inteira: um valor menor deixa um pedaço para fora o
    tempo todo, e aí ele não espia — balança na borda. Foi o que a primeira
    versão fazia, com 0.52: ia de 63px visíveis a 92px e voltava, um gingado de
    trinta pixels que ninguém leria como esconder-se.
  */
  const escondido = largura;
  const aMostra = largura * 0.34;

  // Sem rotação: a pose já vem inclinada no desenho, com o corpo torcido em
  // volta da borda. Girar por cima disso incliná-lo-ia duas vezes, e o que era
  // debruçar viraria tombar.
  const x = useSharedValue(semMovimento ? aMostra : escondido);

  // Dentro de um efeito, e não no corpo do componente: escrever num valor
  // compartilhado durante a renderização é efeito colateral em renderização —
  // qualquer re-render reiniciaria a animação do zero, e ela recomeçaria no
  // meio da entrada. Aqui ela dispara uma vez, na montagem.
  useEffect(() => {
    if (semMovimento) return;
    // `back` dá um repique curto no fim da entrada: é o que separa "espiou" de
    // "deslizou". Na saída não tem repique — quem se esconde não titubeia.
    x.value = withDelay(
      atraso,
      withSequence(
        withTiming(aMostra, { duration: 520, easing: Easing.out(Easing.back(1.4)) }),
        withDelay(permanencia, withTiming(escondido, { duration: 360, easing: Easing.in(Easing.quad) })),
      ),
    );
  }, [semMovimento, atraso, permanencia, aMostra, escondido, x]);

  const estilo = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  return (
    // Escondido de leitores de tela: é enfeite de abertura, e anunciar "o
    // guará, mascote do Kidoo" no meio de uma tela que já se identificou só
    // atrasa quem está esperando o app abrir.
    <View
      style={styles.canto}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Animated.View style={estilo}>
        <Image
          source={require('../../../assets/guara-espiando.webp')}
          contentFit="contain"
          style={{ width: largura, height: altura }}
          transition={0}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  /* Preso à direita e abaixo do meio: ali ele não disputa espaço com a marca,
     que é o motivo da tela existir. */
  canto: { position: 'absolute', right: 0, top: '58%' },
});
