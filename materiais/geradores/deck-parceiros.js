const pptxgen = require('pptxgenjs');

// Paleta da marca Kidoo — a mesma de src/theme/palettes.ts
const ROXO = '6A3FC6', ROXO_ESCURO = '54309E', ROXO_SUAVE = 'EFE9FB', ROXO_TINTO = 'F7F4FE';
const TEAL = '0E9BA0', TEAL_SUAVE = 'DFF6F6';
const AMARELO = 'FFC839', AMARELO_SUAVE = 'FFF3D6';
const ROSA = 'D93E76';
const TINTA = '1E1E2F', TEXTO = '5C5C72', FRACO = '8E8EA6';
const BRANCO = 'FFFFFF', FUNDO = 'F6F5FB', BORDA = 'E6E6F0';

const pres = new pptxgen();
pres.layout = 'LAYOUT_WIDE';           // 13.3 x 7.5
pres.author = 'Kidoo';
pres.title = 'Kidoo — proposta para parceiros';

const W = 13.3, H = 7.5, M = 0.9;

const sombra = () => ({ type: 'outer', color: '1E1E2F', blur: 14, offset: 3, angle: 90, opacity: 0.08 });

/** Cabeçalho padrão das telas claras. */
function titulo(slide, texto, sub) {
  slide.addText(texto, {
    x: M, y: 0.62, w: W - 2 * M, h: 0.75, isTextBox: true, margin: 0,
    fontFace: 'Calibri', fontSize: 38, bold: true, color: TINTA,
  });
  if (sub) {
    slide.addText(sub, {
      x: M, y: 1.42, w: W - 2 * M - 1.2, h: 0.5, isTextBox: true, margin: 0,
      fontFace: 'Calibri', fontSize: 16, color: TEXTO,
    });
  }
}

/** Marca do Kidoo — quadrado de canto solto com o K. */
function marca(slide, x, y, lado, corFundo, corTexto) {
  slide.addShape(pres.ShapeType.roundRect, {
    x, y, w: lado, h: lado, fill: { color: corFundo }, rectRadius: lado * 0.3, line: { color: corFundo },
  });
  slide.addText('K', {
    x, y, w: lado, h: lado, isTextBox: true, margin: 0, align: 'center', valign: 'middle',
    fontFace: 'Calibri', fontSize: lado * 46, bold: true, color: corTexto,
  });
}

// ============================================================ 1. capa =====
{
  const s = pres.addSlide();
  s.background = { color: TINTA };

  // Blobs da identidade, bem discretos
  s.addShape(pres.ShapeType.ellipse, { x: 10.4, y: -1.5, w: 5.2, h: 5.2, fill: { color: ROXO, transparency: 78 }, line: { color: ROXO, transparency: 100 } });
  s.addShape(pres.ShapeType.ellipse, { x: 11.9, y: 4.6, w: 3.4, h: 3.4, fill: { color: TEAL, transparency: 85 }, line: { color: TEAL, transparency: 100 } });

  marca(s, M, 1.5, 0.95, ROXO, BRANCO);

  s.addText('Kidoo', {
    x: M + 1.25, y: 1.62, w: 4, h: 0.7, isTextBox: true, margin: 0, valign: 'middle',
    fontFace: 'Calibri', fontSize: 30, bold: true, color: BRANCO,
  });

  s.addText('A vaga que hoje fica vazia\npassa a render.', {
    x: M, y: 3.05, w: 10.4, h: 1.7, isTextBox: true, margin: 0,
    fontFace: 'Calibri', fontSize: 44, bold: true, color: BRANCO, lineSpacingMultiple: 1.06,
  });

  s.addText('Proposta para academias, escolinhas e clubes', {
    x: M, y: 5.05, w: 8.5, h: 0.45, isTextBox: true, margin: 0,
    fontFace: 'Calibri', fontSize: 18, color: 'B3B1CC',
  });

  s.addShape(pres.ShapeType.roundRect, {
    x: M, y: 5.95, w: 4.3, h: 0.62, fill: { color: AMARELO }, rectRadius: 0.31, line: { color: AMARELO },
  });
  s.addText('R$ 8,00 por criança que aparece', {
    x: M, y: 5.95, w: 4.3, h: 0.62, isTextBox: true, margin: 0, align: 'center', valign: 'middle',
    fontFace: 'Calibri', fontSize: 14, bold: true, color: TINTA,
  });

  s.addNotes('Abertura. O deck é para o dono do estabelecimento, não para investidor. A promessa central cabe em uma frase: o lugar que sobra na sua turma hoje rende zero; com o Kidoo, rende.');
}

