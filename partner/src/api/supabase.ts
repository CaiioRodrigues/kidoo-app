import { erroDeEnvio } from '@app/lib/erro-de-envio';
import { mensagemDeAuth } from '@/mensagens-de-auth';
import { supabase } from '@/supabase';
import { PainelError } from './types';
import type {
  PainelApi,
  ActivityRow,
  AgendaRow,
  Categoria,
  NovoPedido,
  Partner,
  Pedido,
  PedidoNaFila,
  ResultadoDaConta,
  ResultadoDaSerie,
  RosterRow,
  StatementRow,
} from './types';
import type { ActivityCategoryId, SlotKind } from '@app/types/domain';

/**
 * O que o painel lê e escreve.
 *
 * Tudo passa por funções do banco. Não é preferência de estilo: `children` é
 * privado por RLS e continua sendo — o parceiro nunca lista criança, ele chama
 * `session_roster`, que devolve só primeiro nome e idade das crianças que
 * reservaram com ele. E `kind` não é escrito por ninguém: é derivado da lotação
 * da turma, senão o parceiro escolheria o próprio repasse.
 */

/** Mensagens que as funções do banco levantam, em palavras de balcão. */
const MENSAGENS: Record<string, string> = {
  not_authenticated: 'Sua sessão expirou. Entre de novo.',
  not_this_partner: 'Esta turma não é do seu estabelecimento.',
  session_not_found: 'Turma não encontrada.',
  session_in_the_past: 'Não dá para publicar uma turma que já começou.',
  over_capacity: 'A soma de matriculados e vagas abertas passa da capacidade da turma.',
  negative_slots: 'O número de vagas não pode ser negativo.',
  no_dates: 'Escolha pelo menos um dia da semana para a turma se repetir.',
  not_admin: 'Sua conta não analisa pedidos de estabelecimento.',
  application_not_found: 'Pedido não encontrado.',
  already_approved: 'Este pedido já foi aprovado.',
  unknown_category: 'Uma das modalidades escolhidas não existe mais.',
  reason_required: 'Diga o motivo da recusa — é ele que volta para quem pediu.',
  too_many_dates: 'São turmas demais de uma vez. Reduza os dias ou as semanas.',
  slots_already_taken:
    'Já há reservas nestas vagas. Reduza só até o número que já foi reservado.',
  booking_not_found: 'Reserva não encontrada.',
  no_check_in: 'Esta família ainda não fez o check-in no aplicativo.',
  wrong_code: 'Código inválido para esta reserva.',
  code_expired: 'O código expirou. Peça para a família gerar um novo no app.',
};

function traduz(erro: { message: string } | null, padrao: string): never {
  const conhecido = erro ? MENSAGENS[erro.message] : undefined;
  throw new PainelError(conhecido ?? padrao);
}

function ok<T>(resultado: { data: T | null; error: { message: string } | null }, padrao: string): T {
  if (resultado.error) traduz(resultado.error, padrao);
  if (resultado.data === null) throw new PainelError(padrao);
  return resultado.data;
}

/**
 * Chama uma função do banco que devolve conjunto.
 *
 * O supabase-js tipa `rpc()` como valor único, e `partner_agenda`,
 * `session_roster` e `partner_statement` são `returns table`. A conversão fica
 * aqui, num lugar só, em vez de espalhada por cada chamada.
 */
async function linhasDe<T>(
  funcao: string,
  args: Record<string, unknown>,
  padrao: string,
): Promise<T[]> {
  const { data, error } = await supabase().rpc(funcao, args);
  if (error) traduz(error, padrao);
  return (data ?? []) as T[];
}

// ------------------------------------------------------------------ sessão --

async function entrar(email: string, senha: string): Promise<void> {
  const { error } = await supabase().auth.signInWithPassword({ email, password: senha });
  // A mesma frase para e-mail inexistente e senha errada: separar as duas
  // entrega quais e-mails têm conta.
  if (error) throw new PainelError('E-mail ou senha incorretos.');
}

