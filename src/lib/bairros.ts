/**
 * Os bairros que existem no catálogo, para sugerir na busca.
 *
 * A busca por bairro já funcionava — o campo do Explorar casa título, nome do
 * estabelecimento e bairro. O que ela não fazia era ajudar quem não sabe o
 * nome: digitar "Savassi" quando a única turma perto é no "Funcionários"
 * devolve tela vazia e nenhuma pista. Uma fileira montada a partir do que
 * existe nunca devolve nada.
 *
 * Derivado, e não uma lista escrita à mão: lista fixa envelhece calada. O
 * bairro do primeiro parceiro de Contagem entraria no catálogo e não na
 * fileira, e ninguém perceberia — o defeito é uma ausência.
 */

/** O mínimo que esta função precisa saber de uma atividade. */
type ComBairro = { partner: { neighborhood: string } };

export type BairroSugerido = {
  /** Como aparece na tela, e o que vai para a busca. */
  nome: string;
  /** Quantas atividades existem nele. É o que ordena a fileira. */
  quantas: number;
};

/**
 * Maiúscula, acento e espaço sobrando não podem virar bairros diferentes.
 *
 * `neighborhood` é `<input maxLength={60}>` no cadastro do parceiro, sem lista
 * e sem validação: "Buritis", "buritis" e " Buritis " são três linhas no banco
 * e um bairro só na cabeça de quem procura. Isto junta os três.
 *
 * O que NÃO resolve: "Buritis II" e "B. Buritis" continuam separados, e
 * nenhuma normalização honesta resolveria — só uma lista fixa no cadastro do
 * parceiro, que é onde a sujeira nasce.
 */
function chave(bairro: string): string {
  return bairro
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Os bairros do catálogo, do mais cheio ao mais vazio.
 *
 * `limite` existe porque isto é uma dica, não um diretório: numa fileira que
 * rola, o vigésimo bairro está a quinze arrastadas de distância e ninguém
 * chega nele. Quem sabe o nome digita.
 */
export function bairrosDoCatalogo(atividades: ComBairro[], limite = 10): BairroSugerido[] {
  const porChave = new Map<string, { grafias: Map<string, number>; quantas: number }>();

  for (const atividade of atividades) {
    const bruto = atividade.partner.neighborhood?.replace(/\s+/g, ' ').trim() ?? '';
    if (!bruto) continue;
    const k = chave(bruto);
    if (!k) continue;

    const atual = porChave.get(k) ?? { grafias: new Map<string, number>(), quantas: 0 };
    atual.quantas += 1;
    atual.grafias.set(bruto, (atual.grafias.get(bruto) ?? 0) + 1);
    porChave.set(k, atual);
  }

  return [...porChave.values()]
    .map((entrada) => ({
      // A grafia que mais aparece ganha. Empate desempata por ordem
      // alfabética, e não pela ordem de chegada: sem isso a mesma lista sai
      // diferente a cada carregamento, e "Buritis" vira "buritis" sozinho.
      nome: [...entrada.grafias.entries()].sort(
        (a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pt-BR'),
      )[0]![0],
      quantas: entrada.quantas,
    }))
    .sort((a, b) => b.quantas - a.quantas || a.nome.localeCompare(b.nome, 'pt-BR'))
    .slice(0, limite);
}

/** A busca digitada corresponde a este bairro? Usado para marcar o chip. */
export function mesmoBairro(texto: string, bairro: string): boolean {
  return chave(texto) === chave(bairro);
}