// ================================================== 2. o problema =========
{
  const s = pres.addSlide();
  s.background = { color: BRANCO };
  titulo(s, 'Toda turma tem lugar sobrando', 'E ele já está pago: o professor, a sala e a estrutura custam o mesmo com 11 ou com 16 crianças.');

  // Ilustração: 20 lugares, 11 ocupados
  const cx = M, cy = 2.5, d = 0.42, gap = 0.16;
  for (let i = 0; i < 20; i++) {
    const col = i % 10, lin = Math.floor(i / 10);
    const ocupado = i < 11;
    s.addShape(pres.ShapeType.ellipse, {
      x: cx + col * (d + gap), y: cy + lin * (d + gap), w: d, h: d,
      fill: { color: ocupado ? ROXO : BRANCO },
      line: { color: ocupado ? ROXO : 'D3D3E2', width: 1.5 },
    });
  }
  s.addText('11 matriculados', {
    x: cx, y: cy + 1.35, w: 2.6, h: 0.3, isTextBox: true, margin: 0,
    fontFace: 'Calibri', fontSize: 13, bold: true, color: ROXO,
  });
  s.addText('9 lugares livres', {
    x: cx + 2.7, y: cy + 1.35, w: 2.6, h: 0.3, isTextBox: true, margin: 0,
    fontFace: 'Calibri', fontSize: 13, bold: true, color: FRACO,
  });

  // Callout da receita atual
  s.addShape(pres.ShapeType.roundRect, {
    x: 7.9, y: 2.35, w: 4.5, h: 2.5, fill: { color: FUNDO }, rectRadius: 0.22,
    line: { color: BORDA }, shadow: sombra(),
  });
  s.addText('R$ 0,00', {
    x: 8.25, y: 2.72, w: 3.8, h: 0.95, isTextBox: true, margin: 0,
    fontFace: 'Calibri', fontSize: 54, bold: true, color: ROSA,
  });
  s.addText('é o que esses 9 lugares rendem hoje, aula após aula, semana após semana.', {
    x: 8.25, y: 3.75, w: 3.8, h: 0.9, isTextBox: true, margin: 0,
    fontFace: 'Calibri', fontSize: 14, color: TEXTO,
  });

  s.addText('Não é um problema de vender mais matrícula. Matrícula é compromisso de meses — muita família não assina, mas iria a uma aula.', {
    x: M, y: 5.55, w: 11.5, h: 0.6, isTextBox: true, margin: 0,
    fontFace: 'Calibri', fontSize: 15, color: TEXTO, italic: true,
  });

  s.addNotes('O ponto a fixar: o custo marginal de uma criança a mais numa turma que já vai acontecer é praticamente zero. É a única fonte de margem barata que existe em atividade infantil.');
}