/**
 * Cria a conta de quem vai administrar o estabelecimento.
 *
 * Sem esta porta o cadastro de parceiro era inalcançável: o painel só sabia
 * entrar, e entrar exige uma conta que só existia se alguém a criasse por
 * fora. O formulário de pedido ficava atrás de um login impossível.
 */
async function criarConta(email: string, senha: string): Promise<ResultadoDaConta> {
  const { data, error } = await supabase().auth.signUp({
    email,
    password: senha,
    // Para onde o link do e-mail volta. Sem isto ele cai no "Site URL" do
    // projeto, que é o app das famílias: o dono da escolinha confirmaria o
    // e-mail e seria despejado no aplicativo errado.
    options: { emailRedirectTo: window.location.origin },
  });

  if (error) throw new PainelError(mensagemDeAuth(error.message, 'Não foi possível criar a conta.'));

  // Sem sessão = o projeto exige confirmar o e-mail. Não é erro; é outra tela.
  return data.session ? { status: 'entrou' } : { status: 'confirmar', email };
}

/**
 * Manda o link de redefinição.
 *
 * O que pode ser dito sobre a falha vem de `erroDeEnvio`, o mesmo módulo que o
 * app usa: ele separa os erros que valem para todo endereço igualmente —
 * destino fora das Redirect URLs, SMTP recusando — dos que dependeriam do
 * e-mail digitado. Os primeiros passam; os outros, e todo desconhecido, ficam
 * calados, senão a tela viraria um verificador de quais estabelecimentos são
 * parceiros do Kidoo.
 *
 * Regra compartilhada e não copiada de propósito: duas cópias é como um lado
 * ganharia um caso que o outro não tem, e aqui isso significaria um vazamento
 * num dos dois.
 *
 * `redirectTo` é a origem do painel, sem caminho novo: o link volta para a
 * mesma página que o de confirmação já usa, e é o `type=recovery` no fim da
 * URL que decide qual tela abrir. Assim não é preciso cadastrar nenhum
 * endereço a mais nas Redirect URLs do projeto.
 */
async function pedirNovaSenha(email: string): Promise<void> {
  const { error } = await supabase().auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin,
  });
  if (!error) return;

  const dizivel = erroDeEnvio(error.message);
  if (dizivel) throw new PainelError(dizivel);
  // Calado de propósito: a tela segue para "confira seu e-mail", que é a mesma
  // resposta que um endereço sem conta recebe.
}

async function definirNovaSenha(senha: string): Promise<void> {
  const { error } = await supabase().auth.updateUser({ password: senha });
  // Aqui a frase do servidor vai junto: ela fala da senha escolhida — curta
  // demais, repetida, vazada em base pública — para quem já está autenticado.
  // Não vaza nada sobre quem tem conta.
  if (error) {
    throw new PainelError(mensagemDeAuth(error.message, 'Não foi possível salvar a senha.'));
  }
}

async function sair(): Promise<void> {
  await supabase().auth.signOut();
}

/**
 * Quais estabelecimentos este usuário administra.
 *
 * Lista vazia não é erro: é uma conta que existe mas não foi vinculada a
 * nenhum parceiro — o caso de alguém entrar com a conta de família aqui. A
 * tela explica em vez de mostrar um painel vazio.
 */
async function meusParceiros(): Promise<Partner[]> {
  const linhas = ok(
    await supabase()
      .from('partner_members')
      .select('role, partner:partners(id, name, neighborhood, city)')
      .returns<
        {
          role: string;
          partner: { id: string; name: string; neighborhood: string; city: string } | null;
        }[]
      >(),
    'Não foi possível identificar seu estabelecimento.',
  );

  // Sem `limit(1)`, que era a origem do problema: a agenda já vinha com as
  // turmas de todos os lugares que a conta administra, e a tela nomeava um só.
  return linhas
    .filter((l): l is typeof l & { partner: NonNullable<typeof l.partner> } => l.partner !== null)
    .map((l) => ({ ...l.partner, role: l.role }))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}

