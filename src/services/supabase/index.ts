import type { PostgrestError } from '@supabase/supabase-js';

import { supabase } from './client';
import {
  genderToDb,
  summarize,
  toActivity,
  toBooking,
  toCategory,
  toChild,
  toPlan,
  toReview,
  toSession,
  toWaitlistEntry,
  toSubscription,
  toWallet,
  type ActivityRow,
  type BonusGrantRow,
  type BookingRow,
  type CategoryRow,
  type ChildRow,
  type PlanRow,
  type ReviewRow,
  type SessionRow,
  type WaitlistRow,
  type SubscriptionRow,
} from './mappers';
import { ApiError, type ApiErrorCode } from '../errors';
import type { ActivityFilters, KidooApi } from '../types';
import { buildAchievements } from '@/lib/achievements';
import { linkDeConfirmacao, linkDeNovaSenha } from '@/lib/deep-link';
import { erroDeEnvio } from '@shared/erro-de-envio';
import { MAX_LEVEL, bonusForLevel, levelFromXp } from '@/lib/levels';
import { rankForChild } from '@/lib/recommendation';
import { ehArquivoLocal, lerArquivoLocal, tipoDaImagem } from '@/lib/upload';
import type { Coords } from '@/lib/geo';
import type {
  Activity,
  ActivityCategoryId,
  ActivityTally,
  BookingDetails,
  Child,
  Guardian,
  Session,
} from '@/types/domain';

/**
 * Adapter do Supabase.
 *
 * Implementa exatamente o mesmo `KidooApi` do mock — trocar um pelo outro é
 * mudar uma linha em `src/services/index.ts`, e nenhuma tela sabe da diferença.
 *
 * Duas regras organizam o arquivo:
 *
 * 1. **Toda escrita que envolve dinheiro ou vaga é RPC.** Reservar, cancelar,
 *    fazer check-in, confirmar presença e assinar plano passam por funções
 *    `security definer` que travam a linha e decidem o que muda. Fazer isso em
 *    duas queries daqui deixaria a janela para gastar o mesmo coin duas vezes.
 * 2. **Leitura é `select` mapeado.** O que o domínio deriva de várias tabelas
 *    (o "a partir de" da atividade, a turma vendável) já vem pronto das visões,
 *    para a lista de cartões não virar uma consulta por cartão.
 */

// ------------------------------------------------------------- erros --------

/**
 * Mensagens que as funções do banco levantam.
 *
 * A tradução é feita aqui e não no banco de propósito: a mesma condição pode
 * merecer palavras diferentes no app da família e no painel do parceiro, e um
 * `raise` em português travaria as duas na mesma frase.
 */
const RPC_MESSAGES: Record<string, { code: ApiErrorCode; message: string }> = {
  not_authenticated: { code: 'invalid_credentials', message: 'Entre na sua conta para continuar.' },
  child_not_found: { code: 'not_found', message: 'Criança não encontrada.' },
  session_not_found: { code: 'not_found', message: 'Turma não encontrada.' },
  session_already_started: { code: 'not_found', message: 'Esta turma já começou.' },
  session_full: { code: 'not_found', message: 'Esta turma não tem mais vaga aberta.' },
  already_booked: { code: 'already_booked', message: 'Você já reservou esta turma.' },
  session_has_room: {
    code: 'session_has_room',
    message: 'Esta turma ainda tem vaga — é só reservar.',
  },
  no_subscription: { code: 'not_found', message: 'Você ainda não tem um plano ativo.' },
  insufficient_coins: {
    code: 'insufficient_coins',
    message: 'Seus Kidoo Coins desta semana acabaram. A cota volta ao cheio na segunda.',
  },
  insufficient_bonus: {
    code: 'insufficient_coins',
    message: 'Seu Kidoo Bônus não cobre esta aula.',
  },
  booking_not_found: { code: 'not_found', message: 'Reserva não encontrada.' },
  booking_not_cancellable: {
    code: 'not_found',
    message: 'Esta reserva não pode mais ser cancelada.',
  },
  booking_cancelled: { code: 'not_found', message: 'Esta reserva foi cancelada.' },
  already_confirmed: {
    code: 'not_found',
    message: 'Esta presença já foi confirmada pelo parceiro.',
  },
  check_in_too_early: { code: 'not_found', message: 'O check-in abre 45 minutos antes da aula.' },
  check_in_too_late: { code: 'not_found', message: 'A janela de check-in desta aula já fechou.' },
  too_far_from_venue: {
    code: 'not_found',
    message: 'Você ainda não chegou no local da atividade.',
  },
  no_check_in: { code: 'not_found', message: 'Esta reserva ainda não teve check-in.' },
  wrong_code: { code: 'not_found', message: 'Código inválido para esta reserva.' },
  code_expired: { code: 'not_found', message: 'O código expirou. Peça um novo ao responsável.' },
  not_this_partner: { code: 'not_found', message: 'Esta reserva não é deste parceiro.' },
  plan_not_found: { code: 'not_found', message: 'Plano indisponível.' },
  already_reviewed: { code: 'not_found', message: 'Esta aula já foi avaliada.' },
  review_before_check_in: {
    code: 'not_found',
    message: 'Só é possível avaliar depois do check-in.',
  },
};

