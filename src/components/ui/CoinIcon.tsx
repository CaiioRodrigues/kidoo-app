import Svg, { Circle, Path } from 'react-native-svg';

/**
 * O Kidoo Coin, desenhado.
 *
 * Era o emoji 🪙, e ele falhava de dois jeitos ao mesmo tempo:
 *
 * 1. **Cortado.** Emoji é desenhado pela fonte do sistema, cujas métricas são
 *    bem mais altas que as da Poppins. Na Home o estilo pedia `fontSize: 20`
 *    dentro da variante `body`, que fixa `lineHeight: 22` — e o Android corta o
 *    glifo na altura da linha. Era a metade de moeda que aparecia na tela.
 * 2. **Inexistente.** `🪙` é U+1FA99, do Emoji 12.0 (2019). Em Android 9 e
 *    anteriores ele não existe: vira quadradinho. O `minSdk` do projeto é 24
 *    (Android 7), então esses aparelhos estão dentro do alvo.
 *
 * Ajustar o `lineHeight` resolveria só o primeiro. Desenhar resolve os dois — e
 * é o mesmo caminho que `CategoryIcon` já tinha tomado: cada plataforma desenha
 * o seu emoji, e o app fica com a cara do sistema em vez da cara da marca.
 *
 * Preenchida, e não traçada como os ícones de modalidade: moeda é objeto
 * sólido, e um contorno fino a 14px vira borrão. O relevo é feito por um anel
 * mais escuro, que é o que dá volume sem depender de sombra.
 */
export function CoinIcon({ size = 16 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32">
      {/* O corpo. */}
      <Circle cx="16" cy="16" r="15" fill={FACE} />

      {/*
        O anel do relevo, por dentro da borda.

        `stroke` e não dois círculos empilhados: assim a espessura é uma só
        medida, e ela não muda de proporção quando o tamanho muda.
      */}
      <Circle cx="16" cy="16" r="12.2" stroke={RELIEF} strokeWidth="2" fill="none" />

      {/*
        O K.

        Traçado com ponta arredondada, e não preenchido: a 14px de tela o glifo
        tem uns 6px de altura, e forma vazada nesse tamanho fecha e vira mancha.
        Traço grosso mantém as três hastes separadas.
      */}
      <Path
        d="M12.4 9.6 L12.4 22.4 M12.4 16 L19.4 9.8 M12.4 16 L19.8 22.4"
        stroke={RELIEF}
        strokeWidth="2.9"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

/*
  As duas cores da moeda não vêm do tema, e não é esquecimento.

  Todo o resto do app troca de cor entre claro e escuro porque é superfície —
  fundo, cartão, texto. A moeda é um objeto: ela é amarela do mesmo amarelo nos
  dois, como uma moeda de verdade não muda de metal quando a luz da sala muda.
  O amarelo da marca tem contraste de sobra contra o fundo claro e o escuro, e
  foi medido nos dois antes de ficar assim.
*/
/** O amarelo da marca — o mesmo `brand.yellow` do tema. */
const FACE = '#FFC839';
/** Âmbar profundo do anel e do K. Escuro o bastante para ler sobre o amarelo. */
const RELIEF = '#B06A00';
