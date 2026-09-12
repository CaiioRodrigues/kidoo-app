import type { ActivityCategoryId, SlotKind } from '@app/types/domain';

/**
 * O contrato do painel.
 *
 * Existe pelo mesmo motivo que `KidooApi` existe no app: as telas dependem
 * destas formas, não de como os dados chegam. É o que permite o painel rodar em
 * demonstração sem backend nenhum e trocar para o Supabase sem tocar em tela.
 */

/** Erro com mensagem já pronta para quem está no balcão. */
export class PainelError extends Error {}

export type Partner = {
  id: string;
  name: string;
  neighborhood: string;
  city: string;
  role: string;
  /**
   * Endereço da rua e telefone, como a família os vê no app.
   *
   * Nulos até alguém preencher, e a maioria está nula: as duas colunas
   * nasceram depois dos parceiros. Quem preenche é o próprio estabelecimento,
   * na aba "Meu local" — ninguém do Kidoo sabe o número da porta melhor que
   * ele, e pedir isso por e-mail é uma planilha que envelhece.
   */
  address: string | null;
  phone: string | null;
};

export type AgendaRow = {
  sessionId: string;
  activityId: string;
  activityTitle: string;
  category: ActivityCategoryId;
  /**
   * De qual estabelecimento é esta turma.
   *
   * Uma conta pode administrar mais de um lugar, e sempre pôde. Enquanto
   * cuidava de um só, a diferença não aparecia — e quando apareceu, a tela
   * mostrava turmas de lugares diferentes como se fossem do mesmo.
   */
  partnerId: string;
  partnerName: string;
  startsAt: string;
  capacity: number;
  enrolled: number;
  slotsOpen: number;
  slotsTaken: number;
  kind: SlotKind;
  coinCost: number;
  checkedIn: number;
  confirmed: number;
};

export type RosterRow = {
  bookingId: string;
  firstName: string;
  age: number;
  status: 'confirmed' | 'checked_in' | 'completed' | 'cancelled';
  checkedInAt: string | null;
  partnerConfirmedAt: string | null;
  slotKind: SlotKind;
  hasCode: boolean;
  /**
   * Se o app conferiu a localização no check-in.
   *
   * `null` enquanto não houve check-in — e o nulo importa: quem ainda não
   * chegou não pode aparecer como suspeito. `false` quer dizer que o app não
   * teve leitura de GPS, o que é comum e não é acusação: quadra coberta sem
   * sinal, ou permissão negada. Quem decide a presença continua sendo você,
   * olhando a criança.
   */
  locationVerified: boolean | null;
};

export type StatementRow = {
  month: string;
  kind: SlotKind;
  checkIns: number;
  rateCents: number;
  totalCents: number;
};

/**
 * O que aconteceu com cada data de uma série.
 *
 * Vem em contagem, e não só num "deu certo", porque publicar oito semanas tem
 * três desfechos diferentes ao mesmo tempo: entrou, já existia, já passou.
 * Dizer só "publicado" esconderia justamente o caso em que o parceiro pediu
 * oito e recebeu duas.
 */
export type ResultadoDaSerie = {
  publicadas: number;
  jaExistiam: number;
  noPassado: number;
};

export type ActivityRow = {
  id: string;
  title: string;
  category: ActivityCategoryId;
  partnerId: string;
  partnerName: string;
  /** `null` quando o parceiro ainda não subiu a dele — o app cai na foto da modalidade. */
  imageUrl: string | null;
};

/** As modalidades que o Kidoo conhece — lista fechada, vinda do banco. */
export type Categoria = { id: ActivityCategoryId; label: string; emoji: string };

/** O que o candidato preenche. Sem repasse: quem define isso é o Kidoo. */
export type NovoPedido = {
  name: string;
  neighborhood: string;
  city: string;
  address: string;
  latitude: number;
  longitude: number;
  phone: string;
  categories: ActivityCategoryId[];
  minAge: number;
  maxAge: number;
  photoPath: string | null;
  legalName: string | null;
  cnpj: string | null;
  pixKey: string | null;
};

/** O pedido como quem o enviou o vê. */
export type Pedido = NovoPedido & {
  id: string;
  status: 'pendente' | 'aprovado' | 'recusado';
  /** Por que foi recusado. Sem isto a recusa é um beco: ele reenvia igual. */
  reason: string | null;
  createdAt: string;
};

/** O pedido como quem analisa o vê — com o e-mail da conta junto. */
export type PedidoNaFila = {
  id: string;
  name: string;
  neighborhood: string;
  city: string;
  address: string;
  phone: string;
  email: string;
  categories: ActivityCategoryId[];
  minAge: number;
  maxAge: number;
  cnpj: string | null;
  createdAt: string;
};

/**
 * O que aconteceu ao criar a conta.
 *
 * `confirmar` não é erro: é o caminho normal quando o projeto exige confirmar
 * o e-mail. Tratar isso como falha mandaria o estabelecimento embora achando
 * que o cadastro não funcionou.
 */