// ------------------------------------------------------------------ agenda --

type AgendaSql = {
  session_id: string;
  activity_id: string;
  activity_title: string;
  category_id: string;
  partner_id: string;
  partner_name: string;
  starts_at: string;
  capacity: number;
  enrolled: number;
  slots_open: number;
  slots_taken: number;
  kind: SlotKind;
  coin_cost: number;
  checked_in: number;
  confirmed: number;
};

async function agenda(de: Date, ate: Date): Promise<AgendaRow[]> {
  const linhas = await linhasDe<AgendaSql>(
    'partner_agenda',
    { p_from: de.toISOString(), p_to: ate.toISOString() },
    'Não foi possível carregar a agenda.',
  );

  return linhas.map((linha) => ({
    sessionId: linha.session_id,
    activityId: linha.activity_id,
    activityTitle: linha.activity_title,
    category: linha.category_id as ActivityCategoryId,
    partnerId: linha.partner_id,
    partnerName: linha.partner_name,
    startsAt: linha.starts_at,
    capacity: linha.capacity,
    enrolled: linha.enrolled,
    slotsOpen: linha.slots_open,
    slotsTaken: linha.slots_taken,
    kind: linha.kind,
    coinCost: linha.coin_cost,
    checkedIn: Number(linha.checked_in),
    confirmed: Number(linha.confirmed),
  }));
}

type RosterSql = {
  booking_id: string;
  child_first_name: string;
  child_age: number;
  status: RosterRow['status'];
  checked_in_at: string | null;
  partner_confirmed_at: string | null;
  slot_kind: SlotKind;
  has_code: boolean;
  location_verified: boolean | null;
};

async function listaDaTurma(sessionId: string): Promise<RosterRow[]> {
  const linhas = await linhasDe<RosterSql>(
    'session_roster',
    { p_session_id: sessionId },
    'Não foi possível carregar a lista da turma.',
  );

  return linhas.map((linha) => ({
    bookingId: linha.booking_id,
    firstName: linha.child_first_name,
    age: linha.child_age,
    status: linha.status,
    checkedInAt: linha.checked_in_at,
    partnerConfirmedAt: linha.partner_confirmed_at,
    slotKind: linha.slot_kind,
    hasCode: linha.has_code,
    locationVerified: linha.location_verified,
  }));
}

/** Confirma a presença lendo o código que a família mostra. */
async function confirmarPresenca(bookingId: string, codigo: string): Promise<void> {
  const { error } = await supabase().rpc('confirm_by_partner', {
    p_booking_id: bookingId,
    p_code: codigo.replace(/\D/g, ''),
  });
  if (error) traduz(error, 'Não foi possível confirmar a presença.');
}

// ------------------------------------------------------------------- vagas --

async function definirVagas(sessionId: string, vagas: number): Promise<void> {
  const { error } = await supabase().rpc('set_slots_open', {
    p_session_id: sessionId,
    p_slots_open: vagas,
  });
  if (error) traduz(error, 'Não foi possível atualizar as vagas.');
}

async function publicarTurma(entrada: {
  activityId: string;
  startsAt: string;
  capacity: number;
  enrolled: number;
  slotsOpen: number;
  coinCost: number;
}): Promise<void> {
  const { error } = await supabase().rpc('publish_session', {
    p_activity_id: entrada.activityId,
    p_starts_at: new Date(entrada.startsAt).toISOString(),
    p_capacity: entrada.capacity,
    p_enrolled: entrada.enrolled,
    p_slots_open: entrada.slotsOpen,
    p_coin_cost: entrada.coinCost,
  });
  // `kind` não vai aqui de propósito: é derivado da lotação no banco.
  if (error) traduz(error, 'Não foi possível publicar a turma.');
}

