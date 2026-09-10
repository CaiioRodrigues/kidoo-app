/**
 * A identidade do app, no painel.
 *
 * O Kidoo tem uma marca inteira — o mascote, os blobs orgânicos, uma cor por
 * modalidade — e o painel usava só o roxo. Um estabelecimento que conhece o
 * app pela criança chegava aqui e via outro produto.
 *
 * A geometria é a mesma do aplicativo (`src/features/tutorial/Mascot.tsx` e
 * `src/components/brand/BlobBackdrop.tsx`), redesenhada em SVG do navegador.
 * Copiar as coordenadas em vez de importar é deliberado: o app usa
 * `react-native-svg`, que não roda aqui, e uma marca que só existe em dois
 * lugares não justifica um pacote compartilhado. Se mudar lá, muda aqui.
 */

/** Kiddo, o mascote. As cores saem das variáveis do tema, então ele acompanha claro e escuro. */
export function Kiddo({ size = 96, acenando = true }: { size?: number; acenando?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label="Kiddo, o mascote do Kidoo">
      {/* braços atrás do corpo */}
      <rect
        x="6" y="52" width="20" height="9" rx="4.5"
        fill="var(--purple-dark)"
        transform={acenando ? 'rotate(-28 16 56)' : undefined}
      />
      <rect x="74" y="56" width="20" height="9" rx="4.5" fill="var(--purple-dark)" />

      <circle cx="50" cy="52" r="34" fill="var(--purple)" />

      {/* rosto: o branco e o quase-preto dos olhos são fixos porque estão um
          sobre o outro — não é cor de tema, é contraste interno do desenho. */}
      <ellipse cx="39" cy="46" rx="5" ry="6" fill="#FFFFFF" />
      <ellipse cx="61" cy="46" rx="5" ry="6" fill="#FFFFFF" />
      <circle cx="40" cy="47" r="2.6" fill="#1E1E2F" />
      <circle cx="62" cy="47" r="2.6" fill="#1E1E2F" />
      <path d="M 39 60 q 11 11 22 0" stroke="#FFFFFF" strokeWidth="4.2" strokeLinecap="round" fill="none" />

      <circle cx="30" cy="57" r="4" fill="var(--pink)" opacity={0.55} />
      <circle cx="70" cy="57" r="4" fill="var(--pink)" opacity={0.55} />

      {/* antena com a bolinha amarela da marca */}
      <path d="M 50 18 L 50 8" stroke="var(--purple-dark)" strokeWidth="3.4" strokeLinecap="round" />
      <circle cx="50" cy="6" r="5" fill="var(--yellow)" />
    </svg>
  );
}

/**
 * As formas orgânicas atrás do cabeçalho.
 *
 * Curvas fechadas sem nenhum trecho reto — é o que faz a forma parecer viva em
 * vez de um retângulo arredondado. Opacidade baixa porque o texto passa por
 * cima: no app, a primeira versão competia com a leitura.
 */
export function Blobs() {
  return (
    <svg
      className="blobs"
      viewBox="0 0 390 220"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M330 -120 C 425 -112, 478 -24, 436 62 C 396 144, 280 138, 248 62 C 218 -8, 262 -124, 330 -120 Z"
        fill="var(--purple)"
      />
      <path
        d="M60 -150 C 130 -142, 162 -66, 120 -14 C 78 38, -6 22, -32 -34 C -56 -88, -6 -156, 60 -150 Z"
        fill="var(--teal)"
        opacity={0.85}
      />
      <path
        d="M392 96 C 442 90, 476 136, 454 178 C 432 220, 368 214, 352 172 C 338 134, 354 100, 392 96 Z"
        fill="var(--yellow)"
        opacity={0.9}
      />
    </svg>
  );
}

/**
 * As modalidades e suas cores, iguais às do app (`src/theme/categories.ts`).
 *
 * Ficam escritas aqui em vez de virem do banco de propósito: a vitrine é a
 * primeira tela, vista por quem não tem sessão, e uma chamada de rede ali
 * significaria um estado de carregamento e um modo de falhar numa página cuja
 * única função é explicar. A lista é fechada e muda de ano em ano.
 *
 * Cada modalidade traz os dois pares porque o tema escuro não é o claro com
 * brilho reduzido: o fundo pastel vira mancha luminosa e o traço escuro some.
 * São as mesmas quatro cores por modalidade que o app usa.
 *
 * A cor nunca carrega significado sozinha — o rótulo está sempre junto.
 */
export const MODALIDADES: {
  nome: string;
  cor: string;
  fundo: string;
  corEscura: string;
  fundoEscuro: string;
}[] = [
  { nome: 'Futebol',   cor: '#6A3FC6', fundo: '#EFE9FB', corEscura: '#A382F0', fundoEscuro: '#2A2247' },
  { nome: 'Natação',   cor: '#0E9BA0', fundo: '#DFF6F6', corEscura: '#3FD8DA', fundoEscuro: '#123437' },
  { nome: 'Dança',     cor: '#D93E76', fundo: '#FFE9F1', corEscura: '#FF8AB8', fundoEscuro: '#3A1B29' },
  { nome: 'Artes',     cor: '#B07500', fundo: '#FFF3D6', corEscura: '#FFD466', fundoEscuro: '#3A2E0F' },
  { nome: 'Judô',      cor: '#3D4B9E', fundo: '#E6E9F8', corEscura: '#8B99E8', fundoEscuro: '#1E2340' },
  { nome: 'Ginástica', cor: '#C2410C', fundo: '#FFEBE0', corEscura: '#FF9666', fundoEscuro: '#3A2015' },
  { nome: 'Tênis',     cor: '#3F8A2B', fundo: '#E6F5E0', corEscura: '#7FD463', fundoEscuro: '#1B2F16' },
  { nome: 'Basquete',  cor: '#B45309', fundo: '#FFF0DC', corEscura: '#F0A05A', fundoEscuro: '#3A2812' },
  { nome: 'Vôlei',     cor: '#1D6FA8', fundo: '#E2F0FA', corEscura: '#66B9EB', fundoEscuro: '#152A3A' },
];