function fail(error: PostgrestError, fallback: string): never {
  const known = RPC_MESSAGES[error.message];
  if (known) throw new ApiError(known.code, known.message);

  // O índice `one_seat_per_child` é a garantia real contra duas requisições
  // simultâneas — `book_session` checa antes, mas entre a checagem e o insert
  // ainda cabe outra transação. Quando ele dispara, a causa é a mesma do
  // `already_booked` e a família merece a mesma frase, não um texto genérico.
  if (error.code === '23505' && error.message.includes('one_seat_per_child')) {
    throw new ApiError('already_booked', 'Você já reservou esta turma.');
  }

  // Falha de rede não é erro de regra: a tela oferece "tentar de novo" num
  // caso e explica o motivo no outro, então a distinção precisa chegar até lá.
  if (!error.code) throw new ApiError('network', 'Sem conexão com o servidor.');
  throw new ApiError('unknown', fallback);
}

/** Desembrulha uma resposta do PostgREST, traduzindo o erro se houver. */
function unwrap<T>(result: { data: T | null; error: PostgrestError | null }, fallback: string): T {
  if (result.error) fail(result.error, fallback);
  if (result.data === null) throw new ApiError('not_found', fallback);
  return result.data;
}

/**
 * Chama uma função do banco que **não devolve nada**.
 *
 * `unwrap` não serve para essas, e o estrago era silencioso: uma função
 * `returns void` chega do PostgREST como `data: null`, que `unwrap` trata como
 * "não encontrado" — então TODA chamada bem-sucedida virava erro. Entrar e
 * sair da fila de espera acusavam falha depois de terem funcionado, e o
 * registro do aparelho para push falhava sempre, engolido pelo `catch` que
 * existe para não travar o login: ninguém nunca recebeu aviso de vaga.
 *
 * A diferença entre as duas é o que o banco promete devolver, não o gosto de
 * quem escreve — e é por isso que o teste de contrato agora recusa uma função
 * `void` chamada por dentro do `unwrap`.
 */
function run(result: { error: PostgrestError | null }, fallback: string): void {
  if (result.error) fail(result.error, fallback);
}

// ------------------------------------------------------------ auxiliares ----

const BUCKET_CRIANCAS = 'criancas';
/** Uma hora é bem mais que o tempo de uma tela aberta, e curto para um link vazado. */
const VALIDADE_URL_S = 3600;

/**
 * Sobe a foto e devolve o CAMINHO no bucket — nunca a URL.
 *
 * O caminho é `criancas/<responsável>/<criança>.jpg`, e a primeira pasta é o
 * que a policy do Storage compara com `auth.uid()`. Guardar a URL assinada no
 * banco seria guardar algo que expira em uma hora.
 *
 * `upsert` porque trocar a foto tem de sobrescrever: sem ele, cada troca
 * deixaria o arquivo anterior no bucket para sempre — e são fotos de criança
 * acumulando sem dono.
 */
async function subirFotoDaCrianca(
  guardianId: string,
  childId: string,
  localUri: string,
): Promise<string> {
  const bytes = await lerArquivoLocal(localUri);
  if (bytes.byteLength === 0) {
    throw new ApiError('unknown', 'A foto veio vazia do aparelho. Tente escolher de novo.');
  }

  const caminho = `${guardianId}/${childId}`;
  const { error } = await supabase()
    .storage.from(BUCKET_CRIANCAS)
    .upload(caminho, bytes, { contentType: tipoDaImagem(localUri), upsert: true });

  // A mensagem do servidor vai junto, entre parênteses.
  //
  // Antes ela era descartada, e "Não foi possível enviar a foto" servia para
  // bucket inexistente, policy negando, MIME fora da lista e arquivo grande
  // demais — quatro causas com quatro consertos diferentes, indistinguíveis
  // de fora. É o mesmo defeito que escondeu o `Error sending confirmation
  // email` do cadastro de parceiro e custou uma tarde de DNS.
  if (error) {
    throw new ApiError('unknown', `Não foi possível enviar a foto. (${error.message})`);
  }
  return `${BUCKET_CRIANCAS}/${caminho}`;
}

