import { supabase } from '@/supabase';

/**
 * A votação, do lado de quem participa.
 *
 * Módulo próprio, fora de `PainelApi`, porque é outro produto com outro
 * público: aqui quem chega é `anon` — convidado de festa não cria conta — e
 * não há demonstração a espelhar. O que se mantém é o seam: este é o único
 * arquivo do lado do convidado que fala HTTP.
 *
 * O schema por baixo não sabe o que está sendo votado. Hoje é fantasia; um dia
 * pode ser melhor parceiro do ano, e nada aqui muda além dos rótulos que
 * alguém digitou ao criar a votação.
 */

export type Categoria = { id: string; label: string };
export type Inscrito = { id: string; name: string; photoPath: string };

export type Votacao = {
  id: string;
  title: string;
  subtitle: string | null;
  status: 'inscricoes' | 'votacao' | 'apurada';
  /** Se precisa da senha da festa para votar. A senha em si nunca sai do banco. */
  protegida: boolean;
  categories: Categoria[];
  entries: Inscrito[];
};

export type LinhaDoPodio = {
  categoryId: string;
  category: string;
  place: number;
  entryId: string;
  entry: string;
  photoPath: string;
  votes: number;
};

const BUCKET = 'votacao';

/**
 * Quem está votando, do jeito que dá para saber sem login.
 *
 * Fica no navegador e nunca muda. Não impede quem abrir uma janela anônima de
 * propósito — nada impede, sem entregar um código na mão de cada pessoa. O que
 * ele impede é o que de fato acontece: recarregar, voltar, clicar duas vezes.
 *
 * A garantia mesmo é o índice único no banco; isto aqui é só a chave.
 */
export function chaveDoVotante(): string {
  const GUARDA = 'kidoo.votante';
  try {
    const salva = localStorage.getItem(GUARDA);
    if (salva) return salva;
    const nova = crypto.randomUUID();
    localStorage.setItem(GUARDA, nova);
    return nova;
  } catch {
    // Navegador com armazenamento bloqueado: a pessoa vota, e o voto vale.
    // Perde só a memória de já ter votado — melhor que recusar o voto.
    return crypto.randomUUID();
  }
}

export function urlDaFoto(caminho: string): string {
  return supabase().storage.from(BUCKET).getPublicUrl(caminho).data.publicUrl;
}

function erro(mensagem: string, causa?: { message?: string }): Error {
  const CONHECIDOS: Record<string, string> = {
    entries_closed: 'As inscrições já fecharam.',
    voting_closed: 'A votação não está aberta.',
    wrong_passphrase: 'Senha da festa incorreta.',
    name_required: 'Escreva um nome.',
    photo_required: 'A foto é obrigatória.',
    already_counted: 'Esta votação já foi apurada.',
  };
  const conhecido = causa?.message ? CONHECIDOS[causa.message] : undefined;
  return new Error(conhecido ?? mensagem);
}

export async function votacaoAtual(): Promise<Votacao | null> {
  const { data, error } = await supabase().rpc('current_poll');
  if (error) throw erro('Não foi possível carregar a votação.', error);
  return (data as Votacao | null) ?? null;
}

export async function jaVotei(pollId: string): Promise<boolean> {
  const { data, error } = await supabase().rpc('has_voted', {
    p_poll_id: pollId,
    p_voter_key: chaveDoVotante(),
  });
  if (error) return false;
  return data === true;
}

/** Sobe a foto e cria a inscrição. A foto vem primeiro porque ela É a inscrição. */
export async function inscrever(pollId: string, nome: string, arquivo: File): Promise<void> {
  if (arquivo.size > 5 * 1024 * 1024) {
    throw new Error('A foto passa de 5 MB. Tire outra ou escolha uma menor.');
  }
  // Nome único por envio: duas pessoas se inscrevendo ao mesmo tempo não podem
  // sobrescrever a foto uma da outra.
  const caminho = `${pollId}/${crypto.randomUUID()}`;
  const { error: erroUpload } = await supabase()
    .storage.from(BUCKET)
    .upload(caminho, arquivo, { contentType: arquivo.type });
  if (erroUpload) throw new Error('Não foi possível enviar a foto.');

  const { error } = await supabase().rpc('submit_entry', {
    p_poll_id: pollId,
    p_name: nome,
    p_photo_path: caminho,
  });
  if (error) throw erro('Não foi possível concluir a inscrição.', error);
}

export async function votar(
  pollId: string,
  escolhas: Record<string, string>,
  senha?: string,
): Promise<void> {
  const { error } = await supabase().rpc('cast_ballot', {
    p_poll_id: pollId,
    p_voter_key: chaveDoVotante(),
    p_choices: escolhas,
    p_passphrase: senha ?? null,
  });
  if (error) {
    // O índice único é quem barra o voto repetido, e ele fala em código, não
    // em português. A frase certa importa: "erro desconhecido" faria a pessoa
    // tentar de novo a noite inteira.
    if (error.code === '23505') throw new Error('Este aparelho já votou.');
    throw erro('Não foi possível registrar seu voto.', error);
  }
}

export async function resultado(pollId: string): Promise<LinhaDoPodio[]> {
  const { data, error } = await supabase().rpc('poll_results', { p_poll_id: pollId });
  if (error) throw erro('Não foi possível carregar o resultado.', error);
  return ((data ?? []) as Record<string, unknown>[]).map((l) => ({
    categoryId: String(l.category_id),
    category: String(l.category),
    place: Number(l.place),
    entryId: String(l.entry_id),
    entry: String(l.entry),
    photoPath: String(l.photo_path),
    votes: Number(l.votes),
  }));
}
