const C = require('./comum');
const { d, p, txt, marca, titulo, secao, pergunta, opcoes, escala, linhas, campo, caixa, vazio } = C;
const { Document, Packer, Paragraph, TextRun, PageBreak } = d;

const filhos = [];
const add = (x) => Array.isArray(x) ? filhos.push(...x) : filhos.push(x);
const sub = (t) => new Paragraph({ spacing: { before: 120, after: 40 }, keepNext: true,
  children: [txt(t, { size: 10 })] });

add(marca('Pesquisa de mercado'));
add(titulo('Quanto da sua agenda infantil fica vazia',
  'Questionário para academias, escolinhas, escolas de dança e clubes · 20 a 25 minutos'));

add(caixa([
  p([txt('Não é uma proposta comercial.', { bold: true, color: C.TINTA, size: 10.5 }),
     txt(' Estamos estudando se faz sentido construir um produto que ocupe vaga que hoje fica vazia em turma infantil. Antes de construir, queremos ouvir quem já opera isso todo dia.', { size: 10.5 })], { after: 8 }),
  p('As respostas são tratadas de forma agregada. Não pedimos faturamento, dado de aluno nem contrato — e "não sei" é uma resposta legítima em qualquer pergunta.',
    { size: 9.5, color: C.FRACO, after: 0 }),
], C.ROXO_TINTO));

// ---------------------------------------------------------------- 01 -------
add(secao(1, 'O estabelecimento'));
add(pergunta(1, 'Que tipo de lugar é?'));
add(opcoes(['Academia', 'Escolinha esportiva', 'Escola de dança / ballet', 'Escola de luta', 'Clube', 'Escola de música', 'Espaço de recreação', 'Outro:'], 2));
add(pergunta(2, 'Bairro e cidade, e há quanto tempo funciona.'));
add(campo('Bairro:                                        Cidade:                                        Anos de casa:'));
add(pergunta(3, 'Quantas crianças de até 12 anos frequentam o lugar por semana, hoje?'));
add(opcoes(['Menos de 20', '20 a 50', '51 a 100', '101 a 200', 'Mais de 200'], 3));
add(pergunta(4, 'Quantas turmas infantis acontecem por semana?'));
add(campo('Turmas por semana:'));

// ---------------------------------------------------------------- 02 -------
add(secao(2, 'A ocupação real das turmas'));
add(p('Esta é a parte mais importante do questionário. Se puder, responda com o número que você viu na última semana — não com a média que costuma dizer para cliente.',
  { size: 10, italics: true, color: C.FRACO, after: 6 }));

add(pergunta(5, 'Quantos lugares cabem numa turma infantil típica sua?'));
add(campo('Capacidade:'));
add(pergunta(6, 'E quantas crianças aparecem, em média, nessa turma?'));
add(campo('Presença média:'));
add(pergunta(7, 'Em quantas das suas turmas infantis sobra lugar toda semana?'));
add(opcoes(['Em todas', 'Na maioria', 'Em algumas', 'Em quase nenhuma', 'Em nenhuma — está tudo cheio'], 2));
add(pergunta(8, 'Em que horários sobra mais lugar?', '(marque tudo que se aplica)'));
add(opcoes(['Manhã, dias úteis', 'Tarde, dias úteis', 'Início da noite', 'Sábado de manhã', 'Sábado à tarde', 'Domingo'], 3));
add(pergunta(9, 'Receber uma criança a mais numa turma que já vai acontecer custa quanto a mais para você?'));
add(opcoes(['Nada, é o mesmo custo', 'Quase nada', 'Um pouco', 'Bastante'], 2));
add(sub('Se custa alguma coisa, o que aumenta?'));
add(linhas(2));
add(pergunta(10, 'Existe um teto de crianças por turma? Por regra sua, do professor ou de alguma norma?'));
add(campo('Teto:                                                    Motivo:'));

