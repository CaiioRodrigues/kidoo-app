import { PainelError } from './types';
import type {
  ActivityRow,
  AgendaRow,
  Categoria,
  PainelApi,
  Partner,
  Pedido,
  ParceiroAdmin,
  PedidoNaFila,
  ResultadoDaSerie,
  RosterRow,
  StatementRow,
} from './types';
import type { SlotKind } from '@app/types/domain';

/**
 * Painel em memória.
 *
 * Existe pelo mesmo motivo que o backend simulado do app: dá para abrir o
 * painel, clicar em tudo e revisar as telas sem um Supabase no ar. E, como lá,
 * ele **repete as regras do banco** em vez de facilitar — a classificação da
 * vaga é derivada, o código de check-in é conferido, e reduzir vaga abaixo do
 * que já foi reservado é recusado. Um mock que aceita tudo esconde justamente
 * as telas de erro que alguém vai ver no balcão.
 */

const PARCEIRO: Partner = {
  id: 'p-arena',
  name: 'Academia Arena Kids',
  neighborhood: 'Buritis',
  city: 'Belo Horizonte',
  role: 'owner',
  // Preenchidos, porque é assim que chegam de verdade: os dois vêm do
  // formulário de cadastro, que sempre exigiu rua e telefone. A demonstração
  // com campos vazios daria a impressão errada de que há digitação esperando.
  address: 'Rua Professor Estêvão Pinto, 480 — Buritis',
  phone: '(31) 3291-4400',
};

/**
 * O que "Meu local" já gravou nesta sessão de demonstração.
 *
 * Mutável, e é o ponto: sem isto o formulário salvaria, diria que salvou e
 * mostraria o valor antigo de volta na próxima visita — que é exatamente o
 * defeito que a demonstração existe para não ter.
 */
let local: Partner = { ...PARCEIRO };

// Uma com imagem própria e duas sem: é como o painel fica de verdade no
// começo, e é o que deixa a diferença visível na demonstração.
const DE_QUEM = { partnerId: PARCEIRO.id, partnerName: PARCEIRO.name };

const ATIVIDADES: ActivityRow[] = [
  {
    id: 'a-futebol',
    title: 'Futebol Kids',
    category: 'futebol',
    ...DE_QUEM,
    imageUrl: 'https://images.unsplash.com/photo-1517649763962-0c623066013b?w=400&q=70',
  },
  { id: 'a-judo', title: 'Judô para Pequenos', category: 'judo', ...DE_QUEM, imageUrl: null },
  { id: 'a-ginastica', title: 'Ginástica Divertida', category: 'ginastica', ...DE_QUEM, imageUrl: null },
];

/** A mesma regra do banco (`slot_kind_for`): a turma já acontece sozinha? */
function tipoDaVaga(matriculados: number): SlotKind {
  return matriculados >= 4 ? 'ociosa' : 'cheia';
}

type Turma = {
  sessionId: string;
  activityId: string;
  startsAt: string;
  capacity: number;
  enrolled: number;
  slotsOpen: number;
  coinCost: number;
};

type Reserva = {
  bookingId: string;
  sessionId: string;
  firstName: string;
  age: number;
  status: RosterRow['status'];
  checkedInAt: string | null;
  partnerConfirmedAt: string | null;
  /** Código que a família mostra. `null` = ainda não chegou. */
  codigo: string | null;
  /** `null` enquanto não houve check-in. */
  locationVerified: boolean | null;
};

function hoje(hora: number, minuto = 0): string {
  const data = new Date();
  data.setHours(hora, minuto, 0, 0);
  return data.toISOString();
}

function emDias(dias: number, hora: number): string {
  const data = new Date();
  data.setDate(data.getDate() + dias);
  data.setHours(hora, 0, 0, 0);
  return data.toISOString();
}