/**
 * Caminho no bucket → URL que a tela consegue exibir.
 *
 * O bucket é privado porque é foto de criança, então cada exibição precisa de
 * uma URL assinada. Uma família tem duas, três crianças: o custo é irrelevante
 * perto de deixar um diretório de fotos de criança aberto na internet.
 *
 * Valores antigos em `file://` viram `null` de propósito. Eles são o caminho
 * do arquivo dentro de um aparelho específico e nunca vão carregar em lugar
 * nenhum — devolver o avatar com a inicial é melhor que uma imagem quebrada.
 */
async function urlDaFoto(valor: string | null): Promise<string | null> {
  if (!valor) return null;
  if (valor.startsWith('http')) return valor;
  if (!valor.startsWith(`${BUCKET_CRIANCAS}/`)) return null;

  const caminho = valor.slice(BUCKET_CRIANCAS.length + 1);
  const { data } = await supabase()
    .storage.from(BUCKET_CRIANCAS)
    .createSignedUrl(caminho, VALIDADE_URL_S);
  return data?.signedUrl ?? null;
}

/** Assina as fotos de uma lista de uma vez, em paralelo. */
async function comFotos(children: Child[]): Promise<Child[]> {
  return Promise.all(
    children.map(async (child) => ({ ...child, photoUri: await urlDaFoto(child.photoUri) })),
  );
}

async function currentUserId(): Promise<string> {
  const { data } = await supabase().auth.getSession();
  const id = data.session?.user.id;
  if (!id) throw new ApiError('invalid_credentials', 'Entre na sua conta para continuar.');
  return id;
}

async function guardianOf(userId: string): Promise<Guardian> {
  const row = unwrap(
    await supabase()
      .from('guardians')
      .select('id, name, email, city, created_at')
      .eq('id', userId)
      .single<{ id: string; name: string; email: string; city: string; created_at: string }>(),
    'Perfil não encontrado.',
  );

  return {
    id: row.id,
    name: row.name,
    email: row.email,
    city: row.city,
    createdAt: row.created_at,
  };
}

/**
 * Presença por criança, com a modalidade de cada aula.
 *
 * Uma consulta só para todas as crianças do responsável: a lista de perfis
 * mostra nível e conquistas, e uma consulta por criança seria N+1 numa tela
 * que abre a cada troca de aba.
 */
type Attendance = { total: number; byCategory: Map<ActivityCategoryId, number> };

async function attendanceByChild(): Promise<Map<string, Attendance>> {
  const rows = unwrap(
    await supabase()
      .from('bookings')
      .select('child_id, activity:activities(category_id)')
      .in('status', ['checked_in', 'completed'])
      .returns<{ child_id: string; activity: { category_id: string } | null }[]>(),
    'Não foi possível ler o histórico.',
  );

  const byChild = new Map<string, Attendance>();
  for (const row of rows) {
    const entry = byChild.get(row.child_id) ?? { total: 0, byCategory: new Map() };
    entry.total += 1;
    const category = row.activity?.category_id as ActivityCategoryId | undefined;
    if (category) entry.byCategory.set(category, (entry.byCategory.get(category) ?? 0) + 1);
    byChild.set(row.child_id, entry);
  }
  return byChild;
}

function achievementsOf(attendance: Attendance | undefined): number {
  if (!attendance) return 0;
  return buildAchievements(
    attendance.total,
    attendance.byCategory,
    new Date().toISOString(),
  ).filter((achievement) => achievement.unlockedAt !== null).length;
}

const ACTIVITY_COLUMNS = '*';

async function activitiesByIds(ids: string[], origin?: Coords): Promise<Map<string, Activity>> {
  if (ids.length === 0) return new Map();
  const rows = unwrap(
    await supabase()
      .from('activities_public')
      .select(ACTIVITY_COLUMNS)
      .in('id', ids)
      .returns<ActivityRow[]>(),
    'Atividade não encontrada.',
  );
  return new Map(rows.map((row) => [row.id, toActivity(row, origin)]));
}

async function childrenByIds(ids: string[]): Promise<Map<string, Child>> {
  if (ids.length === 0) return new Map();
  const rows = unwrap(
    await supabase().from('children').select('*').in('id', ids).returns<ChildRow[]>(),
    'Criança não encontrada.',
  );
  const attendance = await attendanceByChild();
  return new Map(rows.map((row) => [row.id, toChild(row, achievementsOf(attendance.get(row.id)))]));
}