// ---------------------------------------------------------------- 03 -------
add(secao(3, 'Como você preenche vaga hoje'));
add(pergunta(11, 'Você oferece aula experimental?'));
add(opcoes(['Sim, gratuita', 'Sim, paga — valor: R$', 'Não ofereço'], 3));
add(pergunta(12, 'Nos últimos 3 meses, quantas experimentais você deu, e quantas viraram matrícula?'));
add(campo('Experimentais:                                              Viraram matrícula:'));
add(pergunta(13, 'Como chega aluno novo hoje?', '(marque tudo que se aplica)'));
add(opcoes(['Indicação de outro aluno', 'Instagram', 'Google / site', 'Panfleto e fachada', 'Parceria com escola', 'WhatsApp de bairro', 'Não faço nada, chega sozinho', 'Outro:'], 2));
add(pergunta(14, 'Quanto você calcula que gasta hoje para conseguir um aluno novo?'));
add(campo('R$                                                       (     ) Nunca calculei'));
add(pergunta(15, 'Você já trabalhou com Wellhub (Gympass), TotalPass ou plataforma parecida?'));
add(opcoes(['Nunca trabalhei', 'Trabalho hoje', 'Já trabalhei e saí'], 3));
add(sub('Se trabalhou, como foi? O que funcionou e o que não funcionou?'));
add(linhas(3));

// ---------------------------------------------------------------- 04 -------
add(secao(4, 'Uma ideia, e o que você acha dela'));
add(caixa([
  p('Um aplicativo em que a família assina um plano mensal — não com você, com a plataforma.', { bold: true, color: C.TINTA, size: 11, after: 8 }),
  p('Com esse plano, ela reserva aulas avulsas em lugares diferentes, aula por aula, sem matrícula em nenhum deles. Você escolhe quais turmas entram e quantos lugares abre em cada uma — 2, 5, ou nenhum nesta semana.', { size: 10.5, after: 8 }),
  p('A criança chega, você digita um código de seis dígitos no painel e aquela presença vira repasse. Sem o código, não há repasse. Sem exclusividade, sem mensalidade e sem multa para sair.', { size: 10.5, after: 0 }),
], C.ROXO_TINTO));
add(vazio(6));

add(pergunta(16, 'Qual foi a sua primeira reação, em uma palavra?'));
add(campo(''));
add(pergunta(17, 'Qual o seu interesse em testar algo assim?'));
add(escala(0, 10, '0 — nenhum interesse', '10 — quero começar'));
add(pergunta(18, 'O que mais te preocupa nessa ideia?'));
add(linhas(3));
add(pergunta(19, 'O quanto você acha que isso tiraria aluno da sua própria matrícula?'));
add(escala(0, 10, '0 — não tiraria nada', '10 — tiraria com certeza'));

// ---------------------------------------------------------------- 05 -------
add(secao(5, 'Quanto vale a vaga'));
add(p('Aqui não existe resposta que nos agrade. Um número honesto é a única coisa útil.',
  { size: 10, italics: true, color: C.FRACO, after: 6 }));

add(pergunta(20, 'Numa turma que já vai acontecer e tem lugar sobrando, qual o valor mínimo por criança presente que faria valer a pena para você?'));
add(campo('R$                              por presença'));
add(pergunta(21, 'E abaixo de que valor você recusaria na hora, sem nem pensar?'));
add(campo('R$                              por presença'));
add(pergunta(22, 'Agora o contrário: uma turma nova, aberta só por causa da plataforma, em horário que hoje está fechado. Quanto você precisaria por criança presente?'));
add(campo('R$                              por presença'));
add(pergunta(23, 'Se o valor viesse certo, quantos lugares você abriria numa turma na primeira semana?'));
add(opcoes(['Nenhum', '1 ou 2', '3 a 5', 'Mais de 5', 'Depende da turma'], 3));
add(pergunta(24, 'Como você prefere receber?'));
add(opcoes(['Uma vez por mês', 'Quinzenal', 'Semanal'], 3));
add(pergunta(25, 'Qual o prazo máximo aceitável entre a aula e o dinheiro na conta?'));
add(opcoes(['Até 7 dias', 'Até 15 dias', 'Até 30 dias', 'Mais de 30 dias tudo bem'], 2));

// ---------------------------------------------------------------- 06 -------
add(secao(6, 'A operação do dia a dia'));
add(pergunta(26, 'Na hora da aula infantil, quem está no balcão?'));
add(opcoes(['Recepcionista fixo', 'O próprio professor', 'O dono', 'Varia muito', 'Ninguém — a criança entra direto'], 2));
add(pergunta(27, 'Tem computador ou tablet com internet nesse balcão?'));
add(opcoes(['Sim, computador', 'Sim, tablet', 'Só celular', 'Não tem nada'], 2));
add(pergunta(28, 'Digitar um código de seis dígitos por criança que chega — isso cabe na sua rotina?'));
add(escala(0, 10, '0 — não tem como', '10 — tranquilo'));
add(pergunta(29, 'O que na sua operação de hoje quebraria com isso?'));
add(linhas(2));

