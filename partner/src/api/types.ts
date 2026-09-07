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
};

export type StatementRow = {
  month: string;
  kind: SlotKind;
  checkIns: number;
  rateCents: number;
  totalCents: number;
};

export type ActivityRow = { id: string; title: string; category: ActivityCategoryId };

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
  minhasAtividades(partnerId: string): Promise<ActivityRow[]>;
  extrato(meses?: number): Promise<StatementRow[]>;
  /** Há uma sessão ativa agora? */
  sessaoAtiva(): Promise<boolean>;
};
