import { Alert, Platform } from 'react-native';

/**
 * Pergunta "tem certeza?" e devolve a resposta.
 *
 * Existe porque `Alert.alert` **não é implementado no React Native Web**: no
 * navegador o diálogo simplesmente não aparece, e o código que dependia da
 * confirmação nunca roda. Era o caso de "Sair da conta" e "Cancelar reserva" —
 * botões que, na web, não faziam absolutamente nada ao serem tocados.
 *
 * Não é só um detalhe de desenvolvimento: a versão web é onde revisamos as
 * telas, e um botão morto ali passa despercebido até chegar ao aparelho.
 */
export function confirmAction(options: {
  title: string;
  message: string;
  /** Rótulo do botão que confirma. O de cancelar é sempre "Cancelar". */
  confirmLabel: string;
  /** Pinta o botão de confirmação como ação perigosa (iOS). */
  destructive?: boolean;
}): Promise<boolean> {
  if (Platform.OS === 'web') {
    // `confirm` é bloqueante e feio, mas é o único diálogo que todo navegador
    // tem sem uma biblioteca de modal no meio — e a alternativa atual é nada.
    const ok = globalThis.confirm?.(`${options.title}\n\n${options.message}`) ?? false;
    return Promise.resolve(ok);
  }

  return new Promise((resolve) => {
    Alert.alert(options.title, options.message, [
      { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
      {
        text: options.confirmLabel,
        style: options.destructive ? 'destructive' : 'default',
        onPress: () => resolve(true),
      },
    ]);
  });
}