// ---------------------------------------------------------------- 07 -------
add(secao(7, 'O passo seguinte'));
add(pergunta(30, 'Você toparia testar com uma turma, por um mês, sem custo para entrar?'));
add(opcoes(['Sim, pode me procurar', 'Talvez, quero ver funcionando antes', 'Não'], 1));
add(pergunta(31, 'O que precisaria estar resolvido para você dizer sim com convicção?'));
add(linhas(2));

// Os dois campos de contato numa tabela só: separados, o último escorregava
// sozinho para uma página em branco.
add(new Paragraph({ spacing: { before: 120, after: 40 }, keepNext: true,
  children: [txt('Se quiser acompanhar, deixe um contato. É usado só para isso.', { size: 10 })] }));
add(linhas(2, ['Nome e cargo:  ', 'WhatsApp ou e-mail:  ']));

// ------------------------------------------------- página do aplicador -----
add(new Paragraph({ children: [new PageBreak()] }));
add(secao(null, 'Para quem aplica — não entregar junto'));
add(p([txt('Você está entrevistando alguém que já ouviu muita promessa.', { bold: true, color: C.TINTA }),
       txt(' Dono de academia recebe proposta de plataforma toda semana. Se a conversa parecer venda, ele responde o que dá para responder rápido e você vai embora com nada.')], { after: 10 }));

const dicas = [
  ['A seção 2 é o teste da hipótese inteira.', 'Se a maioria responder "em nenhuma, está tudo cheio" na 7, o produto não tem mercado do jeito que pensamos. Nenhuma resposta entusiasmada da seção 4 compensa isso — e essa é justamente a resposta que a gente vai querer descontar. Não desconte.'],
  ['Peça o número da semana passada, não a média.', 'Nas 5 e 6, "a turma tem uns 15" costuma ser a capacidade, não a presença. Se puder, peça para olhar a lista de chamada junto. Um número conferido vale dez estimados.'],
  ['Não defenda o preço.', 'Nas 20 a 22 o entrevistado vai chutar alto. Anote o número alto. Se você discutir, ele para de responder e passa a negociar — e aí a pesquisa acabou.'],
  ['A pergunta 19 é sobre medo, não sobre fato.', 'Um 8 ou 9 ali não significa que canibaliza; significa que precisamos responder essa objeção antes de qualquer proposta. Anote as palavras exatas que a pessoa usar.'],
  ['A 29 vale ouro.', 'Quem opera todo dia enxerga o problema operacional que a gente não imagina. Deixe a pessoa falar até o fim, mesmo que fuja do roteiro.'],
  ['Termine perguntando quem mais você deveria ouvir.', 'Não está no formulário de propósito: é uma pergunta de fim de conversa, e é de onde saem as melhores entrevistas seguintes.'],
];
dicas.forEach(([t, corpo]) => {
  add(p([txt(t + ' ', { bold: true, color: C.TINTA }), txt(corpo)], { after: 8 }));
});

add(vazio(6));
add(caixa([
  p('O que conta como validação, e o que não conta', { bold: true, color: C.TINTA, size: 11, after: 8 }),
  p('Não conta: elogio à ideia, "interessante", nota alta na 17. Isso é educação.', { size: 10.5, after: 6 }),
  p('Conta: sobra de lugar confirmada na seção 2, um valor mínimo na 20 que caiba na nossa conta, e um "sim, pode me procurar" na 30 com contato deixado. Três parceiros com essas três coisas valem mais que trinta conversas simpáticas.', { size: 10.5, after: 0 }),
], C.AMARELO_SUAVE));

const doc = new Document({
  creator: 'Kidoo', title: 'Kidoo — pesquisa com estabelecimentos',
  description: 'Questionário de teste de mercado para academias, escolinhas e clubes',
  sections: [{
    properties: { page: { margin: { top: 1080, bottom: 1080, left: 1080, right: 1080 } } },
    children: filhos,
  }],
});

Packer.toBuffer(doc).then((b) => require('fs').writeFileSync('Kidoo-pesquisa-estabelecimentos.docx', b));
