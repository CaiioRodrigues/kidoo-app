const C = require('./comum');
const { d, p, txt, marca, titulo, secao, pergunta, opcoes, escala, linhas, campo, caixa, vazio } = C;
const { Document, Packer, Paragraph, TextRun, PageBreak, AlignmentType } = d;

const filhos = [];
const add = (x) => Array.isArray(x) ? filhos.push(...x) : filhos.push(x);

add(marca('Pesquisa de mercado'));
add(titulo('O que sua família procura\npara os filhos fazerem'.replace('\n', ' '),
  'Questionário para famílias com crianças de 3 a 12 anos · 12 a 15 minutos'));

add(caixa([
  p([txt('Não estamos vendendo nada.', { bold: true, color: C.TINTA, size: 10.5 }),
     txt(' Estamos tentando entender como as famílias escolhem — e desistem de — atividades para os filhos. Não existe resposta certa, e uma resposta negativa nos ajuda mais do que uma resposta gentil.', { size: 10.5 })], { after: 8 }),
  p('Suas respostas são usadas apenas de forma agregada. Nenhum dado de criança é solicitado aqui: não pedimos nome, escola nem endereço.',
    { size: 9.5, color: C.FRACO, after: 0 }),
], C.ROXO_TINTO));

// ---------------------------------------------------------------- 01 -------
add(secao(1, 'Quem está respondendo'));
add(pergunta(1, 'Em que bairro e cidade vocês moram?'));
add(campo(''));
add(pergunta(2, 'Quantos filhos de até 12 anos, e que idades?'));
add(campo('Quantidade:                                   Idades:'));
add(pergunta(3, 'Quem costuma levar a criança até a atividade?', '(marque tudo que se aplica)'));
add(opcoes(['Eu mesmo(a)', 'Meu/minha companheiro(a)', 'Avós', 'Outro familiar', 'Motorista / transporte escolar', 'Ninguém — hoje não faz atividade'], 2));
add(pergunta(4, 'Quanto a família gasta hoje, por mês, com atividades extracurriculares dos filhos?', '(some tudo: mensalidades, uniforme, transporte)'));
add(opcoes(['Nada hoje', 'Até R$ 150', 'R$ 151 a R$ 300', 'R$ 301 a R$ 500', 'R$ 501 a R$ 800', 'Mais de R$ 800'], 3));

// ---------------------------------------------------------------- 02 -------
add(secao(2, 'O que acontece hoje'));
add(p('Nesta parte, queremos só os fatos dos últimos meses — não o que seria ideal.',
  { size: 9.5, italics: true, color: C.FRACO, after: 4 }));

add(pergunta(5, 'Nos últimos 12 meses, quais atividades seu filho fez?', '(marque tudo que se aplica)'));
add(opcoes(['Natação', 'Futebol', 'Ballet / dança', 'Judô / luta', 'Música', 'Teatro', 'Inglês', 'Arte / pintura', 'Ginástica', 'Nenhuma', 'Outra:', ''], 3));
add(pergunta(6, 'Hoje, quantas atividades pagas ele faz por semana?'));
add(opcoes(['Nenhuma', '1', '2', '3 ou mais'], 4));
add(pergunta(7, 'Nos últimos 12 meses, vocês pararam alguma atividade antes do fim do contrato ou do ano?'));
add(opcoes(['Não', 'Sim, uma vez', 'Sim, mais de uma vez'], 3));
add(new (require('docx').Paragraph)({ spacing: { before: 120, after: 0 }, keepNext: true, children: [C.txt('Se sim, por quê?', { size: 10 })] }));
add(linhas(2));
add(pergunta(8, 'Nos últimos 3 meses, você chegou a procurar uma atividade nova e acabou não matriculando?'));
add(opcoes(['Não aconteceu', 'Aconteceu uma vez', 'Aconteceu mais de uma vez'], 3));
add(new (require('docx').Paragraph)({ spacing: { before: 120, after: 40 }, keepNext: true, children: [C.txt('Se aconteceu, o que impediu?', { size: 10 })] }));
add(opcoes(['O preço', 'O contrato longo', 'O horário não batia', 'Ficava longe', 'Não sabia se ele ia gostar', 'A vaga já tinha acabado', 'Outro:', ''], 2));
add(pergunta(9, 'Nos últimos 6 meses, quantas aulas experimentais ou avulsas vocês fizeram?'));
add(opcoes(['Nenhuma', '1 ou 2', '3 a 5', 'Mais de 5'], 4));
add(pergunta(10, 'Qual a distância máxima que você aceita percorrer para levar seu filho, na rotina de toda semana?'));
add(opcoes(['Só o que dá para ir a pé', 'Até 10 min de carro', 'Até 20 min de carro', 'Até 30 min', 'Mais que isso, se valer a pena'], 2));