const turmas: Turma[] = [
  { sessionId: 's1', activityId: 'a-futebol',   startsAt: hoje(9, 30),  capacity: 20, enrolled: 11, slotsOpen: 6, coinCost: 2 },
  { sessionId: 's2', activityId: 'a-judo',      startsAt: hoje(14, 0),  capacity: 12, enrolled: 8,  slotsOpen: 4, coinCost: 3 },
  { sessionId: 's3', activityId: 'a-ginastica', startsAt: hoje(17, 0),  capacity: 10, enrolled: 2,  slotsOpen: 5, coinCost: 3 },
  { sessionId: 's4', activityId: 'a-futebol',   startsAt: emDias(1, 9), capacity: 20, enrolled: 13, slotsOpen: 5, coinCost: 2 },
  { sessionId: 's5', activityId: 'a-judo',      startsAt: emDias(3, 14),capacity: 12, enrolled: 9,  slotsOpen: 3, coinCost: 3 },
];

const reservas: Reserva[] = [
  { bookingId: 'b1', sessionId: 's1', firstName: 'João',   age: 8, status: 'completed',  checkedInAt: hoje(9, 22), partnerConfirmedAt: hoje(9, 24), codigo: null, locationVerified: true },
  { bookingId: 'b2', sessionId: 's1', firstName: 'Alice',  age: 7, status: 'checked_in', checkedInAt: hoje(9, 25), partnerConfirmedAt: null, codigo: '481902', locationVerified: true },
  { bookingId: 'b3', sessionId: 's1', firstName: 'Miguel', age: 9, status: 'checked_in', checkedInAt: hoje(9, 26), partnerConfirmedAt: null, codigo: '730514', locationVerified: false },
  { bookingId: 'b4', sessionId: 's1', firstName: 'Cecília',age: 8, status: 'confirmed',  checkedInAt: null, partnerConfirmedAt: null, codigo: null, locationVerified: null },
  { bookingId: 'b5', sessionId: 's2', firstName: 'Théo',   age: 6, status: 'checked_in', checkedInAt: hoje(13, 51), partnerConfirmedAt: null, codigo: '206348', locationVerified: true },
  { bookingId: 'b6', sessionId: 's2', firstName: 'Laura',  age: 7, status: 'confirmed',  checkedInAt: null, partnerConfirmedAt: null, codigo: null, locationVerified: null },
  { bookingId: 'b7', sessionId: 's3', firstName: 'Bento',  age: 5, status: 'confirmed',  checkedInAt: null, partnerConfirmedAt: null, codigo: null, locationVerified: null },
  { bookingId: 'b8', sessionId: 's4', firstName: 'Helena', age: 9, status: 'confirmed',  checkedInAt: null, partnerConfirmedAt: null, codigo: null, locationVerified: null },
];

/** Meses anteriores já fechados, para o extrato não abrir vazio. */
const HISTORICO: StatementRow[] = [
  { month: mesAtras(1), kind: 'ociosa', checkIns: 96, rateCents: 800, totalCents: 76800 },
  { month: mesAtras(1), kind: 'cheia',  checkIns: 21, rateCents: 1800, totalCents: 37800 },
  { month: mesAtras(2), kind: 'ociosa', checkIns: 71, rateCents: 800, totalCents: 56800 },
  { month: mesAtras(2), kind: 'cheia',  checkIns: 18, rateCents: 1800, totalCents: 32400 },
];

function mesAtras(n: number): string {
  const data = new Date();
  data.setDate(1);
  data.setHours(0, 0, 0, 0);
  data.setMonth(data.getMonth() - n);
  return data.toISOString();
}

/** A mesma lista fechada do banco, na mesma ordem. */
const CATEGORIAS: Categoria[] = [
  { id: 'futebol', label: 'Futebol', emoji: '⚽' },
  { id: 'natacao', label: 'Natação', emoji: '🏊' },
  { id: 'judo', label: 'Judô', emoji: '🥋' },
  { id: 'ginastica', label: 'Ginástica', emoji: '🤸' },
  { id: 'danca', label: 'Dança', emoji: '💃' },
  { id: 'tenis', label: 'Tênis', emoji: '🎾' },
];

