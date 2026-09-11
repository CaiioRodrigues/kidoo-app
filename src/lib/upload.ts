import { File } from 'expo-file-system';

/**
 * Lê um arquivo local para bytes, para subir ao Storage.
 *
 * Parece que devia ser `await fetch(uri).then((r) => r.arrayBuffer())`, e é
 * essa a armadilha: no React Native o `fetch` de `file://` devolve um Blob que
 * o cliente do Supabase envia com tamanho zero. O arquivo sobe, o upload
 * responde sucesso, e o que fica no bucket é um arquivo vazio — o pior tipo de
 * falha, porque nada acusa até alguém tentar ver a foto.
 *
 * A versão anterior desviava por base64 (`FileSystem.readAsStringAsync`), e
 * esse desvio não existe mais: no expo-file-system 57 aquela função virou um
 * aviso de depreciação que **lança exceção ao ser chamada**. O typecheck não
 * pegava porque o aviso continua tipado como a função original — só falhava no
 * aparelho, e falhava antes de tocar na rede. Quem tentava trocar a foto via
 * "não foi possível enviar" sem nada ter sido enviado.
 *
 * `bytes()` é o caminho atual e é melhor que o antigo por dois motivos: não
 * passa por base64 (que inchava a foto em um terço na memória antes de virar
 * bytes de novo) e funciona tanto com `file://` quanto com o `content://` que
 * a galeria do Android entrega.
 */
export async function lerArquivoLocal(uri: string): Promise<Uint8Array> {
  return new File(uri).bytes();
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