// ---------------------------------------------------------------- 03 -------
add(secao(3, 'O que hoje atrapalha'));
add(pergunta(11, 'O quanto ter que fechar matrícula com fidelidade de vários meses incomoda vocês?'));
add(escala(0, 10, '0 — não me incomoda nada', '10 — é o que mais me impede'));
add(pergunta(12, 'Na hora de escolher uma atividade, o que pesa mais?', '(numere de 1 a 3 os três mais importantes)'));
add(opcoes(['(     ) O preço', '(     ) A distância de casa', '(     ) O horário caber na rotina', '(     ) O professor', '(     ) A criança gostar', '(     ) Segurança do local', '(     ) A estrutura do lugar', '(     ) Indicação de outros pais'].map((x) => x.replace('(     ) ', '')), 2));
add(pergunta(13, 'Já aconteceu de pagar mensalidade de uma atividade que a criança tinha parado de frequentar?'));
add(opcoes(['Nunca aconteceu', 'Sim, por 1 ou 2 meses', 'Sim, por 3 meses ou mais'], 3));
add(pergunta(14, 'Se você pudesse mudar uma única coisa em como as atividades infantis funcionam hoje, qual seria?'));
add(linhas(3));

// ---------------------------------------------------------------- 04 -------
add(new Paragraph({ children: [new PageBreak()] }));
add(secao(4, 'Uma ideia, e o que você acha dela'));
add(caixa([
  p('Imagine um aplicativo com uma assinatura mensal.', { bold: true, color: C.TINTA, size: 11, after: 8 }),
  p('Em vez de matricular a criança em uma atividade fixa, a família recebe uma cota de créditos por semana e usa como quiser: natação na segunda, capoeira na quinta, teatro no sábado — em lugares diferentes, sem contrato com nenhum deles.', { size: 10.5, after: 8 }),
  p('Você abre o app, vê no mapa o que tem perto de casa, reserva um horário específico, leva a criança e confirma a chegada no local. Se em uma semana não usar, não usou.', { size: 10.5, after: 0 }),
], C.ROXO_TINTO));
add(vazio(6));

add(pergunta(15, 'Qual foi a sua primeira reação, em uma palavra?'));
add(campo(''));
add(pergunta(16, 'Quão útil isso seria para a sua família, hoje?'));
add(escala(0, 10, '0 — não serve para nós', '10 — resolve um problema real'));
add(pergunta(17, 'O que ficou confuso, ou que você acha que não funcionaria?'));
add(linhas(3));
add(pergunta(18, 'Para que tipo de família isso NÃO serve?'));
add(linhas(2));

// ---------------------------------------------------------------- 05 -------
add(secao(5, 'Uso e preço'));
add(p('Pense em um plano com uma aula por semana — quatro aulas no mês — para uma criança.',
  { size: 10, italics: true, color: C.FRACO, after: 6 }));

add(pergunta(19, 'Sendo honesto: quantas dessas quatro aulas você acha que usaria de verdade no mês?'));
add(opcoes(['Nenhuma', '1', '2', '3', 'As 4'], 5));
add(pergunta(20, 'A partir de que valor mensal você acharia caro, mas ainda assim consideraria assinar?'));
add(campo('R$'));
add(pergunta(21, 'A partir de que valor mensal você acharia caro demais e nem consideraria?'));
add(campo('R$'));
add(pergunta(22, 'Abaixo de que valor você desconfiaria da qualidade — barato a ponto de parecer que tem algo errado?'));
add(campo('R$'));
add(pergunta(23, 'E qual valor mensal você acharia uma boa compra, daquelas que você assinaria sem pensar muito?'));
add(campo('R$'));
add(pergunta(24, 'Se o plano fosse de duas aulas por semana (oito no mês), quanto você pagaria por mês?'));
add(campo('R$'));
add(pergunta(25, 'Como você prefere pagar?'));
add(opcoes(['Mensalidade fixa', 'Só por aula, avulsa', 'Pacote de créditos que não expira', 'Tanto faz'], 2));

