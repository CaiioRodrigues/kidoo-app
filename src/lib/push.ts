import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * Aviso de vaga: permissão, token do aparelho e o canal do Android.
 *
 * Três limites que valem dizer em voz alta, porque cada um já custou tempo de
 * alguém em algum projeto:
 *
 * 1. **Não funciona no navegador nem no Expo Go.** Push do Expo exige uma build
 *    de verdade (o APK do EAS, ou uma dev build). Chamar isso na web devolve
 *    `null` de propósito, em vez de estourar no meio da tela de login.
 * 2. **Emulador não recebe.** `Device.isDevice` é falso e o token nem é
 *    emitido — testar isso exige aparelho na mão.
 * 3. **O token é do aparelho, não da pessoa.** Num celular de família, quem
 *    entra por último passa a ser o dono. Por isso registramos no login e
 *    damos baixa no logout: sem isso, a conta anterior continuaria recebendo
 *    os avisos de vaga desta.
 */

/** Como o aviso aparece com o app aberto. */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    // Vaga que abre é assunto de horário de aula, não de madrugada: banner e
    // lista bastam. Som e badge ficariam intrusivos para um aviso que a
    // família pode atender depois.
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export type PushPlatform = 'ios' | 'android' | 'web';

export const pushPlatform = (): PushPlatform =>
  Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web';

/**
 * Pede permissão e devolve o token do aparelho — ou `null` quando não dá.
 *
 * Nunca lança: falhar em registrar para avisos não pode impedir alguém de
 * entrar no app. O `null` é o caminho normal na web, no emulador e para quem
 * simplesmente recusou a permissão.
 */
export async function obterTokenDePush(): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  if (!Device.isDevice) return null;

  try {
    // O Android exige um canal declarado antes de qualquer notificação, senão
    // o aviso chega e não aparece — falha silenciosa, a pior de todas.
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('vagas', {
        name: 'Vagas que abrem',
        importance: Notifications.AndroidImportance.DEFAULT,
        description: 'Avisos de vaga em turmas que você pediu para acompanhar.',
      });
    }

    const atual = await Notifications.getPermissionsAsync();
    let concedida = atual.granted;
    // Só pergunta se ainda dá: quem já negou de vez não pode ser perguntado de
    // novo, e insistir aqui gastaria a única chance no iOS.
    if (!concedida && atual.canAskAgain) {
      const pedida = await Notifications.requestPermissionsAsync();
      concedida = pedida.granted;
    }
    if (!concedida) return null;

    // O `projectId` vem do EAS. Sem ele o SDK não sabe por qual projeto assinar
    // o token, e a chamada falha com uma mensagem que não diz isso.
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) return null;

    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    return data;
  } catch {
    // Sem token, sem aviso — e o app segue funcionando igual. A fila de espera
    // continua registrada no servidor, então a demanda não se perde.
    return null;
  }
}
