import type {
  Activity,
  ActivityCategory,
  ActivityCategoryId,
  ClassSession,
  Booking,
  BookingDetails,
  CheckInResult,
  Child,
  Guardian,
  Journey,
  Partner,
  Plan,
  PlanId,
  RatingSummary,
  Review,
  Session,
  WaitlistEntry,
  SignUpResult,
  SubscriptionState,
} from '@/types/domain';
import type { ChildProfileInput, SignInInput, SignUpInput } from '@/lib/validation';
import type { Coords } from '@/lib/geo';
import type { LocationProof } from '@/lib/check-in';

export type ActivityFilters = {
  query?: string;
  category?: ActivityCategoryId | 'all';
  childId?: string;
  /**
   * De onde medir a distância. Sem isto o catálogo devolve `distanceKm: null`
   * — preferimos omitir a distância a estimar uma que não temos.
   */
  origin?: Coords;
  /** Só atividades dentro deste raio. Exige `origin`; sem ele é ignorado. */
  radiusKm?: number;
  /** `distance` ordena do mais perto ao mais longe. Exige `origin`. */
  sort?: 'relevance' | 'distance';
};

/**
 * Contrato único entre UI e backend. As telas dependem só desta interface —
 * trocar o mock por HTTP/Supabase é implementar isto de novo, sem tocar em tela.
 */
