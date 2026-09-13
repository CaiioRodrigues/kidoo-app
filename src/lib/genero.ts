import type { Gender } from '@/types/domain';

/**
 * A concordância do nome da criança no texto das telas.
 *
 * O cadastro pergunta o gênero desde o primeiro dia e nunca usou a resposta
 * para nada visível: todo texto dizia "do", no masculino, para todo mundo.
 * Metade das famílias lia "Jornada do Alice" — e errar o gênero da filha na
 * primeira tela que ela abre não é detalhe de revisão, é a criança aparecendo
 * errada no lugar em que o app deveria mostrá-la.
 *
 * `undisclosed` não é um terceiro gênero a acertar: é a família tendo decidido
 * não responder. Aqui isso vira a forma que não pede gênero nenhum — "Jornada
 * de Alice", "movimentar Alice" —, que é gramatical em português e não força
 * uma escolha que ninguém fez.
 *
 * As funções devolvem a expressão inteira, com o nome dentro, em vez de só o
 * artigo. Devolver `'o '` com espaço no fim seria pedir para alguém, um dia,
 * juntar as duas partes sem o espaço e nunca ver — o erro só apareceria na
 * tela de quem instalou o app.
 */

/** Posse: `do João`, `da Alice`, `de Alice`. */
export function possessivo(nome: string, genero: Gender): string {
  if (genero === 'boy') return `do ${nome}`;
  if (genero === 'girl') return `da ${nome}`;
  return `de ${nome}`;
}

/** Objeto direto: `o João`, `a Alice`, `Alice`. */
export function comArtigo(nome: string, genero: Gender): string {
  if (genero === 'boy') return `o ${nome}`;
  if (genero === 'girl') return `a ${nome}`;
  return nome;
}
