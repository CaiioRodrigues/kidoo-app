/**
 * A identidade do app, no painel.
 *
 * O Kidoo tem uma marca inteira — o mascote, os blobs orgânicos, uma cor por
 * modalidade — e o painel usava só o roxo. Um estabelecimento que conhece o
 * app pela criança chegava aqui e via outro produto.
 *
 * As formas vêm do aplicativo (`src/components/brand/BlobBackdrop.tsx`),
 * redesenhadas em SVG do navegador: o app usa `react-native-svg`, que não roda
 * aqui. Se mudarem lá, mudam aqui.
 *
 * O mascote não está mais neste arquivo. Ele era um boneco geométrico que eu
 * desenhei enquanto o personagem de verdade não existia; agora existe, é um
 * lobo-guará renderizado, e mora em `assets/`. O SVG antigo segue no app, onde
 * a troca ainda não foi feita.
 */

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
