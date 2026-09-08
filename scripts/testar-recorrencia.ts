/**
 * As datas da turma que se repete.
 *
 * Roda com `npm run test:recorrencia`. Fixa o "agora" de propósito: um cálculo
 * de datas testado com a data de hoje passa numa segunda e falha num domingo,
 * e ninguém descobre até o parceiro publicar oito semanas erradas.
 */
import {
  DIAS_CURTOS,
  LIMITE_DA_SERIE,
  datasDaSerie,
  resumoDaSerie,
} from '../partner/src/recorrencia';

const falhas: string[] = [];
const ok = (cond: boolean, msg: string) => {
  console.log((cond ? '  OK   ' : '  FALHA ') + msg);
  if (!cond) falhas.push(msg);
};

// Segunda-feira, 9 de março de 2026, meio-dia.
const AGORA = new Date(2026, 2, 9, 12, 0, 0, 0);
const SEG = 1;
const TER = 2;
const QUI = 4;

// ---- o caso que o parceiro pede -------------------------------------------
const terQui = datasDaSerie({ diasDaSemana: [TER, QUI], hora: '18:00', semanas: 8 }, AGORA);
ok(terQui.length === 16, 'terça e quinta por 8 semanas dá 16 turmas');
ok(terQui.every((d) => d.getDay() === TER || d.getDay() === QUI),
   'e nenhuma cai num dia que ele não pediu');
ok(terQui.every((d) => d.getHours() === 18 && d.getMinutes() === 0),
   'todas às 18h em ponto, no relógio do balcão');

const tempos = terQui.map((d) => d.getTime());
ok(tempos.every((t, i) => i === 0 || t > tempos[i - 1]!), 'as datas vêm em ordem');
ok(new Set(tempos).size === tempos.length, 'e nenhuma se repete');

// ---- a aula de hoje que já passou ------------------------------------------
// São 12h de uma segunda: a segunda das 9h já foi, a das 18h ainda não.
const cedo = datasDaSerie({ diasDaSemana: [SEG], hora: '09:00', semanas: 4 }, AGORA);
const tarde = datasDaSerie({ diasDaSemana: [SEG], hora: '18:00', semanas: 4 }, AGORA);
ok(cedo.length === 3, 'a segunda de hoje às 9h já passou: sobram 3');
ok(cedo.every((d) => d.getTime() > AGORA.getTime()), 'e nenhuma data no passado escapa');
ok(tarde.length === 4, 'a segunda de hoje às 18h ainda cabe: são 4');
ok(tarde[0]!.getDate() === 9, 'e a primeira é hoje mesmo');

// ---- a janela de dias corridos ---------------------------------------------
// 56 dias corridos = 8 de cada dia da semana. É o que sustenta contar dias em
// vez de procurar "as próximas 8 terças".
for (let dia = 0; dia < 7; dia += 1) {
  const datas = datasDaSerie({ diasDaSemana: [dia], hora: '23:59', semanas: 8 }, AGORA);
  ok(datas.length === 8, `${DIAS_CURTOS[dia]} cai 8 vezes em 8 semanas`);
}

// ---- o teto ----------------------------------------------------------------
const semanaInteira = datasDaSerie(
  { diasDaSemana: [0, 1, 2, 3, 4, 5, 6], hora: '23:59', semanas: 12 },
  AGORA,
);
ok(semanaInteira.length === 84, 'a semana inteira por 12 semanas dá 84 turmas');
ok(semanaInteira.length > LIMITE_DA_SERIE, 'e a tela precisa barrar antes de mandar ao banco');

// ---- pedidos que não geram nada --------------------------------------------
ok(datasDaSerie({ diasDaSemana: [], hora: '18:00', semanas: 8 }, AGORA).length === 0,
   'sem dia marcado não há série');
ok(datasDaSerie({ diasDaSemana: [TER], hora: '18:00', semanas: 0 }, AGORA).length === 0,
   'sem semana não há série');
ok(datasDaSerie({ diasDaSemana: [TER], hora: '', semanas: 8 }, AGORA).length === 0,
   'campo de hora vazio não vira meia-noite escondida');
ok(datasDaSerie({ diasDaSemana: [TER], hora: 'seis da tarde', semanas: 8 }, AGORA).length === 0,
   'hora que não é hora também não');

// ---- o resumo que ele confere antes de clicar -------------------------------
ok(resumoDaSerie(terQui) === 'ter, 10/03 · qui, 12/03 · ter, 17/03 · +13',
   'o resumo mostra as três primeiras e conta o resto');
ok(resumoDaSerie(terQui.slice(0, 2)) === 'ter, 10/03 · qui, 12/03',
   'com poucas datas, não sobra "+0"');
ok(resumoDaSerie([]) === '', 'e sem datas o resumo é vazio');

console.log(falhas.length ? `\n>>> ${falhas.length} FALHA(S)` : '\n>>> recorrência ok');
process.exit(falhas.length ? 1 : 0);
