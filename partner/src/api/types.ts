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
};

export type AgendaRow = {
  sessionId: string;
  activityId: string;
  activityTitle: string;
  category: ActivityCategoryId;
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
  /** `null` quando o parceiro ainda não subiu a dele — o app cai na foto da modalidade. */
  imageUrl: string | null;
};

export type PainelApi = {
  entrar(email: string, senha: string): Promise<void>;
  sair(): Promise<void>;
  /** `null` = conta válida que não administra nenhum parceiro. */
  meuParceiro(): Promise<Partner | null>;
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
  minhasAtividades(partnerId: string): Promise<ActivityRow[]>;
  /**
   * Troca a foto de capa da atividade e devolve a URL nova.
   *
   * É a imagem que a família vê no catálogo antes de decidir. Até aqui era uma
   * foto de banco de imagens escolhida por modalidade, igual para toda
   * escolinha de futebol do país — e não havia tela nenhuma para trocar.
   */
  trocarImagem(activityId: string, arquivo: File): Promise<string>;
  extrato(meses?: number): Promise<StatementRow[]>;
  /** Há uma sessão ativa agora? */
  sessaoAtiva(): Promise<boolean>;
};