/** O pedido desta conta na demonstração. Começa sem nenhum. */
let pedido: Pedido | null = null;

let logado = false;
const espera = <T>(valor: T, ms = 220): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(valor), ms));

function reservasDe(sessionId: string): Reserva[] {
  return reservas.filter((r) => r.sessionId === sessionId && r.status !== 'cancelled');
}

export const demoApi: PainelApi = {
  async entrar(email, senha) {
    if (!email.includes('@') || senha.length < 4) {
      throw new PainelError('E-mail ou senha incorretos.');
    }
    logado = true;
    await espera(null, 400);
  },

  async criarConta(email, senha) {
    if (!email.includes('@')) throw new PainelError('E-mail inválido.');
    if (senha.length < 8) {
      throw new PainelError('A senha precisa de pelo menos 8 caracteres.');
    }
    await espera(null, 460);
    logado = true;
    // Na demonstração não há e-mail para confirmar, então entra direto — e o
    // pedido começa vazio, que é o estado de quem acabou de criar a conta.
    pedido = null;
    return { status: 'entrou' as const };
  },

  /**
   * Não manda e-mail e não falha nunca.
   *
   * O real falha só em erro de configuração do projeto Supabase — destino fora
   * das Redirect URLs, SMTP recusando — e não há projeto atrás da
   * demonstração. O que ele nunca faz é recusar por o e-mail não ter conta, e
   * é essa parte que importa reproduzir: uma demonstração que recusasse
   * e-mail desconhecido ensinaria a tela a tratar como erro algo que em
   * produção não chega.
   */
  async pedirNovaSenha() {
    await espera(null, 420);
  },

  async definirNovaSenha(senha) {
    if (senha.length < 8) {
      throw new PainelError('A senha precisa de pelo menos 8 caracteres.');
    }
    await espera(null, 380);
    logado = true;
  },

  async sair() {
    logado = false;
    await espera(null, 100);
  },

  async sessaoAtiva() {
    return espera(logado, 60);
  },

  async meusParceiros() {
    return espera([{ ...local }]);
  },

  async salvarLocal(_partnerId, dados) {
    const address = dados.address.trim();
    const phone = dados.phone.trim();
    // Em branco vira `null`, igual ao adapter de verdade: se a demonstração
    // guardasse string vazia, a tela pareceria funcionar aqui e divergiria lá.
    local = { ...local, address: address || null, phone: phone || null };
    return espera({ address: local.address, phone: local.phone });
  },

  async agenda(de, ate) {
    const linhas: AgendaRow[] = turmas
      .filter((t) => {
        const quando = Date.parse(t.startsAt);
        return quando >= de.getTime() && quando < ate.getTime();
      })
      .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))
      .map((t) => {
        const daTurma = reservasDe(t.sessionId);
        return {
          sessionId: t.sessionId,
          activityId: t.activityId,
          activityTitle: ATIVIDADES.find((a) => a.id === t.activityId)?.title ?? 'Turma',
          category: ATIVIDADES.find((a) => a.id === t.activityId)?.category ?? 'futebol',
          ...DE_QUEM,
          startsAt: t.startsAt,
          capacity: t.capacity,
          enrolled: t.enrolled,
          slotsOpen: t.slotsOpen,
          slotsTaken: daTurma.length,
          kind: tipoDaVaga(t.enrolled),
          coinCost: t.coinCost,
          checkedIn: daTurma.filter((r) => r.status !== 'confirmed').length,
          confirmed: daTurma.filter((r) => r.partnerConfirmedAt !== null).length,
        };
      });
    return espera(linhas);
  },

  async listaDaTurma(sessionId) {
    const linhas: RosterRow[] = reservasDe(sessionId).map((r) => ({
      bookingId: r.bookingId,
      firstName: r.firstName,
      age: r.age,
      status: r.status,
      checkedInAt: r.checkedInAt,
      partnerConfirmedAt: r.partnerConfirmedAt,
      slotKind: tipoDaVaga(turmas.find((t) => t.sessionId === sessionId)?.enrolled ?? 0),
      hasCode: r.codigo !== null,
      locationVerified: r.locationVerified,
    }));
    return espera(linhas);
  },

  async confirmarPresenca(bookingId, codigo) {
    const reserva = reservas.find((r) => r.bookingId === bookingId);
    if (!reserva) throw new PainelError('Reserva não encontrada.');
    if (!reserva.codigo) throw new PainelError('Esta família ainda não fez o check-in no aplicativo.');
    if (reserva.codigo !== codigo.replace(/\D/g, '')) {
      throw new PainelError('Código inválido para esta reserva.');
    }

    await espera(null, 320);
    reserva.partnerConfirmedAt = new Date().toISOString();
    reserva.status = 'completed';
    // O código morre ao ser usado: não vale para uma segunda aula.
    reserva.codigo = null;
  },

  async definirVagas(sessionId, vagas) {
    const turma = turmas.find((t) => t.sessionId === sessionId);
    if (!turma) throw new PainelError('Turma não encontrada.');
    if (vagas < 0) throw new PainelError('O número de vagas não pode ser negativo.');
    if (vagas < reservasDe(sessionId).length) {
      throw new PainelError('Já há reservas nestas vagas. Reduza só até o número que já foi reservado.');
    }
    if (turma.enrolled + vagas > turma.capacity) {
      throw new PainelError('A soma de matriculados e vagas abertas passa da capacidade da turma.');
    }
    await espera(null, 280);
    turma.slotsOpen = vagas;
  },

  async publicarTurma(entrada) {
    if (Date.parse(entrada.startsAt) <= Date.now()) {
      throw new PainelError('Não dá para publicar uma turma que já começou.');
    }
    if (entrada.enrolled + entrada.slotsOpen > entrada.capacity) {
      throw new PainelError('A soma de matriculados e vagas abertas passa da capacidade da turma.');
    }
    if (entrada.coinCost < 1 || entrada.coinCost > 6) {
      throw new PainelError('O custo em coins precisa ficar entre 1 e 6.');
    }
    await espera(null, 380);
    turmas.push({
      sessionId: `s${turmas.length + 1}`,
      activityId: entrada.activityId,
      startsAt: new Date(entrada.startsAt).toISOString(),
      capacity: entrada.capacity,
      enrolled: entrada.enrolled,
      slotsOpen: entrada.slotsOpen,
      coinCost: entrada.coinCost,
    });
  },

  /**
   * A série, com as mesmas recusas do banco.
   *
   * Repete o pulo da data já publicada de propósito: é justamente o caso que
   * a demonstração precisa mostrar — clicar duas vezes em "publicar" não pode
   * dobrar a agenda, e um mock que aceita tudo esconderia isso.
   */
  async publicarSerie(entrada): Promise<ResultadoDaSerie> {
    if (entrada.quando.length === 0) {
      throw new PainelError('Escolha pelo menos um dia da semana para a turma se repetir.');
    }
    if (entrada.quando.length > 60) {
      throw new PainelError('São turmas demais de uma vez. Reduza os dias ou as semanas.');
    }
    if (entrada.enrolled + entrada.slotsOpen > entrada.capacity) {
      throw new PainelError('A soma de matriculados e vagas abertas passa da capacidade da turma.');
    }
    if (entrada.coinCost < 1 || entrada.coinCost > 6) {
      throw new PainelError('O custo em coins precisa ficar entre 1 e 6.');
    }

    const resultado: ResultadoDaSerie = { publicadas: 0, jaExistiam: 0, noPassado: 0 };
    await espera(null, 460);

    for (const quando of entrada.quando) {
      if (quando.getTime() <= Date.now()) {
        resultado.noPassado += 1;
        continue;
      }
      const iso = quando.toISOString();
      if (turmas.some((t) => t.activityId === entrada.activityId && t.startsAt === iso)) {
        resultado.jaExistiam += 1;
        continue;
      }
      turmas.push({
        sessionId: `s${turmas.length + 1}`,
        activityId: entrada.activityId,
        startsAt: iso,
        capacity: entrada.capacity,
        enrolled: entrada.enrolled,
        slotsOpen: entrada.slotsOpen,
        coinCost: entrada.coinCost,
      });
      resultado.publicadas += 1;
    }

    return resultado;
  },

  async minhasAtividades() {
    return espera(ATIVIDADES);
  },

  /**
   * No modo demonstração não há bucket: o navegador mesmo gera uma URL local
   * para o arquivo escolhido, que já serve para a tela mostrar o resultado.
   * O que o demo espelha do real é o contrato, não o armazenamento.
   */
  async trocarImagem(activityId, arquivo) {
    const url = URL.createObjectURL(arquivo);
    const atividade = ATIVIDADES.find((a) => a.id === activityId);
    if (atividade) atividade.imageUrl = url;
    return espera(url);
  },

  // ------------------------------------------------ cadastro de parceiro --

  async categorias() {
    return espera(CATEGORIAS);
  },

  async meuPedido() {
    return espera(pedido);
  },

  /**
   * Repete as recusas do banco, inclusive a que mais importa: o pedido nasce
   * e continua PENDENTE. Um mock que devolvesse "aprovado" esconderia
   * justamente a tela de espera, que é a que o candidato mais vai ver.
   */
  async enviarPedido(entrada, corrigindo) {
    if (entrada.categories.length === 0) {
      throw new PainelError('Escolha pelo menos uma modalidade.');
    }
    if (entrada.maxAge < entrada.minAge) {
      throw new PainelError('A idade máxima não pode ser menor que a mínima.');
    }
    await espera(null, 520);
    pedido = {
      ...entrada,
      id: corrigindo ?? 'pedido-demo',
      status: 'pendente',
      reason: null,
      createdAt: new Date().toISOString(),
    };
  },

  async subirFotoDoPedido(arquivo) {
    return espera(URL.createObjectURL(arquivo));
  },

  // -------------------------------------------------------- quem analisa --

  // Na demonstração a conta é dona de um estabelecimento, não do Kidoo: quem
  // analisa pedidos é uma pessoa da operação, e fingir o contrário faria a
  // demonstração mostrar uma tela que quase nenhum parceiro vai ver.
  async souDoKidoo() {
    return espera(false, 60);
  },

  async pedidosPendentes() {
    return espera<PedidoNaFila[]>([]);
  },

  async parceirosAdmin() {
    // A conta da demonstração não analisa pedidos, e a tela nem aparece para
    // ela. Lista vazia em vez de erro: o `souDoKidoo` é quem decide quem vê.
    return espera<ParceiroAdmin[]>([]);
  },

  async ligarParceiro() {
    throw new PainelError('Sua conta não liga nem desliga estabelecimento.');
  },

  async aprovarPedido() {
    throw new PainelError('Sua conta não analisa pedidos de estabelecimento.');
  },

  async recusarPedido(_id, motivo) {
    if (motivo.trim() === '') {
      throw new PainelError('Diga o motivo da recusa — é ele que volta para quem pediu.');
    }
    throw new PainelError('Sua conta não analisa pedidos de estabelecimento.');
  },

  async extrato() {
    const confirmadasNoMes = reservas.filter((r) => r.partnerConfirmedAt !== null);
    const porTipo = (kind: SlotKind, rate: number): StatementRow | null => {
      const total = confirmadasNoMes.filter(
        (r) => tipoDaVaga(turmas.find((t) => t.sessionId === r.sessionId)?.enrolled ?? 0) === kind,
      ).length;
      return total === 0 ? null : { month: mesAtras(0), kind, checkIns: total, rateCents: rate, totalCents: total * rate };
    };

    const doMes = [porTipo('ociosa', 800), porTipo('cheia', 1800)].filter(
      (linha): linha is StatementRow => linha !== null,
    );
    return espera([...doMes, ...HISTORICO]);
  },
};
