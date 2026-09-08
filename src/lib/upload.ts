import * as FileSystem from 'expo-file-system';

import { base64ParaBytes } from './base64';

/**
 * Lê um arquivo local para bytes, para subir ao Storage.
 *
 * Parece que devia ser `await fetch(uri).then((r) => r.arrayBuffer())`, e é
 * essa a armadilha: no React Native o `fetch` de `file://` devolve um Blob que
 * o cliente do Supabase envia com tamanho zero. O arquivo sobe, o upload
 * responde sucesso, e o que fica no bucket é um arquivo vazio — o pior tipo de
 * falha, porque nada acusa até alguém tentar ver a foto.
 *
 * O caminho que funciona é ler em base64 pelo `expo-file-system` e converter
 * aqui. Bytes de verdade, tamanho conferível.
 */
export async function lerArquivoLocal(uri: string): Promise<Uint8Array> {
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return base64ParaBytes(base64);
}

/** Tipo MIME a partir da extensão. O Storage recusa o que não estiver na lista do bucket. */
export function tipoDaImagem(uri: string): string {
  const limpo = uri.split('?')[0] ?? '';
  if (/\.png$/i.test(limpo)) return 'image/png';
  if (/\.webp$/i.test(limpo)) return 'image/webp';
  return 'image/jpeg';
}

/**
 * `file://…` e `content://…` são do aparelho; `http…` já é remoto.
 *
 * É um type guard para quem chama não precisar de `as string` depois de
 * checar — o cast some e a checagem passa a valer para o compilador.
 */
export function ehArquivoLocal(uri: string | null): uri is string {
  if (!uri) return false;
  return uri.startsWith('file:') || uri.startsWith('content:');
}