/**
 * Publica a série inteira numa chamada.
 *
 * Uma chamada, uma transação: ou as oito semanas entram, ou nenhuma entra.
 * Oito `publicarTurma` em laço deixariam meia série publicada quando o 4G da
 * escolinha caísse no meio — e ninguém saberia quais quatro faltam.
 */
async function publicarSerie(entrada: {
  activityId: string;
  quando: Date[];
  capacity: number;
  enrolled: number;
  slotsOpen: number;
  coinCost: number;
}): Promise<ResultadoDaSerie> {
  type SerieSql = { quando: string; session_id: string | null; pulada: string | null };
  const linhas = await linhasDe<SerieSql>(
    'publish_sessions',
    {
      p_activity_id: entrada.activityId,
      p_starts_at: entrada.quando.map((d) => d.toISOString()),
      p_capacity: entrada.capacity,
      p_enrolled: entrada.enrolled,
      p_slots_open: entrada.slotsOpen,
      p_coin_cost: entrada.coinCost,
    },
    'Não foi possível publicar as turmas.',
  );

  return {
    publicadas: linhas.filter((l) => l.pulada === null).length,
    jaExistiam: linhas.filter((l) => l.pulada === 'ja_existia').length,
    noPassado: linhas.filter((l) => l.pulada === 'no_passado').length,
  };
}

async function minhasAtividades(partnerIds: string[]): Promise<ActivityRow[]> {
  // Sem id nenhum não há o que buscar — e um `in` vazio no PostgREST traria a
  // tabela inteira, que é pública para leitura: as atividades de todo mundo.
  if (partnerIds.length === 0) return [];

  const linhas = ok(
    await supabase()
      .from('activities')
      .select('id, title, category_id, image_url, partner_id, parceiro:partners(name)')
      .in('partner_id', partnerIds)
      .eq('active', true)
      .order('title')
      .returns<
        {
          id: string;
          title: string;
          category_id: string;
          image_url: string | null;
          partner_id: string;
          parceiro: { name: string } | null;
        }[]
      >(),
    'Não foi possível carregar suas atividades.',
  );
  return linhas.map((l) => ({
    id: l.id,
    title: l.title,
    category: l.category_id as ActivityCategoryId,
    partnerId: l.partner_id,
    partnerName: l.parceiro?.name ?? '',
    imageUrl: l.image_url,
  }));
}

const BUCKET_ATIVIDADES = 'atividades';

/**
 * Sobe a capa da atividade e devolve a URL pública.
 *
 * O bucket é público porque é vitrine: cada cartão do catálogo mostra esta
 * imagem, e assinar uma URL por cartão seria dezenas de idas ao servidor para
 * montar uma tela de lista.
 *
 * O caminho é `atividades/<parceiro>/<atividade>` porque é a primeira pasta
 * que a policy do Storage compara com `is_partner_member`. Sem o id do
 * parceiro no caminho, um parceiro poderia sobrescrever a foto do outro.
 *
 * `upsert` para a troca substituir de verdade: sem ele, cada troca deixaria a
 * imagem anterior no bucket para sempre.
 */
async function trocarImagem(activityId: string, arquivo: File): Promise<string> {
  const parceiro = ok(
    await supabase()
      .from('activities')
      .select('partner_id')
      .eq('id', activityId)
      .single<{ partner_id: string }>(),
    'Não foi possível identificar a atividade.',
  );

  const caminho = `${parceiro.partner_id}/${activityId}`;
  const { error: erroUpload } = await supabase()
    .storage.from(BUCKET_ATIVIDADES)
    .upload(caminho, arquivo, { contentType: arquivo.type, upsert: true });
  if (erroUpload) throw new Error('Não foi possível enviar a imagem.');

  const { data } = supabase().storage.from(BUCKET_ATIVIDADES).getPublicUrl(caminho);

  // A hora entra na URL de propósito. A URL pública de um caminho é sempre a
  // mesma, e navegador e CDN guardam em cache: sem isso, trocar a foto não
  // mudaria nada na tela de ninguém até o cache expirar.
  const url = `${data.publicUrl}?v=${Date.now()}`;

  ok(
    await supabase()
      .from('activities')
      .update({ image_url: url })
      .eq('id', activityId)
      .select('id')
      .single<{ id: string }>(),
    'A imagem subiu, mas não foi possível salvá-la na atividade.',
  );

  return url;
}

