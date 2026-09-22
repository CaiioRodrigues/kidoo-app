/**
 * Os documentos legais estão prontos para uma família de verdade?
 *
 * Roda com `npm run test:documentos`.
 *
 * **Este teste falha de propósito enquanto os dados da empresa não estiverem
 * preenchidos.** Não é um teste quebrado: é o estado do projeto sendo dito em
 * voz alta. Uma Política de Privacidade que abre com "[…razão social…]" e é
 * publicada assim não protege ninguém — e o controlador dos dados é
 * exatamente o que a LGPD manda identificar.
 *
 * Ele fica verde no dia em que os `[…]` de `shared/documentos.ts` virarem
 * razão social, CNPJ e endereço.
 *
 * Confere também o que nenhuma revisão humana faz de graça: que os dois
 * documentos citam o canal de contato, que a data de atualização existe, e
 * que nenhuma seção nasceu vazia.
 */
import { DOCUMENTOS, EMAIL_PRIVACIDADE, lacunas, type Documento } from '../shared/documentos';

const falhas: string[] = [];
const ok = (cond: boolean, msg: string) => {
  console.log((cond ? '  OK    ' : '  FALHA ') + msg);
  if (!cond) falhas.push(msg);
};

const texto = (doc: Documento): string =>
  doc.secoes
    .flatMap((s) => s.blocos.flatMap((b) => (b.tipo === 'p' ? [b.texto] : b.itens)))
    .join('\n');

for (const [id, doc] of Object.entries(DOCUMENTOS)) {
  console.log(`\n${doc.titulo} (/${id})\n`);

  ok(
    /^\d{2}\/\d{2}\/\d{4}$/.test(doc.atualizadoEm),
    `tem data de atualização (${doc.atualizadoEm})`,
  );
  ok(doc.secoes.length >= 5, `tem conteúdo de verdade: ${doc.secoes.length} seções`);
  ok(
    doc.secoes.every((s) => s.blocos.length > 0),
    'nenhuma seção nasceu vazia',
  );
  ok(texto(doc).includes(EMAIL_PRIVACIDADE), `diz para onde escrever (${EMAIL_PRIVACIDADE})`);

  const pendentes = lacunas(doc);
  ok(
    pendentes.length === 0,
    pendentes.length === 0
      ? 'sem lacunas a preencher'
      : `FALTA PREENCHER antes de publicar: ${pendentes.join(' · ')}`,
  );
}

// O que só a Política precisa dizer, porque é o que a LGPD e as lojas cobram.
console.log('\nO que a Política de Privacidade tem de responder\n');
const privacidade = texto(DOCUMENTOS.privacidade).toLowerCase();
for (const [assunto, agulha] of [
  ['quem é o controlador', 'cnpj'],
  ['o que coleta da criança', 'data de nascimento'],
  ['com quem compartilha', 'resend'],
  ['por quanto tempo guarda', 'registro financeiro'],
  ['como apagar', 'excluir minha conta'],
  ['o artigo da criança', 'art. 14'],
] as const) {
  ok(privacidade.includes(agulha.toLowerCase()), `${assunto} ("${agulha}")`);
}

console.log(
  falhas.length === 0
    ? '\nTudo certo — os documentos podem ir para a loja.'
    : `\n${falhas.length} pendência(s). NÃO publique assim.`,
);
process.exit(falhas.length === 0 ? 0 : 1);