export type ResultadoDaConta = { status: 'entrou' } | { status: 'confirmar'; email: string };

export type PainelApi = {
  entrar(email: string, senha: string): Promise<void>;
  /** Cria a conta de quem vai administrar o estabelecimento. */
  criarConta(email: string, senha: string): Promise<ResultadoDaConta>;
  /**
   * Manda o link de redefinição de senha.
   *
   * Não devolve nada, e não devolve de propósito: dizer se o e-mail tem conta
   * transformaria esta tela num verificador de quais estabelecimentos são
   * parceiros do Kidoo. É a mesma regra que `entrar` segue ao não separar
   * "e-mail não existe" de "senha errada".
   */
  pedirNovaSenha(email: string): Promise<void>;
  /**
   * Grava a senha nova.
   *
   * Exige a sessão que o link de redefinição abriu — o clique no link é a
   * prova de acesso à caixa de entrada.
   */
  definirNovaSenha(senha: string): Promise<void>;
  sair(): Promise<void>;
  /**
   * Todos os estabelecimentos que esta conta administra.
   *
   * Lista, e não um só: `partner_agenda` sempre devolveu as turmas de todos
   * eles, então pegar "o primeiro" e chamar de "o parceiro" era uma meia
   * verdade que a tela repetia. Vazia = conta válida sem vínculo nenhum.
   */
  meusParceiros(): Promise<Partner[]>;
  agenda(de: Date, ate: Date): Promise<AgendaRow[]>;
  listaDaTurma(sessionId: string): Promise<RosterRow[]>;
  confirmarPresenca(bookingId: string, codigo: string): Promise<void>;
  definirVagas(sessionId: string, vagas: number): Promise<void>;
  publicarTurma(entrada: {
    activityId: string;
    startsAt: string;
    capacity: number;
    enrolled: number;
    slotsOpen: number;
    coinCost: number;
  }): Promise<void>;
  /**
   * Publica a mesma turma em várias datas, numa transação só.
   *
   * As datas chegam prontas: quem sabe que "toda terça às 18h" é 18h no
   * relógio de Belo Horizonte é o navegador do parceiro, não o servidor.
   */
  publicarSerie(entrada: {
    activityId: string;
    quando: Date[];
    capacity: number;
    enrolled: number;
    slotsOpen: number;
    coinCost: number;
  }): Promise<ResultadoDaSerie>;
  /** As atividades destes estabelecimentos, com o nome de cada um. */
  minhasAtividades(partnerIds: string[]): Promise<ActivityRow[]>;
  /**
   * Troca a foto de capa da atividade e devolve a URL nova.
   *
   * É a imagem que a família vê no catálogo antes de decidir. Até aqui era uma
   * foto de banco de imagens escolhida por modalidade, igual para toda
   * escolinha de futebol do país — e não havia tela nenhuma para trocar.
   */
  trocarImagem(activityId: string, arquivo: File): Promise<string>;
  extrato(meses?: number): Promise<StatementRow[]>;
  /**
   * Grava o endereço e o telefone que a família vê no app.
   *
   * Só estes dois: `verified` é o selo, e a coordenada é a prova de distância
   * do check-in — quem move a própria coordenada move o portão junto. O banco
   * concorda, e não por educação: o `grant` de update em `partners` lista as
   * colunas uma a uma desde a migration 000016.
   *
   * Texto em branco vira `null`, e não string vazia: as duas significam "não
   * tem", e guardar as duas faria a tela do app ter de tratar os dois casos
   * para sempre.
   */
  salvarLocal(
    partnerId: string,
    dados: { address: string; phone: string },
  ): Promise<{ address: string | null; phone: string | null }>;
  /** Há uma sessão ativa agora? */
  sessaoAtiva(): Promise<boolean>;

  // ------------------------------------------------ cadastro de parceiro --

  /** As modalidades disponíveis, para o formulário do pedido. */
  categorias(): Promise<Categoria[]>;
  /** O pedido desta conta, se existir. */
  meuPedido(): Promise<Pedido | null>;
  /** Envia um pedido novo, ou corrige e reenvia um recusado. */
  enviarPedido(entrada: NovoPedido, corrigindo?: string): Promise<void>;
  /** Sobe a foto do espaço e devolve o caminho guardado no pedido. */
  subirFotoDoPedido(arquivo: File): Promise<string>;

  // -------------------------------------------------------- quem analisa --

  /** Esta conta pode aprovar estabelecimentos? */
  souDoKidoo(): Promise<boolean>;
  pedidosPendentes(): Promise<PedidoNaFila[]>;
  aprovarPedido(id: string): Promise<void>;
  /** O motivo é obrigatório: o banco recusa uma recusa sem ele. */
  recusarPedido(id: string, motivo: string): Promise<void>;
};