// ----------------------------------------------------------------- repasse --

async function extrato(meses = 6): Promise<StatementRow[]> {
  type ExtratoSql = {
    month: string;
    slot_kind: SlotKind;
    check_ins: number;
    rate_cents: number;
    total_cents: number;
  };
  const linhas = await linhasDe<ExtratoSql>(
    'partner_statement',
    { p_months: meses },
    'Não foi possível carregar o extrato.',
  );

  return linhas.map((l) => ({
    month: l.month,
    kind: l.slot_kind,
    checkIns: Number(l.check_ins),
    rateCents: l.rate_cents,
    totalCents: Number(l.total_cents),
  }));
}

// -------------------------------------------------- cadastro de parceiro --

type PedidoSql = {
  id: string;
  status: Pedido['status'];
  reason: string | null;
  name: string;
  neighborhood: string;
  city: string;
  address: string;
  latitude: number;
  longitude: number;
  phone: string;
  categories: string[];
  min_age: number;
  max_age: number;
  photo_path: string | null;
  legal_name: string | null;
  cnpj: string | null;
  pix_key: string | null;
  created_at: string;
};

async function categorias(): Promise<Categoria[]> {
  const linhas = ok(
    await supabase()
      .from('activity_categories')
      .select('id, label, emoji')
      .order('sort_order')
      .returns<{ id: string; label: string; emoji: string }[]>(),
    'Não foi possível carregar as modalidades.',
  );
  return linhas.map((l) => ({ ...l, id: l.id as ActivityCategoryId }));
}

/**
 * O pedido desta conta.
 *
 * `maybeSingle` porque não ter pedido é o estado normal de quem acabou de
 * criar a conta — e um erro aqui mandaria essa pessoa para uma tela de falha
 * em vez do formulário.
 */
async function meuPedido(): Promise<Pedido | null> {
  const { data, error } = await supabase()
    .from('partner_applications')
    .select(
      'id, status, reason, name, neighborhood, city, address, latitude, longitude,' +
        ' phone, categories, min_age, max_age, photo_path, legal_name, cnpj, pix_key, created_at',
    )
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle<PedidoSql>();

  if (error) traduz(error, 'Não foi possível carregar seu cadastro.');
  if (!data) return null;

  return {
    id: data.id,
    status: data.status,
    reason: data.reason,
    name: data.name,
    neighborhood: data.neighborhood,
    city: data.city,
    address: data.address,
    latitude: data.latitude,
    longitude: data.longitude,
    phone: data.phone,
    categories: data.categories as ActivityCategoryId[],
    minAge: data.min_age,
    maxAge: data.max_age,
    photoPath: data.photo_path,
    legalName: data.legal_name,
    cnpj: data.cnpj,
    pixKey: data.pix_key,
    createdAt: data.created_at,
  };
}

function paraSql(entrada: NovoPedido) {
  return {
    name: entrada.name,
    neighborhood: entrada.neighborhood,
    city: entrada.city,
    address: entrada.address,
    latitude: entrada.latitude,
    longitude: entrada.longitude,
    phone: entrada.phone,
    categories: entrada.categories,
    min_age: entrada.minAge,
    max_age: entrada.maxAge,
    photo_path: entrada.photoPath,
    legal_name: entrada.legalName,
    cnpj: entrada.cnpj,
    pix_key: entrada.pixKey,
  };
}