// =============================================== 3. o que é o Kidoo =======
{
  const s = pres.addSlide();
  s.background = { color: BRANCO };
  titulo(s, 'O que é o Kidoo', 'Uma assinatura para famílias que querem variar as atividades dos filhos sem fechar matrícula em cada uma.');

  const itens = [
    { cor: ROXO, fundo: ROXO_SUAVE, t: 'A família assina um plano', d: 'Paga mensalidade ao Kidoo e recebe uma cota semanal de créditos para usar como quiser.' },
    { cor: TEAL, fundo: TEAL_SUAVE, t: 'Escolhe aula por aula', d: 'Abre o app, vê o que tem perto de casa, reserva um horário específico. Sem contrato com você.' },
    { cor: AMARELO, fundo: AMARELO_SUAVE, t: 'Você recebe por presença', d: 'A criança chega, você confirma, e aquela vaga vira receita. Sem presença, não há cobrança.' },
  ];

  itens.forEach((item, i) => {
    const y = 2.35 + i * 1.32;
    s.addShape(pres.ShapeType.ellipse, {
      x: M, y, w: 0.72, h: 0.72, fill: { color: item.fundo }, line: { color: item.fundo },
    });
    s.addText(String(i + 1), {
      x: M, y, w: 0.72, h: 0.72, isTextBox: true, margin: 0, align: 'center', valign: 'middle',
      fontFace: 'Calibri', fontSize: 26, bold: true, color: item.cor,
    });
    s.addText(item.t, {
      x: M + 1.05, y: y - 0.04, w: 9.6, h: 0.38, isTextBox: true, margin: 0,
      fontFace: 'Calibri', fontSize: 20, bold: true, color: TINTA,
    });
    s.addText(item.d, {
      x: M + 1.05, y: y + 0.36, w: 9.6, h: 0.5, isTextBox: true, margin: 0,
      fontFace: 'Calibri', fontSize: 14.5, color: TEXTO,
    });
  });

  s.addText('Para você, é ocupação nova em horário que já existe — não é desconto na sua mensalidade.', {
    x: M, y: 6.35, w: 11.5, h: 0.5, isTextBox: true, margin: 0,
    fontFace: 'Calibri', fontSize: 15, bold: true, color: ROXO,
  });

  s.addNotes('Objeção mais comum: "isso não canibaliza minha matrícula?" A resposta é o público — quem assina o Kidoo é quem não ia fechar matrícula de qualquer jeito. E a vaga ociosa só existe onde já sobra lugar.');
}

// ============================================ 4. quanto rende =============
{
  const s = pres.addSlide();
  s.background = { color: BRANCO };
  titulo(s, 'Quanto isso rende', 'Uma turma semanal de 20 lugares, com 11 matriculados. Você abre 5 vagas para o Kidoo.');

  s.addChart(pres.ChartType.bar, [{
    name: 'Por mês',
    labels: ['2 vagas\npreenchidas', '3 vagas', '4 vagas', '5 vagas'],
    values: [70, 104, 139, 174],
  }], {
    x: M - 0.15, y: 2.25, w: 6.7, h: 3.6,
    barDir: 'col', chartColors: [ROXO],
    showTitle: false, showLegend: false,
    showValue: true, dataLabelPosition: 'outEnd', dataLabelFormatCode: '"R$ "#,##0',
    dataLabelColor: TINTA, dataLabelFontFace: 'Calibri', dataLabelFontSize: 13, dataLabelFontBold: true,
    catAxisLabelColor: TEXTO, catAxisLabelFontFace: 'Calibri', catAxisLabelFontSize: 11,
    valAxisHidden: true, valGridLine: { style: 'none' }, catGridLine: { style: 'none' },
    barGapWidthPct: 55, valAxisMaxVal: 210,
  });

  s.addShape(pres.ShapeType.roundRect, {
    x: 7.9, y: 2.25, w: 4.5, h: 1.65, fill: { color: ROXO_TINTO }, rectRadius: 0.22, line: { color: ROXO_SUAVE },
  });
  s.addText('R$ 8,00', {
    x: 8.25, y: 2.45, w: 3.8, h: 0.72, isTextBox: true, margin: 0,
    fontFace: 'Calibri', fontSize: 40, bold: true, color: ROXO,
  });
  s.addText('por criança que aparece e você confirma', {
    x: 8.25, y: 3.2, w: 3.8, h: 0.5, isTextBox: true, margin: 0,
    fontFace: 'Calibri', fontSize: 13.5, color: TEXTO,
  });

  s.addShape(pres.ShapeType.roundRect, {
    x: 7.9, y: 4.2, w: 4.5, h: 1.65, fill: { color: FUNDO }, rectRadius: 0.22, line: { color: BORDA },
  });
  s.addText('3 turmas assim', {
    x: 8.25, y: 4.4, w: 3.8, h: 0.35, isTextBox: true, margin: 0,
    fontFace: 'Calibri', fontSize: 14, bold: true, color: TINTA,
  });
  s.addText('R$ 522 por mês', {
    x: 8.25, y: 4.78, w: 3.8, h: 0.55, isTextBox: true, margin: 0,
    fontFace: 'Calibri', fontSize: 26, bold: true, color: TEAL,
  });
  s.addText('de lugares que hoje ficam vazios', {
    x: 8.25, y: 5.32, w: 3.8, h: 0.35, isTextBox: true, margin: 0,
    fontFace: 'Calibri', fontSize: 12.5, color: FRACO,
  });

  s.addText('Turma que só acontece por causa do Kidoo é outro produto, e vale R$ 18,00 por presença.', {
    x: M, y: 6.25, w: 11.5, h: 0.5, isTextBox: true, margin: 0,
    fontFace: 'Calibri', fontSize: 14, color: TEXTO,
  });

  s.addNotes('Base do cálculo: R$ 8 por presença, 4,35 semanas por mês. 5 vagas x R$ 8 x 4,35 = R$ 174. Números de vaga ociosa; a vaga cheia (turma aberta só por nossa causa) vale R$ 18.');
}

