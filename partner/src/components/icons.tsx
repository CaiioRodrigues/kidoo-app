/**
 * Ícones da navegação.
 *
 * Emoji funcionariam, mas o painel é ferramenta de trabalho: um 💸 colorido ao
 * lado de "Repasse" faz a tela parecer brincadeira justamente onde se fala de
 * dinheiro. Traço simples, herdando a cor do texto — assim o item ativo muda de
 * cor sozinho, sem uma segunda versão de cada ícone.
 */
const base = {
  width: 18,
  height: 18,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

/** Prancheta: a lista de quem vem hoje. */
export function IconeHoje() {
  return (
    <svg {...base}>
      <rect x="4" y="4" width="16" height="17" rx="2.5" />
      <path d="M9 3.5h6v2.5H9z" />
      <path d="M8.5 11h7M8.5 15h4.5" />
    </svg>
  );
}

/** Calendário com horários marcados: as turmas e as vagas de cada uma. */
export function IconeTurmas() {
  return (
    <svg {...base}>
      <rect x="3.5" y="5.5" width="17" height="15" rx="2.5" />
      <path d="M3.5 10h17M8 3.5v4M16 3.5v4" />
      <path d="M8 14h3M8 17.5h3" />
      <circle cx="15.8" cy="14" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Cédula com seta saindo: o dinheiro que vai daqui para o parceiro. */
export function IconeRepasse() {
  return (
    <svg {...base}>
      <rect x="2.5" y="7.5" width="13.5" height="9" rx="1.8" />
      <circle cx="9.25" cy="12" r="2" />
      {/* A seta é centrada na cédula: descaída, o ícone puxava o item da
          navegação para baixo em relação aos vizinhos. */}
      <path d="M20 8v8.6M17 13.6l3 3 3-3" />
    </svg>
  );
}

export function IconeSair() {
  return (
    <svg {...base}>
      <path d="M14.5 4.5H6.5a1.5 1.5 0 0 0-1.5 1.5v12a1.5 1.5 0 0 0 1.5 1.5h8" />
      <path d="M11 12h9M17 8.5l3.5 3.5L17 15.5" />
    </svg>
  );
}