/** Resolve as reservas com atividade, criança e avaliação já enviada. */
async function toDetails(rows: BookingRow[]): Promise<BookingDetails[]> {
  if (rows.length === 0) return [];

  const [activities, children, reviews] = await Promise.all([
    activitiesByIds([...new Set(rows.map((row) => row.activity_id))]),
    childrenByIds([...new Set(rows.map((row) => row.child_id))]),
    supabase()
      .from('reviews')
      .select('id, booking_id')
      .in(
        'booking_id',
        rows.map((row) => row.id),
      )
      .returns<{ id: string; booking_id: string }[]>(),
  ]);

  const reviewByBooking = new Map(
    (reviews.data ?? []).map((review) => [review.booking_id, review.id]),
  );

  const details: BookingDetails[] = [];
  for (const row of rows) {
    const activity = activities.get(row.activity_id);
    const child = children.get(row.child_id);
    // Uma reserva sem atividade ou sem criança não é exibível — e é sintoma de
    // dado inconsistente, não de tela vazia. Melhor sumir com a linha do que
    // renderizar um cartão sem nome.
    if (!activity || !child) continue;
    details.push({ ...toBooking(row, reviewByBooking.get(row.id) ?? null), activity, child });
  }
  return details;
}

/** Remove o que quebraria a sintaxe de filtro do PostgREST numa busca livre. */
function sanitizeSearch(term: string): string {
  return term
    .trim()
    .replace(/[,()*\\:"]/g, ' ')
    .trim();
}

function sessionFrom(
  accessToken: string,
  expiresAt: number | undefined,
  guardian: Guardian,
): Session {
  return {
    guardian,
    accessToken,
    expiresAt: new Date((expiresAt ?? 0) * 1000).toISOString(),
  };
}

async function listActivities(filters?: ActivityFilters): Promise<Activity[]> {
  let query = supabase().from('activities_public').select(ACTIVITY_COLUMNS);

  if (filters?.category && filters.category !== 'all') {
    query = query.eq('category_id', filters.category);
  }
  const term = filters?.query ? sanitizeSearch(filters.query) : '';
  if (term) {
    query = query.or(
      `title.ilike.%${term}%,partner_name.ilike.%${term}%,partner_neighborhood.ilike.%${term}%`,
    );
  }

  const rows = unwrap(
    await query.returns<ActivityRow[]>(),
    'Não foi possível carregar as atividades.',
  );

  const origin = filters?.origin;
  let list = rows.map((row) => toActivity(row, origin));

  // Raio e ordem por distância só existem com origem conhecida — e são
  // aplicados aqui porque a distância é calculada no aparelho, para a
  // localização da família não precisar sair dele só para filtrar.
  if (origin && filters?.radiusKm !== undefined) {
    const limit = filters.radiusKm;
    list = list.filter((item) => item.distanceKm !== null && item.distanceKm <= limit);
  }
  if (origin && filters?.sort === 'distance') {
    list = [...list].sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
  }

  return list;
}

// --------------------------------------------------------------- adapter ----

export const supabaseApi: KidooApi = {
  auth: {
    async signIn({ email, password }) {
      const { data, error } = await supabase().auth.signInWithPassword({ email, password });
      // A mensagem é a mesma para e-mail inexistente e senha errada: dizer qual
      // dos dois falhou entrega quais e-mails têm conta no Kidoo.
      if (error || !data.session) {
        throw new ApiError('invalid_credentials', 'E-mail ou senha incorretos.');
      }
      return sessionFrom(
        data.session.access_token,
        data.session.expires_at,
        await guardianOf(data.session.user.id),
      );
    },

    async signUp({ name, email, password }) {
      const { data, error } = await supabase().auth.signUp({
        email,
        password,
        options: {
          // O perfil nasce no trigger `on_auth_user_created`, a partir daqui.
          data: { name },
          // E o link do e-mail volta para o APP, não para o "Site URL" do
          // projeto — que é o painel dos parceiros. Sem isto a família
          // confirma o e-mail e cai numa tela de administrar estabelecimento.
          emailRedirectTo: linkDeConfirmacao(),
        },
      });

      if (error) {
        const inUse = error.message.toLowerCase().includes('already');
        throw new ApiError(
          inUse ? 'email_in_use' : 'unknown',
          inUse ? 'Este e-mail já tem conta no Kidoo.' : 'Não foi possível criar a conta.',
        );
      }
      // Sem sessão significa confirmação pendente, e isso não é erro: é o
      // caminho normal quando o projeto exige confirmar o e-mail. Quem decide
      // o que mostrar é a tela.
      if (!data.session) {
        return { status: 'needs_confirmation', email };
      }

      return {
        status: 'signed_in',
        session: sessionFrom(
          data.session.access_token,
          data.session.expires_at,
          await guardianOf(data.session.user.id),
        ),
      };
    },

    async resendConfirmation(email) {
      const { error } = await supabase().auth.resend({
        type: 'signup',
        email,
        options: { emailRedirectTo: linkDeConfirmacao() },
      });
      // Reenvio tem limite de frequência no Supabase. A mensagem diz o que
      // fazer — esperar — em vez de sugerir que algo quebrou.
      if (error) {
        throw new ApiError(
          'unknown',
          'Não foi possível reenviar agora. Aguarde um minuto e tente de novo.',
        );
      }
    },

    /**
     * Manda o link de redefinição.
     *
     * O que pode ser dito sobre a falha não é decidido aqui: `erroDeEnvio`
     * separa os erros que valem para todo endereço igualmente — destino fora
     * das Redirect URLs, SMTP recusando — dos que dependeriam do e-mail
     * digitado. Os primeiros passam; os outros, e todo desconhecido, ficam
     * calados.
     *
     * A primeira versão disto engolia tudo, para a tela não virar um
     * verificador de quais famílias são clientes. Só que aí ela engolia junto a
     * configuração quebrada: a tela dizia "confira seu e-mail", nada chegava, e
     * o motivo só existia em Authentication → Logs.
     */
    async requestPasswordReset(email) {
      const { error } = await supabase().auth.resetPasswordForEmail(email, {
        // Volta para o APP, não para o "Site URL" do projeto (o painel dos
        // parceiros) — mesma armadilha do link de confirmação.
        redirectTo: linkDeNovaSenha(),
      });
      if (!error) return;

      const dizivel = erroDeEnvio(error.message);
      if (dizivel) throw new ApiError('unknown', dizivel);
      // Calado de propósito: a tela segue para "confira seu e-mail", que é a
      // mesma resposta que um endereço sem conta recebe.
    },

    async updatePassword(password) {
      const { error } = await supabase().auth.updateUser({ password });
      if (error) {
        // A mensagem do servidor vai junto: aqui ela é útil e não vaza nada
        // sobre quem tem conta — fala da senha escolhida (curta demais,
        // vazada em base pública, igual à anterior), de quem já está dentro.
        throw new ApiError('unknown', `Não foi possível salvar a senha. (${error.message})`);
      }
    },

    /**
     * Entra com a sessão que veio no link.
     *
     * `setSession` guarda os dois tokens no armazenamento seguro do aparelho e
     * passa a renovar sozinho — é o mesmo estado de quem entrou pela senha.
     */
    async confirmByLink({ accessToken, refreshToken }) {
      const { data, error } = await supabase().auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      if (error || !data.session) {
        throw new ApiError(
          'invalid_credentials',
          'Este link não vale mais. Peça um novo e tente de novo.',
        );
      }
      return sessionFrom(
        data.session.access_token,
        data.session.expires_at,
        await guardianOf(data.session.user.id),
      );
    },

    async signOut() {
      await supabase().auth.signOut();
    },

    /**
     * Quem guarda a sessão do Supabase é o próprio supabase-js (Keychain no
     * aparelho, nada no navegador). O token que o app persiste pode estar
     * velho — o cliente renova sozinho —, então ele serve só como sinal de que
     * houve login; a sessão válida é a que o cliente devolve.
     */
    async restore(token) {
      if (!token) return null;
      const { data } = await supabase().auth.getSession();
      const live = data.session;
      if (!live) return null;
      return sessionFrom(live.access_token, live.expires_at, await guardianOf(live.user.id));
    },
  },

  children: {
    async list() {
      const rows = unwrap(
        await supabase().from('children').select('*').order('created_at').returns<ChildRow[]>(),
        'Não foi possível carregar as crianças.',
      );

      const attendance = await attendanceByChild();
      return comFotos(rows.map((row) => toChild(row, achievementsOf(attendance.get(row.id)))));
    },

    async create(input) {
      const guardianId = await currentUserId();
      // A criança entra sem foto e a foto sobe depois, porque o caminho no
      // bucket precisa do id dela. Nomear o arquivo por qualquer outra coisa
      // — timestamp, aleatório — deixaria órfãos impossíveis de associar no
      // dia em que alguém pedir para apagar os dados do filho.
      const row = unwrap(
        await supabase()
          .from('children')
          .insert({
            guardian_id: guardianId,
            name: input.name,
            birth_date: input.birthDate,
            gender: genderToDb(input.gender),
            photo_url: null,
            interests: input.interests,
          })
          .select('*')
          .single<ChildRow>(),
        'Não foi possível salvar o perfil.',
      );

      if (!ehArquivoLocal(input.photoUri)) return toChild(row, 0);

      // A foto falhar não pode desfazer o cadastro: a criança já existe, e
      // perder o perfil inteiro por causa de uma imagem seria desproporcional.
      // Quem quiser tenta de novo pelo Perfil.
      try {
        const caminho = await subirFotoDaCrianca(guardianId, row.id, input.photoUri);
        const atualizada = unwrap(
          await supabase()
            .from('children')
            .update({ photo_url: caminho })
            .eq('id', row.id)
            .select('*')
            .single<ChildRow>(),
          'Não foi possível salvar a foto.',
        );
        const child = toChild(atualizada, 0);
        return { ...child, photoUri: await urlDaFoto(child.photoUri) };
      } catch {
        return toChild(row, 0);
      }
    },

    async updatePhoto({ childId, photoUri }) {
      const guardianId = await currentUserId();

      let caminho: string | null = null;
      if (ehArquivoLocal(photoUri)) {
        caminho = await subirFotoDaCrianca(guardianId, childId, photoUri);
      } else if (photoUri === null) {
        // Remover apaga o arquivo, não só a referência. Deixar a foto no
        // bucket depois de a família pedir para tirar seria manter o que ela
        // acabou de dizer que não quer mais.
        await supabase()
          .storage.from(BUCKET_CRIANCAS)
          .remove([`${guardianId}/${childId}`]);
      }

      const row = unwrap(
        await supabase()
          .from('children')
          .update({ photo_url: caminho })
          .eq('id', childId)
          .select('*')
          .single<ChildRow>(),
        'Não foi possível atualizar a foto.',
      );

      const attendance = await attendanceByChild();
      const child = toChild(row, achievementsOf(attendance.get(row.id)));
      return { ...child, photoUri: await urlDaFoto(child.photoUri) };
    },
  },

  catalog: {
    async categories() {
      const rows = unwrap(
        await supabase()
          .from('activity_categories')
          .select('id, label, emoji')
          .order('sort_order')
          .returns<CategoryRow[]>(),
        'Não foi possível carregar as modalidades.',
      );
      return rows.map(toCategory);
    },

    activities: listActivities,

    async activity(id, origin) {
      const row = unwrap(
        await supabase()
          .from('activities_public')
          .select(ACTIVITY_COLUMNS)
          .eq('id', id)
          .single<ActivityRow>(),
        'Atividade não encontrada.',
      );
      return toActivity(row, origin);
    },

    async partner(id, origin) {
      /*
        Duas consultas, e a do parceiro vem da tabela, não da primeira
        atividade: `activities_public` filtra por `a.active`, então um
        estabelecimento cujas atividades foram todas despublicadas
        desapareceria — e é exatamente ele que a reserva de semana passada
        precisa mostrar, com endereço e telefone, para a família que já foi lá.
      */
      const linha = unwrap(
        await supabase()
          .from('partners')
          .select('id, name, neighborhood, city, verified, latitude, longitude, address, phone')
          .eq('id', id)
          .single<{
            id: string;
            name: string;
            neighborhood: string;
            city: string;
            verified: boolean;
            latitude: number;
            longitude: number;
            address: string | null;
            phone: string | null;
          }>(),
        'Estabelecimento não encontrado.',
      );

      const rows = unwrap(
        await supabase()
          .from('activities_public')
          .select(ACTIVITY_COLUMNS)
          .eq('partner_id', id)
          .returns<ActivityRow[]>(),
        'Não foi possível carregar as atividades do estabelecimento.',
      );

      return { partner: linha, activities: rows.map((row) => toActivity(row, origin)) };
    },

    async sessions(activityId) {
      const rows = unwrap(
        await supabase()
          // `_visible`, e não `_open`: a turma cheia precisa aparecer para a
          // família poder pedir aviso. A view `_open` continua existindo e
          // continua significando "dá para reservar" — é dela que o cartão do
          // catálogo tira o "a partir de".
          .from('class_sessions_visible')
          .select('*')
          .eq('activity_id', activityId)
          .order('starts_at')
          .returns<SessionRow[]>(),
        'Não foi possível carregar as turmas.',
      );
      return rows.map(toSession);
    },

    async reviews(activityId) {
      const rows = unwrap(
        await supabase()
          .from('reviews')
          .select('id, activity_id, author_name, rating, comment, created_at, helpful_count')
          .eq('activity_id', activityId)
          .order('created_at', { ascending: false })
          .returns<ReviewRow[]>(),
        'Não foi possível carregar as avaliações.',
      );

      const reviews = rows.map(toReview);
      return { summary: summarize(reviews), reviews };
    },

    async submitReview({ bookingId, rating, comment }) {
      const row = unwrap(
        await supabase()
          .rpc('submit_review', {
            p_booking_id: bookingId,
            p_rating: rating,
            // O nome do autor NÃO vai daqui: quem o define é o servidor, a
            // partir do perfil. Do contrário daria para assinar como outra pessoa.
            p_comment: comment,
          })
          .single<ReviewRow>(),
        'Não foi possível enviar a avaliação.',
      );
      return toReview(row);
    },

    async recommended(childId, origin) {
      const [activities, child] = await Promise.all([
        listActivities({ origin }),
        supabase().from('children').select('*').eq('id', childId).single<ChildRow>(),
      ]);

      if (child.error || !child.data) return activities.slice(0, 3);

      const ranked = rankForChild(activities, toChild(child.data, 0));
      return ranked.length > 0 ? ranked : activities.slice(0, 3);
    },
  },

  plans: {
    async list() {
      const rows = unwrap(
        await supabase().from('plans').select('*').order('sort_order').returns<PlanRow[]>(),
        'Não foi possível carregar os planos.',
      );
      return rows.map(toPlan);
    },

    async subscribe(planId) {
      // A cota vem da tabela de planos, no servidor: se `coinsPerWeek` viajasse
      // daqui, qualquer um assinaria o Start pedindo 999 coins por semana.
      const row = unwrap(
        await supabase().rpc('subscribe_plan', { p_plan_id: planId }).single<SubscriptionRow>(),
        'Não foi possível assinar o plano.',
      );
      return toSubscription(row);
    },

    async current() {
      // A virada de semana é aplicada pelo banco antes de responder. O cliente
      // não decide quando a cota volta ao cheio.
      const { data, error } = await supabase()
        .rpc('current_subscription')
        .maybeSingle<SubscriptionRow>();

      if (error) fail(error, 'Não foi possível ler sua assinatura.');
      return data ? toSubscription(data) : null;
    },
  },

  bookings: {
    async list() {
      const rows = unwrap(
        await supabase()
          .from('bookings')
          .select('*')
          .order('scheduled_at', { ascending: false })
          .returns<BookingRow[]>(),
        'Não foi possível carregar suas reservas.',
      );
      return toDetails(rows);
    },

    async get(id) {
      const row = unwrap(
        await supabase().from('bookings').select('*').eq('id', id).single<BookingRow>(),
        'Reserva não encontrada.',
      );
      const [details] = await toDetails([row]);
      if (!details) throw new ApiError('not_found', 'Reserva não encontrada.');
      return details;
    },

    async create({ sessionId, childId }) {
      // Vaga e coins são decididos dentro da mesma transação, com a linha da
      // turma travada. Duas famílias tocando em "confirmar" no mesmo segundo
      // não podem ler o mesmo `slots_taken`.
      const row = unwrap(
        await supabase()
          .rpc('book_session', { p_session_id: sessionId, p_child_id: childId })
          .single<BookingRow>(),
        'Não foi possível concluir a reserva.',
      );
      return toBooking(row);
    },

    async checkIn(bookingId, proof) {
      // Vai a leitura crua, não uma distância pronta: quem mede é o servidor,
      // que tem a coordenada do parceiro. "Estou a 10 m" seria só um número que
      // qualquer um edita. A coordenada entra no cálculo e não é gravada.
      const result = unwrap(
        await supabase().rpc('check_in', {
          p_booking_id: bookingId,
          p_latitude: proof?.origin.latitude ?? null,
          p_longitude: proof?.origin.longitude ?? null,
          p_accuracy_m: proof?.accuracyM ?? null,
          p_mocked: proof?.mocked ?? false,
        }),
        'Não foi possível registrar o check-in.',
      ) as { booking: BookingRow; xpOnConfirm: number };

      const [details] = await toDetails([result.booking]);
      if (!details?.checkIn) {
        throw new ApiError('unknown', 'O check-in não gerou um código. Tente de novo.');
      }

      // Nada foi creditado ainda: o XP entra quando o parceiro confirmar, e a
      // reserva passa a carregar o resultado em `reward`.
      return {
        booking: details,
        xpOnConfirm: result.xpOnConfirm,
        ticket: details.checkIn,
      };
    },

    async confirmByPartner({ bookingId, code }) {
      const row = unwrap(
        await supabase()
          .rpc('confirm_by_partner', { p_booking_id: bookingId, p_code: code.replace(/\s/g, '') })
          .single<BookingRow>(),
        'Não foi possível confirmar a presença.',
      );
      const [details] = await toDetails([row]);
      if (!details) throw new ApiError('not_found', 'Reserva não encontrada.');
      return details;
    },

    async cancel(bookingId) {
      const row = unwrap(
        await supabase().rpc('cancel_booking', { p_booking_id: bookingId }).single<BookingRow>(),
        'Não foi possível cancelar a reserva.',
      );
      const [details] = await toDetails([row]);
      if (!details) throw new ApiError('not_found', 'Reserva não encontrada.');
      return details;
    },
  },

  waitlist: {
    async list() {
      // `returns<T[]>` num rpc que devolve conjunto confunde a inferência do
      // supabase-js, que suspeita de `.single()` na cadeia. O cast fica aqui,
      // num lugar só, em vez de espalhar `any` pelo mapeamento.
      const { data, error } = await supabase().rpc('my_waitlist');
      if (error) fail(error, 'Não foi possível carregar suas esperas.');
      return ((data ?? []) as WaitlistRow[]).map(toWaitlistEntry);
    },

    async join({ sessionId, childId }) {
      run(
        await supabase().rpc('join_waitlist', { p_session_id: sessionId, p_child_id: childId }),
        'Não foi possível entrar na fila desta turma.',
      );
    },

    async leave({ sessionId, childId }) {
      run(
        await supabase().rpc('leave_waitlist', { p_session_id: sessionId, p_child_id: childId }),
        'Não foi possível sair da fila desta turma.',
      );
    },
  },

  push: {
    async register({ token, platform }) {
      run(
        await supabase().rpc('register_push_token', { p_token: token, p_platform: platform }),
        'Não foi possível registrar o aparelho para avisos.',
      );
    },

    async forget(token) {
      run(
        await supabase().rpc('forget_push_token', { p_token: token }),
        'Não foi possível desativar os avisos neste aparelho.',
      );
    },
  },

  journey: {
    async get(childId) {
      const [childResult, grantsResult, historyResult] = await Promise.all([
        supabase().from('children').select('*').eq('id', childId).single<ChildRow>(),
        supabase()
          .from('bonus_grants')
          .select('*')
          .eq('child_id', childId)
          .order('expires_at')
          .returns<BonusGrantRow[]>(),
        supabase()
          .from('bookings')
          .select('checked_in_at, scheduled_at, activity:activities(category_id)')
          .eq('child_id', childId)
          .in('status', ['checked_in', 'completed'])
          .returns<
            {
              checked_in_at: string | null;
              scheduled_at: string;
              activity: { category_id: string } | null;
            }[]
          >(),
      ]);

      const child = unwrap(childResult, 'Criança não encontrada.');
      const grants = grantsResult.data ?? [];
      const history = historyResult.data ?? [];

      const byCategory = new Map<ActivityCategoryId, number>();
      for (const item of history) {
        const category = item.activity?.category_id as ActivityCategoryId | undefined;
        if (category) byCategory.set(category, (byCategory.get(category) ?? 0) + 1);
      }

      const categories = unwrap(
        await supabase()
          .from('activity_categories')
          .select('id, label, emoji')
          .returns<CategoryRow[]>(),
        'Não foi possível carregar as modalidades.',
      );
      const meta = new Map(categories.map((row) => [row.id, row]));

      const activityTally: ActivityTally[] = [...byCategory.entries()]
        .map(([category, count]) => ({
          category,
          label: meta.get(category)?.label ?? category,
          emoji: meta.get(category)?.emoji ?? '⭐',
          count,
        }))
        .sort((a, b) => b.count - a.count);

      const { level, levelName, xpIntoLevel, xpForLevel, isMaxLevel } = levelFromXp(child.xp);

      return {
        childId,
        xp: child.xp,
        level,
        levelName,
        xpIntoLevel,
        xpForLevel,
        maxLevel: MAX_LEVEL,
        isMaxLevel,
        nextLevelBonus: isMaxLevel ? 0 : bonusForLevel(level + 1),
        achievements: buildAchievements(history.length, byCategory, new Date().toISOString()),
        activityTally,
        weeklyActivity: weeklyFrom(history),
        totalActivities: history.length,
        totalCategories: byCategory.size,
        bonus: toWallet(childId, grants),
      };
    },
  },
};

/** Aulas por semana nas últimas 5 semanas, da mais antiga para a mais recente. */
function weeklyFrom(
  history: { checked_in_at: string | null; scheduled_at: string }[],
): { label: string; count: number }[] {
  const WEEKS = 5;
  const MS_PER_WEEK = 1000 * 60 * 60 * 24 * 7;
  const now = Date.now();

  const buckets = Array.from({ length: WEEKS }, (_, index) => ({
    label: index === WEEKS - 1 ? 'Esta' : `S${index + 1}`,
    count: 0,
  }));

  for (const item of history) {
    const weeksAgo = Math.floor(
      (now - Date.parse(item.checked_in_at ?? item.scheduled_at)) / MS_PER_WEEK,
    );
    if (weeksAgo < 0 || weeksAgo >= WEEKS) continue;
    const bucket = buckets[WEEKS - 1 - weeksAgo];
    if (bucket) bucket.count += 1;
  }

  return buckets;
}