// ============================================= 5. você decide =============
{
  const s = pres.addSlide();
  s.background = { color: BRANCO };
  titulo(s, 'Você controla a torneira', 'Nada entra na sua agenda sem você abrir. E dá para fechar a qualquer momento.');

  const cards = [
    { t: 'Quais turmas', d: 'Só as que você publicar aparecem no app. As outras nem existem para as famílias.', cor: ROXO, fundo: ROXO_SUAVE },
    { t: 'Quantos lugares', d: 'Você define quantas vagas de cada turma vão para o Kidoo — 2, 5, ou nenhuma nesta semana.', cor: TEAL, fundo: TEAL_SUAVE },
    { t: 'Até quando', d: 'Encheu a turma de matriculados? Reduz as vagas e para de receber reservas na hora.', cor: ROSA, fundo: 'FFE9F1' },
  ];

  cards.forEach((c, i) => {
    const x = M + i * 3.95;
    s.addShape(pres.ShapeType.roundRect, {
      x, y: 2.4, w: 3.6, h: 2.75, fill: { color: BRANCO }, rectRadius: 0.24,
      line: { color: BORDA }, shadow: sombra(),
    });
    s.addShape(pres.ShapeType.ellipse, {
      x: x + 0.35, y: 2.75, w: 0.62, h: 0.62, fill: { color: c.fundo }, line: { color: c.fundo },
    });
    s.addShape(pres.ShapeType.ellipse, {
      x: x + 0.55, y: 2.95, w: 0.22, h: 0.22, fill: { color: c.cor }, line: { color: c.cor },
    });
    s.addText(c.t, {
      x: x + 0.35, y: 3.55, w: 2.9, h: 0.4, isTextBox: true, margin: 0,
      fontFace: 'Calibri', fontSize: 19, bold: true, color: TINTA,
    });
    s.addText(c.d, {
      x: x + 0.35, y: 4.0, w: 2.9, h: 1.0, isTextBox: true, margin: 0,
      fontFace: 'Calibri', fontSize: 13.5, color: TEXTO,
    });
  });

  s.addShape(pres.ShapeType.roundRect, {
    x: M, y: 5.6, w: 11.5, h: 1.0, fill: { color: AMARELO_SUAVE }, rectRadius: 0.2, line: { color: AMARELO_SUAVE },
  });
  s.addText('Sem exclusividade, sem mensalidade, sem multa. Se não valer a pena, você fecha as vagas e pronto.', {
    x: M + 0.35, y: 5.6, w: 10.8, h: 1.0, isTextBox: true, margin: 0, valign: 'middle',
    fontFace: 'Calibri', fontSize: 15.5, bold: true, color: TINTA,
  });

  s.addNotes('Esta é a resposta para o medo real do parceiro: perder controle da própria agenda. Nada é automático, nada é permanente.');
}

