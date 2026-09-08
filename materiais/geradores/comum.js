const d = require('docx');
const {
  Paragraph, TextRun, Table, TableRow, TableCell, WidthType, ShadingType,
  BorderStyle, AlignmentType, convertInchesToTwip,
} = d;

// Paleta da marca — a mesma de src/theme/palettes.ts.
const ROXO = '6A3FC6', ROXO_SUAVE = 'EFE9FB', ROXO_TINTO = 'F7F4FE';
const TINTA = '1E1E2F', TEXTO = '4A4A5F', FRACO = '8E8EA6';
const BORDA = 'D9D9E6', FUNDO = 'F6F5FB', AMARELO_SUAVE = 'FFF3D6';

const FONTE = 'Calibri';
const LARGURA = 9746; // A4 (11906) menos 2 x 1080 de margem
const SEM_BORDA = { top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                    bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                    left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                    right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                    insideHorizontal: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                    insideVertical: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' } };

const txt = (t, o = {}) => new TextRun({ text: t, font: FONTE, size: (o.size ?? 10.5) * 2,
  bold: o.bold, italics: o.italics, color: o.color ?? TEXTO });

/** Parágrafo de texto corrido. */
function p(t, o = {}) {
  return new Paragraph({
    alignment: o.align,
    spacing: { before: (o.before ?? 0) * 20, after: (o.after ?? 6) * 20, line: 264 },
    indent: o.indent ? { left: o.indent } : undefined,
    children: Array.isArray(t) ? t : [txt(t, o)],
  });
}

/** Cabeçalho da marca: quadrado roxo com o K e o nome ao lado. */
function marca(subtitulo) {
  return new Table({
    width: { size: LARGURA, type: WidthType.DXA },
    columnWidths: [520, 9226],
    borders: SEM_BORDA,
    rows: [new TableRow({ children: [
      new TableCell({
        width: { size: 520, type: WidthType.DXA },
        shading: { type: ShadingType.CLEAR, fill: ROXO, color: 'auto' },
        margins: { top: 60, bottom: 60, left: 0, right: 0 },
        verticalAlign: 'center',
        children: [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 0 },
          children: [new TextRun({ text: 'K', font: FONTE, size: 26, bold: true, color: 'FFFFFF' })] })],
      }),
      new TableCell({
        width: { size: 9226, type: WidthType.DXA },
        margins: { left: 180 },
        verticalAlign: 'center',
        children: [
          new Paragraph({ spacing: { after: 0 }, children: [
            new TextRun({ text: 'Kidoo', font: FONTE, size: 26, bold: true, color: TINTA }),
            new TextRun({ text: '   ' + subtitulo, font: FONTE, size: 20, color: FRACO }),
          ] }),
        ],
      }),
    ] })],
  });
}

/** Título do documento. */
function titulo(t, sub) {
  return [
    new Paragraph({ spacing: { before: 320, after: 60 }, children: [
      new TextRun({ text: t, font: FONTE, size: 44, bold: true, color: TINTA })] }),
    p(sub, { size: 11, color: TEXTO, after: 14 }),
  ];
}

/** Cabeçalho de seção: número em roxo, nome em preto, filete embaixo. */
function secao(n, t) {
  const cabeca = [];
  if (n != null) cabeca.push(new TextRun({ text: String(n).padStart(2, '0') + '   ', font: FONTE, size: 24, bold: true, color: ROXO }));
  return new Paragraph({
    spacing: { before: 300, after: 140 },
    keepNext: true,
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: ROXO_SUAVE, space: 6 } },
    children: [
      ...cabeca,
      new TextRun({ text: t.toUpperCase(), font: FONTE, size: 22, bold: true, color: TINTA,
        characterSpacing: 20 }),
    ],
  });
}

/** Enunciado da pergunta. */
function pergunta(n, t, nota) {
  const filhos = [
    new TextRun({ text: n + '. ', font: FONTE, size: 21, bold: true, color: ROXO }),
    new TextRun({ text: t, font: FONTE, size: 21, bold: true, color: TINTA }),
  ];
  if (nota) filhos.push(new TextRun({ text: '  ' + nota, font: FONTE, size: 18, italics: true, color: FRACO }));
  return new Paragraph({ spacing: { before: 200, after: 60 }, keepNext: true, keepLines: true, children: filhos });
}

/** Alternativas. `col` distribui em colunas para não esticar a página. */
function opcoes(lista, col = 1) {
  if (col === 1) {
    return lista.map((o, i) => new Paragraph({
      spacing: { after: 40 }, indent: { left: 260 },
      keepNext: i < lista.length - 1, keepLines: true,
      children: [new TextRun({ text: '(     )  ' + o, font: FONTE, size: 21, color: TEXTO })],
    }));
  }
  const linhas = [];
  const larg = Math.floor((LARGURA - 260) / col);
  for (let i = 0; i < lista.length; i += col) {
    const celulas = [];
    for (let j = 0; j < col; j++) {
      const o = lista[i + j];
      celulas.push(new TableCell({
        width: { size: larg, type: WidthType.DXA },
        margins: { top: 20, bottom: 20, left: 0, right: 120 },
        children: [new Paragraph({ spacing: { after: 0 }, children: [
          new TextRun({ text: o ? '(     )  ' + o : '', font: FONTE, size: 21, color: TEXTO })] })],
      }));
    }
    linhas.push(new TableRow({ cantSplit: true, children: celulas }));
  }
  return [new Table({
    width: { size: LARGURA - 260, type: WidthType.DXA },
    columnWidths: new Array(col).fill(larg),
    indent: { size: 260, type: WidthType.DXA },
    borders: SEM_BORDA,
    rows: linhas,
  })];
}

