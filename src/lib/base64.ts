const ALFABETO = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/**
 * base64 → bytes, sem `atob` e sem dependência nova.
 *
 * O Hermes não tem `atob`, e o `Buffer` do Node não vai no bundle do Expo.
 * São vinte linhas para não carregar um pacote inteiro por causa de uma foto
 * de perfil.
 *
 * Fica separado de `upload.ts` de propósito: aquele importa `expo-file-system`
 * e não carrega fora do app, então o teste (`npm run test:base64`) exercitaria
 * uma cópia em vez desta função. Cópia é onde as duas versões divergem sem
 * ninguém ver.
 */
export function base64ParaBytes(base64: string): Uint8Array {
  // A limpeza também tira o `=` do preenchimento, então `limpo` já tem só os
  // caracteres que viram bytes.
  const limpo = base64.replace(/[^A-Za-z0-9+/]/g, '');

  // `Math.floor` explícito: `new Uint8Array(1.5)` trunca para 1 sozinho, e o
  // tamanho sairia certo mesmo sem isto — mas por acidente da linguagem, e
  // acidente não é contrato. Escrito assim, quem lê não precisa saber que V8
  // trunca em vez de arredondar.
  const bytes = new Uint8Array(Math.floor((limpo.length * 3) / 4));

  let escrita = 0;
  for (let i = 0; i < limpo.length; i += 4) {
    const a = ALFABETO.indexOf(limpo[i] ?? 'A');
    const b = ALFABETO.indexOf(limpo[i + 1] ?? 'A');
    const c = ALFABETO.indexOf(limpo[i + 2] ?? 'A');
    const d = ALFABETO.indexOf(limpo[i + 3] ?? 'A');

    bytes[escrita++] = (a << 2) | (b >> 4);
    if (limpo[i + 2] !== undefined) bytes[escrita++] = ((b & 15) << 4) | (c >> 2);
    if (limpo[i + 3] !== undefined) bytes[escrita++] = ((c & 3) << 6) | d;
  }

  // Sendo honesto sobre esta linha: com a limpeza tirando o `=`, o tamanho
  // alocado já bate com o escrito, e sabotar o `subarray` não muda resultado
  // nenhum. Ela fica como rede — o dia em que a alocação virar `Math.ceil`,
  // ou alguém decidir manter o preenchimento, o tamanho continua saindo do que
  // foi escrito de fato.
  return bytes.subarray(0, escrita);
}