// ======================================= 6. presença confirmada ===========
{
  const s = pres.addSlide();
  s.background = { color: BRANCO };
  titulo(s, 'Você só recebe pelo que confirmou', 'Nenhuma cobrança acontece por conta própria. Quem diz que a criança veio é você.');

  const passos = [
    { n: 'A família reserva', d: 'Escolhe a turma no app e gasta os créditos da semana dela.' },
    { n: 'A criança chega', d: 'O app confere a localização e gera um código de 6 dígitos, que vale 30 minutos.' },
    { n: 'Você lê o código', d: 'Na recepção, digita os 6 dígitos no painel. É isso que registra a presença.' },
    { n: 'A presença vira repasse', d: 'Só o que você confirmou entra no extrato. O resto não conta.' },
  ];

  passos.forEach((p, i) => {
    const y = 2.35 + i * 1.05;
    s.addShape(pres.ShapeType.roundRect, {
      x: M, y, w: 0.62, h: 0.62, fill: { color: i === 2 ? ROXO : ROXO_SUAVE }, rectRadius: 0.19,
      line: { color: i === 2 ? ROXO : ROXO_SUAVE },
    });
    s.addText(String(i + 1), {
      x: M, y, w: 0.62, h: 0.62, isTextBox: true, margin: 0, align: 'center', valign: 'middle',
      fontFace: 'Calibri', fontSize: 21, bold: true, color: i === 2 ? BRANCO : ROXO,
    });
    s.addText(p.n, {
      x: M + 0.95, y: y - 0.02, w: 2.5, h: 0.35, isTextBox: true, margin: 0,
      fontFace: 'Calibri', fontSize: 17, bold: true, color: TINTA,
    });
    s.addText(p.d, {
      x: M + 3.85, y: y - 0.02, w: 7.55, h: 0.62, isTextBox: true, margin: 0,
      fontFace: 'Calibri', fontSize: 14, color: TEXTO,
    });
  });

  s.addText('Sem o código, não há repasse — e isso protege os dois lados: você não paga por quem não veio, e nós não cobramos por aula que não aconteceu.', {
    x: M, y: 6.5, w: 11.5, h: 0.55, isTextBox: true, margin: 0,
    fontFace: 'Calibri', fontSize: 14.5, italic: true, color: ROXO,
  });

  s.addNotes('Ponto de confiança. Muitos parceiros já foram queimados por plataforma que cobra por "check-in" que ninguém viu acontecer. Aqui a presença é ativa, feita por eles.');
}

// ============================================== 7. o painel ===============
{
  const s = pres.addSlide();
  s.background = { color: BRANCO };
  titulo(s, 'Um painel, três telas', 'Abre no navegador do computador da recepção. Não precisa instalar nada.');

  const telas = [
    { t: 'Hoje', d: 'Quem vem em cada turma, quem já chegou e o campo do código. É a tela aberta durante a aula.' },
    { t: 'Turmas e vagas', d: 'Publica horário, define quantos lugares abrir e fecha quando quiser. Tudo em uma linha por turma.' },
    { t: 'Repasse', d: 'Quanto o Kidoo te deve, por mês e por tipo de vaga. Só entra o que você confirmou.' },
  ];

  telas.forEach((tela, i) => {
    const x = M + i * 3.95;
    s.addShape(pres.ShapeType.roundRect, {
      x, y: 2.4, w: 3.6, h: 3.3, fill: { color: FUNDO }, rectRadius: 0.24, line: { color: BORDA },
    });
    // Miniatura abstrata da tela
    s.addShape(pres.ShapeType.roundRect, {
      x: x + 0.35, y: 2.75, w: 2.9, h: 1.0, fill: { color: BRANCO }, rectRadius: 0.12, line: { color: BORDA },
    });
    for (let l = 0; l < 3; l++) {
      s.addShape(pres.ShapeType.roundRect, {
        x: x + 0.55, y: 2.95 + l * 0.24, w: l === 0 ? 1.9 : 2.4, h: 0.11,
        fill: { color: l === 0 ? ROXO : 'D3D3E2' }, rectRadius: 0.055,
        line: { color: l === 0 ? ROXO : 'D3D3E2' },
      });
    }
    s.addText(tela.t, {
      x: x + 0.35, y: 3.95, w: 2.9, h: 0.4, isTextBox: true, margin: 0,
      fontFace: 'Calibri', fontSize: 19, bold: true, color: ROXO,
    });
    s.addText(tela.d, {
      x: x + 0.35, y: 4.4, w: 2.9, h: 1.2, isTextBox: true, margin: 0, valign: 'top',
      fontFace: 'Calibri', fontSize: 13, color: TEXTO,
    });
  });

  s.addText('Treinamento da recepção: cinco minutos. A operação inteira é digitar seis números.', {
    x: M, y: 5.95, w: 11.5, h: 0.5, isTextBox: true, margin: 0,
    fontFace: 'Calibri', fontSize: 15, bold: true, color: TINTA,
  });

  s.addNotes('Objeção prática: "minha recepcionista não vai aprender mais um sistema". Por isso a operação diária é uma tela só e um campo de seis dígitos.');
}

