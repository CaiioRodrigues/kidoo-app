/**
 * Chaves de funcionalidade decididas em tempo de build.
 *
 * `__DEV__` é falso em qualquer build de release — inclusive no APK de
 * preview que se instala no aparelho para testar. Recursos que só existem
 * para exercitar um fluxo precisam de uma segunda porta, senão só funcionam
 * com o Metro rodando.
 */

/**
 * Mostra o atalho que simula a leitura do código pelo parceiro.
 *
 * Enquanto o app do parceiro não existe, é a única forma de fechar o ciclo de
 * confirmação. Fica ligado em desenvolvimento e nas builds de preview
 * (via `EXPO_PUBLIC_ENABLE_PARTNER_SIM`), e desligado em produção — lá a
 * confirmação tem que vir do parceiro de verdade.
 */
export const PARTNER_SIMULATION_ENABLED =
  __DEV__ || process.env.EXPO_PUBLIC_ENABLE_PARTNER_SIM === 'true';