async function enviarPedido(entrada: NovoPedido, corrigindo?: string): Promise<void> {
  const conta = await supabase().auth.getUser();
  const userId = conta.data.user?.id;
  if (!userId) throw new PainelError('Sua sessão expirou. Entre de novo.');

  // Corrigir devolve o pedido para a fila: `status` volta a 'pendente'. É o
  // que impede a recusa de virar beco sem saída.
  const { error } = corrigindo
    ? await supabase()
        .from('partner_applications')
        .update({ ...paraSql(entrada), status: 'pendente', reason: null })
        .eq('id', corrigindo)
    : await supabase()
        .from('partner_applications')
        .insert({ ...paraSql(entrada), user_id: userId });

  if (error) traduz(error, 'Não foi possível enviar seu cadastro.');
}

/**
 * A foto vai para `pedidos/<conta>/`, e não para a pasta do parceiro.
 *
 * Não é organização: na hora do envio o parceiro **ainda não existe**, então
 * não há `partner_id` para pôr no caminho — que é justamente o que a policy
 * das capas compara.
 */
async function subirFotoDoPedido(arquivo: File): Promise<string> {
  const conta = await supabase().auth.getUser();
  const userId = conta.data.user?.id;
  if (!userId) throw new PainelError('Sua sessão expirou. Entre de novo.');

  const caminho = `pedidos/${userId}/espaco`;
  const { error } = await supabase()
    .storage.from(BUCKET_ATIVIDADES)
    .upload(caminho, arquivo, { contentType: arquivo.type, upsert: true });
  if (error) throw new PainelError('Não foi possível enviar a foto.');
  return caminho;
}

// ------------------------------------------------------------ quem analisa --

async function souDoKidoo(): Promise<boolean> {
  const { data, error } = await supabase().rpc('is_kidoo_admin');
  if (error) return false;
  return data === true;
}

async function pedidosPendentes(): Promise<PedidoNaFila[]> {
  type FilaSql = {
    id: string;
    name: string;
    neighborhood: string;
    city: string;
    address: string;
    phone: string;
    email: string;
    categories: string[];
    min_age: number;
    max_age: number;
    cnpj: string | null;
    created_at: string;
  };
  const linhas = await linhasDe<FilaSql>(
    'pending_applications',
    {},
    'Não foi possível carregar os pedidos.',
  );
  return linhas.map((l) => ({
    id: l.id,
    name: l.name,
    neighborhood: l.neighborhood,
    city: l.city,
    address: l.address,
    phone: l.phone,
    email: l.email,
    categories: l.categories as ActivityCategoryId[],
    minAge: l.min_age,
    maxAge: l.max_age,
    cnpj: l.cnpj,
    createdAt: l.created_at,
  }));
}

async function aprovarPedido(id: string): Promise<void> {
  const { error } = await supabase().rpc('approve_application', { p_id: id });
  if (error) traduz(error, 'Não foi possível aprovar este pedido.');
}

async function recusarPedido(id: string, motivo: string): Promise<void> {
  // Só o `error` importa: `reject_application` não devolve nada, e passar isto
  // por um auxiliar que exige linha de volta faria todo sucesso virar erro.
  const { error } = await supabase().rpc('reject_application', {
    p_id: id,
    p_reason: motivo,
  });
  if (error) traduz(error, 'Não foi possível recusar este pedido.');
}

async function sessaoAtiva(): Promise<boolean> {
  const { data } = await supabase().auth.getSession();
  return data.session !== null;
}

export const supabaseApi: PainelApi = {
  entrar,
  criarConta,
  pedirNovaSenha,
  definirNovaSenha,
  sair,
  meusParceiros,
  agenda,
  listaDaTurma,
  confirmarPresenca,
  definirVagas,
  publicarTurma,
  publicarSerie,
  minhasAtividades,
  trocarImagem,
  extrato,
  sessaoAtiva,
  categorias,
  meuPedido,
  enviarPedido,
  subirFotoDoPedido,
  souDoKidoo,
  pedidosPendentes,
  aprovarPedido,
  recusarPedido,
};