// ---------------------------------------------------------------- 06 -------
add(secao(6, 'O passo seguinte'));
add(p('As três últimas perguntas valem mais que todas as outras juntas: dizer que gostou é fácil, e a gente precisa saber o que você faria de verdade.',
  { size: 10, italics: true, color: C.FRACO, after: 6 }));
add(pergunta(26, 'Se abríssemos vagas no seu bairro nas próximas semanas, você iria querer testar?'));
add(opcoes(['Sim, quero ser avisado(a)', 'Talvez, quero ver como ficou primeiro', 'Não'], 1));
add(pergunta(27, 'Você toparia pagar o primeiro mês, com desconto, para experimentar?'));
add(opcoes(['Sim, pagaria agora', 'Só depois de ver o app funcionando', 'Não pagaria antes de conhecer o local', 'Não'], 1));
add(pergunta(28, 'De 0 a 10, o quanto você indicaria isso para outra família com filhos?'));
add(escala(0, 10, '0 — de jeito nenhum', '10 — indicaria com certeza'));

add(vazio(10));
add(p('Se quiser ser avisado(a), deixe um contato. Fica só com a gente, e é usado só para isso.',
  { size: 10, color: C.TEXTO, after: 2 }));
add(campo('Nome:'));
add(campo('WhatsApp ou e-mail:'));

// ------------------------------------------------- página do aplicador -----
add(new Paragraph({ children: [new PageBreak()] }));
add(secao(null, 'Para quem aplica — não entregar junto'));
add(p([txt('Antes de tudo: não venda.', { bold: true, color: C.TINTA }),
       txt(' Se a pessoa perceber que você quer que ela goste, ela vai gostar — e a pesquisa perde o valor. Você não está apresentando o Kidoo; está descobrindo se ele precisa existir.')], { after: 10 }));

const dicas = [
  ['A ordem importa.', 'As seções 1 a 3 vêm antes da ideia de propósito. Depois que a pessoa vê a proposta, ela não consegue mais lembrar do próprio comportamento sem contaminação. Nunca adiante a seção 4.'],
  ['Quando ouvir "eu usaria", pergunte quando foi a última vez.', 'Intenção declarada não prevê nada. Comportamento passado prevê. As perguntas 7, 8 e 9 existem para isso — e se as respostas forem todas "nunca aconteceu", essa família não é cliente, por mais entusiasmada que ela pareça.'],
  ['Silêncio é ferramenta.', 'Nas perguntas abertas, faça a pergunta e espere. As três primeiras frases são educação; o que vem depois da pausa é o que interessa.'],
  ['Não corrija a pessoa.', 'Se ela entendeu errado a proposta, anote como ela entendeu — isso é dado sobre a nossa explicação, não erro dela.'],
  ['As perguntas 20 a 23 são uma escada.', 'Se os quatro valores saírem fora de ordem, releia com a pessoa em vez de descartar. Fora de ordem costuma significar que ela não entendeu o que está incluído no plano.'],
];
dicas.forEach(([t, corpo]) => {
  add(p([txt(t + ' ', { bold: true, color: C.TINTA }), txt(corpo)], { after: 8 }));
});

add(vazio(6));
add(caixa([
  p('O que faz esta pesquisa valer alguma coisa', { bold: true, color: C.TINTA, size: 11, after: 8 }),
  p('Trinta respostas honestas valem mais que trezentas de conhecidos querendo agradar. Prefira aplicar na porta de escola, em grupo de bairro e em fila de atividade — e evite amigos próximos e família.', { size: 10.5, after: 8 }),
  p('Sinal de alerta: se quase ninguém marcar "aconteceu mais de uma vez" na 8, o problema que a gente acha que existe pode não existir. Vale mais descobrir isso agora, com trinta conversas, do que depois de um ano de código.', { size: 10.5, after: 0 }),
], C.AMARELO_SUAVE));

const doc = new Document({
  creator: 'Kidoo', title: 'Kidoo — pesquisa com famílias',
  description: 'Questionário de teste de mercado para famílias com crianças de 3 a 12 anos',
  sections: [{
    properties: { page: { margin: { top: 1080, bottom: 1080, left: 1080, right: 1080 } } },
    children: filhos,
  }],
});

Packer.toBuffer(doc).then((b) => require('fs').writeFileSync('Kidoo-pesquisa-familias.docx', b));