/** Escala numérica com âncoras nas pontas. */
function escala(de, ate, ancoraEsq, ancoraDir) {
  const n = ate - de + 1;
  const larg = Math.floor((LARGURA - 260) / n);
  const numeros = [];
  for (let i = de; i <= ate; i++) {
    numeros.push(new TableCell({
      width: { size: larg, type: WidthType.DXA },
      shading: { type: ShadingType.CLEAR, fill: ROXO_TINTO, color: 'auto' },
      margins: { top: 90, bottom: 90, left: 0, right: 0 },
      borders: { top: { style: BorderStyle.SINGLE, size: 4, color: 'FFFFFF' },
                 bottom: { style: BorderStyle.SINGLE, size: 4, color: 'FFFFFF' },
                 left: { style: BorderStyle.SINGLE, size: 4, color: 'FFFFFF' },
                 right: { style: BorderStyle.SINGLE, size: 4, color: 'FFFFFF' } },
      children: [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 0 },
        children: [new TextRun({ text: String(i), font: FONTE, size: 21, bold: true, color: ROXO })] })],
    }));
  }
  return [
    new Table({
      width: { size: LARGURA - 260, type: WidthType.DXA },
      columnWidths: new Array(n).fill(larg),
      indent: { size: 260, type: WidthType.DXA },
      rows: [new TableRow({ cantSplit: true, children: numeros })],
    }),
    new Table({
      width: { size: LARGURA - 260, type: WidthType.DXA },
      columnWidths: [Math.floor((LARGURA - 260) / 2), Math.ceil((LARGURA - 260) / 2)],
      borders: SEM_BORDA,
      indent: { size: 260, type: WidthType.DXA },
      rows: [new TableRow({ children: [
        new TableCell({ width: { size: Math.floor((LARGURA - 260) / 2), type: WidthType.DXA },
          margins: { top: 40 },
          children: [new Paragraph({ spacing: { after: 0 }, children: [
            new TextRun({ text: ancoraEsq, font: FONTE, size: 17, italics: true, color: FRACO })] })] }),
        new TableCell({ width: { size: Math.ceil((LARGURA - 260) / 2), type: WidthType.DXA },
          margins: { top: 40 },
          children: [new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { after: 0 }, children: [
            new TextRun({ text: ancoraDir, font: FONTE, size: 17, italics: true, color: FRACO })] })] }),
      ] })],
    }),
  ];
}

/**
 * Linhas em branco para resposta aberta.
 *
 * Feitas de tabela, e não de parágrafos com borda inferior: o Word e o
 * LibreOffice fundem parágrafos vizinhos que têm a MESMA borda num quadro só,
 * e três linhas de resposta apareciam como uma. Linha de tabela não funde.
 */
function linhas(quantas = 3, rotulos = []) {
  const larg = LARGURA - 260;
  const rows = [];
  for (let i = 0; i < quantas; i++) {
    rows.push(new TableRow({
      cantSplit: true,
      height: { value: 380, rule: 'atLeast' },
      children: [new TableCell({
        width: { size: larg, type: WidthType.DXA },
        margins: { top: 0, bottom: 0, left: 0, right: 0 },
        verticalAlign: 'bottom',
        borders: {
          top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
          left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
          right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
          bottom: { style: BorderStyle.SINGLE, size: 4, color: BORDA },
        },
        children: [new Paragraph({ spacing: { after: 0 }, children: [
          new TextRun({ text: rotulos[i] ?? '', font: FONTE, size: 21, color: TEXTO })] })],
      })],
    }));
  }
  return [
    new Table({
      width: { size: larg, type: WidthType.DXA },
      columnWidths: [larg],
      indent: { size: 260, type: WidthType.DXA },
      rows,
    }),
    new Paragraph({ spacing: { after: 120 }, children: [] }),
  ];
}

/** Campo de uma linha com rótulo, para dado curto (nome, bairro, valor). */
function campo(rotulo) {
  return linhas(1, [rotulo ? rotulo + '  ' : '']);
}

/** Caixa destacada — abertura, aviso, nota para quem aplica. */
function caixa(linhasTexto, cor = FUNDO) {
  return new Table({
    width: { size: LARGURA, type: WidthType.DXA },
    columnWidths: [LARGURA],
    borders: SEM_BORDA,
    rows: [new TableRow({ children: [new TableCell({
      width: { size: LARGURA, type: WidthType.DXA },
      shading: { type: ShadingType.CLEAR, fill: cor, color: 'auto' },
      margins: { top: 200, bottom: 200, left: 240, right: 240 },
      children: linhasTexto,
    })] })],
  });
}

const vazio = (alt = 8) => new Paragraph({ spacing: { after: alt * 20 }, children: [] });

module.exports = {
  d, ROXO, ROXO_SUAVE, ROXO_TINTO, TINTA, TEXTO, FRACO, BORDA, FUNDO, AMARELO_SUAVE,
  FONTE, LARGURA, SEM_BORDA, txt, p, marca, titulo, secao, pergunta, opcoes, escala,
  linhas, campo, caixa, vazio,
};