export type KidooApi = {
  auth: {
    signIn(input: SignInInput): Promise<Session>;
    /**
     * Pode não devolver sessão: com confirmação de e-mail ligada, ela só
     * existe depois do clique no link. Quem chama decide o que fazer com cada
     * desfecho — a camada de serviço não escolhe tela.
     */
    signUp(input: SignUpInput): Promise<SignUpResult>;
    /** Reenvia o e-mail de confirmação para quem não recebeu. */
    resendConfirmation(email: string): Promise<void>;
    /**
     * Manda o link de redefinição de senha.
     *
     * Não devolve nada, e não devolve de propósito: dizer se o e-mail tem
     * conta transformaria esta tela num verificador de cadastro — digita-se
     * uma lista de endereços e descobre-se quais são clientes do Kidoo. Pelo
     * mesmo motivo a tela responde a mesma frase nos dois casos. É a regra que
     * `signIn` já segue ao não separar "e-mail não existe" de "senha errada".
     */
    requestPasswordReset(email: string): Promise<void>;
    /**
     * Troca a senha da sessão atual.
     *
     * Exige sessão: quem chega pelo link de redefinição entra primeiro com
     * `confirmByLink` — o clique no link é a prova de acesso à caixa de
     * entrada — e só então escolhe a senha nova.
     */
    updatePassword(password: string): Promise<void>;
    signOut(): Promise<void>;
    /** Valida a sessão restaurada do armazenamento seguro. */
    restore(token: string): Promise<Session | null>;
    /**
     * Entra com a sessão que veio no link do e-mail de confirmação.
     *
     * O link é a única prova de que a pessoa tem acesso àquela caixa de
     * entrada — e é por isso que ele já entra, em vez de mandar digitar a
     * senha de novo logo depois de tê-la escolhido.
     */
    confirmByLink(tokens: { accessToken: string; refreshToken: string }): Promise<Session>;
  };
  /** O responsável, e o que ele pode mudar em si mesmo. */
  profile: {
    /**
     * Troca a foto do responsável.
     *
     * `photoUri` é o arquivo local que o seletor devolveu; quem sobe para o
     * Storage é o serviço. `null` remove — e remover é um toque, porque foto
     * de rosto não deveria exigir apagar a conta para sair do ar.
     *
     * Devolve o responsável com a URI pronta para exibir, e é quem chamou que
     * precisa levá-la para a sessão: o cabeçalho do Perfil lê de lá.
     */
    updatePhoto(photoUri: string | null): Promise<Guardian>;
  };
  children: {
    list(): Promise<Child[]>;
    create(input: ChildProfileInput & { interests: ActivityCategoryId[] }): Promise<Child>;
    /**
     * Troca a foto.
     *
     * `photoUri` é o arquivo local que o seletor devolveu; quem sobe para o
     * Storage é o serviço. `null` remove a foto — e remover tem de ser possível
     * com um toque, porque é foto de criança e quem se arrepende não deveria
     * precisar apagar a conta.
     *
     * Devolve a criança já com a URI pronta para exibir, não o caminho no
     * bucket: nenhuma tela precisa saber que existe Storage no meio.
     */
    updatePhoto(input: { childId: string; photoUri: string | null }): Promise<Child>;
  };
  catalog: {
    categories(): Promise<ActivityCategory[]>;
    activities(filters?: ActivityFilters): Promise<Activity[]>;
    activity(id: string, origin?: Coords): Promise<Activity>;
    /** Turmas com vaga aberta, da mais próxima para a mais distante. */
    sessions(activityId: string): Promise<ClassSession[]>;
    /**
     * O estabelecimento e o que ele oferece.
     *
     * Existe porque o lugar da aula era um nome sem página: a família sabia
     * onde ia a criança e não tinha como descobrir o endereço, o telefone nem
     * o que mais aquele lugar oferece sem voltar à busca e procurar de novo.
     *
     * Devolve os dois juntos, e não um `partner(id)` mais um
     * `activities({partnerId})`: a tela mostra os dois ao mesmo tempo, e em
     * duas chamadas ela teria dois carregamentos e dois erros possíveis para
     * uma informação só.
     */
    partner(id: string, origin?: Coords): Promise<{ partner: Partner; activities: Activity[] }>;
    recommended(childId: string, origin?: Coords): Promise<Activity[]>;
    /** Comentários da atividade, mais recentes primeiro, com o resumo das notas. */
    reviews(activityId: string): Promise<{ summary: RatingSummary; reviews: Review[] }>;
    /** Avaliação do responsável sobre o estabelecimento, após a aula. */
    submitReview(input: { bookingId: string; rating: number; comment: string }): Promise<Review>;
  };
  plans: {
    list(): Promise<Plan[]>;
    subscribe(planId: PlanId): Promise<SubscriptionState>;
    current(): Promise<SubscriptionState | null>;
  };
  bookings: {
    list(): Promise<BookingDetails[]>;
    get(id: string): Promise<BookingDetails>;
    /** A reserva é de uma turma, não de uma atividade: é ela que tem lugar. */
    create(input: { sessionId: string; childId: string }): Promise<Booking>;
    /**
     * Registra a presença, credita XP e, ao subir de nível, Kidoo Bônus.
     *
     * `proof` é a leitura crua do aparelho. Quem decide se ela vale é o
     * serviço: o cliente nunca manda "estou no local", manda onde acha que
     * está, e a distância é recalculada aqui.
     */
    checkIn(bookingId: string, proof?: LocationProof): Promise<CheckInResult>;
    /**
     * Chamado pelo parceiro ao ler o QR ou digitar o código do responsável.
     * É o que transforma "o app diz que veio" em presença confirmada.
     */
    confirmByPartner(input: { bookingId: string; code: string }): Promise<BookingDetails>;
    /**
     * Cancela a reserva e devolve os coins. Só antes do prazo mínimo e antes
     * do check-in — a regra vive no serviço, não na tela.
     */
    cancel(bookingId: string): Promise<BookingDetails>;
  };
  /**
   * "Me avise quando abrir vaga."
   *
   * Existe porque a turma cheia é justamente a que a família mais queria: o
   * horário bom lota primeiro. Sem a fila, a única saída era voltar ao app
   * torcendo para dar sorte — e a demanda por aquele horário não deixava
   * rastro nenhum para mostrar ao parceiro.
   */
  waitlist: {
    /** Turmas em que esta família está esperando vaga. */
    list(): Promise<WaitlistEntry[]>;
    /** Só faz sentido em turma cheia: o aviso nasce da abertura da vaga. */
    join(input: { sessionId: string; childId: string }): Promise<void>;
    leave(input: { sessionId: string; childId: string }): Promise<void>;
  };
  /**
   * Aparelhos que recebem aviso.
   *
   * O token é do aparelho, não da pessoa: num celular compartilhado, ele passa
   * a valer para quem entrou por último. Por isso registra no login e some no
   * logout — senão a família anterior continuaria recebendo os avisos.
   */
  push: {
    register(input: { token: string; platform: 'ios' | 'android' | 'web' }): Promise<void>;
    forget(token: string): Promise<void>;
  };
  journey: {
    get(childId: string): Promise<Journey>;
  };
};