// ========================================== 8. próximos passos ============
{
  const s = pres.addSlide();
  s.background = { color: TINTA };
  s.addShape(pres.ShapeType.ellipse, { x: -2.2, y: 5.9, w: 4.6, h: 4.6, fill: { color: ROXO, transparency: 80 }, line: { color: ROXO, transparency: 100 } });

  s.addText('Como começar', {
    x: M, y: 0.85, w: 8, h: 0.8, isTextBox: true, margin: 0,
    fontFace: 'Calibri', fontSize: 40, bold: true, color: BRANCO,
  });
  s.addText('Sem contrato de exclusividade e sem custo para entrar.', {
    x: M, y: 1.68, w: 8, h: 0.45, isTextBox: true, margin: 0,
    fontFace: 'Calibri', fontSize: 17, color: 'B3B1CC',
  });

  const passos = [
    ['Uma conversa de 20 minutos', 'Entendemos suas turmas e quais horários têm lugar sobrando.'],
    ['Publicamos as primeiras vagas', 'Começando pequeno: uma ou duas turmas, as que mais sobram.'],
    ['Um mês de teste', 'Você vê o extrato real antes de decidir qualquer coisa.'],
  ];

  passos.forEach((p, i) => {
    const y = 2.75 + i * 1.15;
    s.addShape(pres.ShapeType.roundRect, {
      x: M, y, w: 0.58, h: 0.58, fill: { color: AMARELO }, rectRadius: 0.18, line: { color: AMARELO },
    });
    s.addText(String(i + 1), {
      x: M, y, w: 0.58, h: 0.58, isTextBox: true, margin: 0, align: 'center', valign: 'middle',
      fontFace: 'Calibri', fontSize: 20, bold: true, color: TINTA,
    });
    s.addText(p[0], {
      x: M + 0.9, y: y - 0.03, w: 7.6, h: 0.35, isTextBox: true, margin: 0,
      fontFace: 'Calibri', fontSize: 19, bold: true, color: BRANCO,
    });
    s.addText(p[1], {
      x: M + 0.9, y: y + 0.35, w: 7.6, h: 0.4, isTextBox: true, margin: 0,
      fontFace: 'Calibri', fontSize: 14, color: 'B3B1CC',
    });
  });

  marca(s, 10.6, 2.9, 1.5, ROXO, BRANCO);
  s.addText('Kidoo', {
    x: 10.0, y: 4.55, w: 2.7, h: 0.45, isTextBox: true, margin: 0, align: 'center',
    fontFace: 'Calibri', fontSize: 22, bold: true, color: BRANCO,
  });
  s.addText('atividades para crianças', {
    x: 10.0, y: 4.98, w: 2.7, h: 0.35, isTextBox: true, margin: 0, align: 'center',
    fontFace: 'Calibri', fontSize: 12, color: FRACO,
  });

  s.addNotes('Fechamento. O pedido é pequeno de propósito: uma conversa e uma turma. O extrato do primeiro mês é o argumento, não o slide.');
}

pres.writeFile({ fileName: 'Kidoo-proposta-parceiros.pptx' }).then(() => console.log('deck gerado'));
