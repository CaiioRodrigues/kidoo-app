/**
 * Os documentos que o cadastro pede para a família aceitar.
 *
 * Eles moram aqui, como dado, porque precisam existir em dois lugares: nas
 * telas do app e numa URL da web — a loja exige URL, não tela. Escrever o
 * texto duas vezes é como as duas versões passam a divergir, e divergir aqui
 * significa a família ter aceitado uma coisa e a loja publicar outra.
 *
 * O conteúdo é derivado do que o sistema FAZ, não de um modelo genérico. Cada
 * afirmação sobre dado corresponde a uma coluna, uma policy ou uma função
 * deste repositório, e está anotada ao lado quando não é óbvio. Um documento
 * que promete mais do que o código entrega é pior que documento nenhum: vira
 * prova contra quem o publicou.
 *
 * ATENÇÃO — os marcadores `[…]` são dados da empresa que o código não tem
 * como saber (razão social, CNPJ, endereço). Eles precisam ser preenchidos
 * antes de publicar, e `npm run test:documentos` falha enquanto existirem.
 */

export type Bloco = { tipo: 'p'; texto: string } | { tipo: 'lista'; itens: string[] };

export type Secao = { titulo: string; blocos: Bloco[] };

export type Documento = {
  /** Vira o `<h1>` na web e o título da tela no app. */
  titulo: string;
  /** Data da última mudança de conteúdo, no formato brasileiro. */
  atualizadoEm: string;
  /** Uma frase, antes das seções: o que este documento é. */
  resumo: string;
  secoes: Secao[];
};

const p = (texto: string): Bloco => ({ tipo: 'p', texto });
const lista = (...itens: string[]): Bloco => ({ tipo: 'lista', itens });

/** O e-mail que atende os pedidos de LGPD. Precisa existir de verdade. */
export const EMAIL_PRIVACIDADE = 'privacidade@sejakidoo.com.br';

export const PRIVACIDADE: Documento = {
  titulo: 'Política de Privacidade',
  atualizadoEm: '22/09/2026',
  resumo:
    'O Kidoo guarda dados de crianças. Esta página diz exatamente quais, quem consegue ' +
    'vê-los, por quanto tempo ficam e como apagá-los.',
  secoes: [
    {
      titulo: 'Quem é o responsável pelos dados',
      blocos: [
        p(
          'O controlador dos dados é […razão social…], inscrita no CNPJ […], com sede em […]. ' +
            `Para qualquer pedido sobre dados pessoais, incluindo os previstos na LGPD, escreva para ${EMAIL_PRIVACIDADE}.`,
        ),
      ],
    },
    {
      titulo: 'O que coletamos do responsável',
      blocos: [
        lista(
          'Nome e e-mail — para criar a conta e falar com você.',
          'Cidade — para mostrar atividades perto de você.',
          'Telefone, se você informar — usado só se precisarmos falar sobre uma reserva.',
          'Foto de perfil, se você enviar — aparece apenas para você, dentro do app.',
        ),
      ],
    },
    {
      titulo: 'O que coletamos da criança',
      blocos: [
        p(
          'Estes dados são fornecidos por você, responsável, e existem para um fim só: ' +
            'sugerir atividades adequadas à idade e registrar a presença nas aulas.',
        ),
        lista(
          'Nome e data de nascimento — a idade decide quais turmas aparecem, porque toda turma tem faixa etária.',
          'Gênero, se você informar — usado apenas para o app falar com a criança na concordância certa ("Jornada da Alice"). É opcional e pode ficar em branco.',
          'Foto, se você enviar — fica em armazenamento privado e é exibida só para você.',
          'Interesses (as modalidades) — para as recomendações.',
          'Histórico de aulas, XP e conquistas — a Jornada dentro do app.',
        ),
      ],
    },
    {
      titulo: 'Localização',
      blocos: [
        p(
          'O app pede sua localização em dois momentos, e só a partir de um toque seu: no ' +
            'filtro "Perto de mim" e no check-in da aula.',
        ),
        // `confirm_checkin` grava `jsonb_build_object('locationVerified', …,
        // 'distanceM', …, 'mocked', …)`. Não há latitude nem longitude ali.
        p(
          'A distância é calculada dentro do aparelho. O que o servidor guarda do check-in é ' +
            'a distância em metros até o estabelecimento e se a leitura foi confiável — ' +
            'nunca onde você ou a criança estavam. Não há histórico de localização.',
        ),
      ],
    },
    {
      titulo: 'Quem consegue ver o quê',
      blocos: [
        p(
          'Esta é a parte que mais importa quando o dado é de criança, e é garantida pelo ' +
            'banco de dados, não por disciplina de quem programa: cada tabela tem regras que ' +
            'o servidor aplica a toda consulta.',
        ),
        lista(
          'O estabelecimento onde a aula acontece vê, da sua turma daquele dia, o PRIMEIRO NOME e a IDADE da criança. Não vê sobrenome, foto, e-mail, telefone, nem qualquer aula em outro lugar.',
          'Outras famílias não veem nada sobre você ou sua criança.',
          'As avaliações que você escreve são públicas, com o nome que você escolher ao escrevê-la. O vínculo entre a avaliação e a sua conta fica no servidor e não é entregue a ninguém.',
          'As fotos ficam em armazenamento privado e são abertas por um link temporário, válido por uma hora, gerado para você.',
          'A equipe do Kidoo acessa dados para operar o serviço e analisar cadastros de estabelecimentos.',
        ),
      ],
    },
    {
      titulo: 'Onde os dados ficam e quem mais os processa',
      blocos: [
        p(
          'Os dados ficam no Supabase, em servidores na região de São Paulo, no Brasil. ' +
            'Além dele, três serviços processam partes específicas:',
        ),
        lista(
          'Expo e Google Firebase Cloud Messaging — entregam as notificações de vaga. Recebem o identificador do aparelho e o texto do aviso.',
          'Resend — entrega os e-mails do serviço. Recebe o endereço de destino e o conteúdo da mensagem.',
          'Google Play e App Store — distribuem o aplicativo, conforme as políticas de cada uma.',
        ),
        p(
          'Não vendemos dados. Não há publicidade de terceiros nem rastreamento entre aplicativos.',
        ),
      ],
    },
    {
      titulo: 'Por quanto tempo guardamos',
      blocos: [
        p(
          'Enquanto a conta existir. Quando você pede a exclusão, apagamos os dados que ' +
            'identificam você e sua criança.',
        ),
        p(
          'Uma parte não é apagada, e é justo você saber por quê: as aulas que geraram ' +
            'pagamento a um estabelecimento são registro financeiro, e a lei exige guardá-lo. ' +
            'Essas linhas continuam existindo sem nome, sem foto e sem data de nascimento — ' +
            'não é mais possível ligá-las a uma pessoa.',
        ),
      ],
    },
    {
      titulo: 'Seus direitos, e como exercê-los',
      blocos: [
        p(
          'A LGPD te dá direito a confirmar o tratamento, acessar, corrigir, anonimizar, ' +
            'portar e eliminar os dados, além de revogar o consentimento.',
        ),
        p(
          'No app, em Perfil, existe o botão "Excluir minha conta e os dados da minha ' +
            'criança". Ele faz a exclusão na hora, sem precisar falar com ninguém.',
        ),
        p(`Para qualquer outro pedido, escreva para ${EMAIL_PRIVACIDADE}.`),
      ],
    },
    {
      titulo: 'Dados de criança e adolescente',
      blocos: [
        p(
          'O Kidoo trata dados de menores de idade com o consentimento específico e em ' +
            'destaque de um dos pais ou do responsável legal, na forma do art. 14 da LGPD. ' +
            'Esse consentimento é dado no cadastro e pode ser revogado a qualquer momento ' +
            'pela exclusão da conta.',
        ),
        p(
          'Não pedimos da criança nenhum dado além do necessário para as atividades, e não ' +
            'condicionamos o uso do app ao fornecimento de dados extras.',
        ),
      ],
    },
    {
      titulo: 'Mudanças nesta política',
      blocos: [
        p(
          'Se mudarmos algo que afete como tratamos os dados, avisaremos pelo app e pelo ' +
            'e-mail cadastrado antes da mudança valer. A data no topo diz quando esta versão ' +
            'passou a valer.',
        ),
      ],
    },
  ],
};

export const TERMOS: Documento = {
  titulo: 'Termos de Uso',
  atualizadoEm: '22/09/2026',
  resumo:
    'As regras de uso do Kidoo: o que a assinatura dá, como funcionam as reservas e o ' +
    'cancelamento, e de quem é a responsabilidade por cada parte.',
  secoes: [
    {
      titulo: 'O que é o Kidoo',
      blocos: [
        p(
          'O Kidoo é um clube de atividades para crianças. A família assina um plano e recebe ' +
            'uma cota semanal de Kidoo Coins, que usa para reservar aulas avulsas em ' +
            'estabelecimentos parceiros.',
        ),
        p(
          'O Kidoo intermedeia a reserva. Quem dá a aula, define o conteúdo e responde pela ' +
            'segurança do espaço é o estabelecimento parceiro.',
        ),
      ],
    },
    {
      titulo: 'Conta e idade',
      blocos: [
        p(
          'A conta é criada por um adulto responsável pela criança. Os dados que você informa ' +
            'precisam ser verdadeiros, e a data de nascimento decide quais turmas aparecem — ' +
            'informá-la errado coloca a criança numa turma que não é para ela.',
        ),
        p('Você é responsável por manter a senha em segurança.'),
      ],
    },
    {
      titulo: 'Assinatura e coins',
      blocos: [
        lista(
          'A cota de coins volta ao valor cheio toda semana. Coin não usado não acumula para a semana seguinte.',
          'Moedas bônus, ganhas ao subir de nível, têm validade própria e são gastas antes da cota semanal.',
          'Escolher um plano não libera as reservas: elas liberam quando o pagamento é confirmado.',
          'Trocar de plano no meio da semana não devolve o que já foi gasto.',
        ),
      ],
    },
    {
      titulo: 'Reservas, cancelamento e falta',
      blocos: [
        p(
          'Cada reserva ocupa um lugar físico numa turma que vai acontecer. Por isso o ' +
            'cancelamento tem prazo, e ele é o mesmo para todo mundo:',
        ),
        lista(
          'Cancelando com mais de 5 horas de antecedência, o coin volta para a sua cota e a vaga é liberada.',
          'Cancelando com menos de 5 horas, o coin não volta e a vaga continua sua — o lugar foi comprado.',
          'Não comparecendo sem cancelar, o coin também não volta.',
        ),
        p(
          'Nos dois últimos casos o estabelecimento recebe pelo lugar que segurou. É por isso ' +
            'que avisar cedo importa: a vaga volta para outra criança.',
        ),
      ],
    },
    {
      titulo: 'Check-in',
      blocos: [
        p(
          'A presença é confirmada pelo estabelecimento, lendo o código que aparece no app no ' +
            'dia da aula. O app pode pedir sua localização para conferir que você está no ' +
            'local; o que guardamos disso está descrito na Política de Privacidade.',
        ),
      ],
    },
    {
      titulo: 'Avaliações',
      blocos: [
        p(
          'Você pode avaliar um estabelecimento depois de uma aula confirmada. A avaliação é ' +
            'pública. Não publique dados pessoais seus, da criança ou de terceiros no texto — ' +
            'e não publique conteúdo ofensivo ou falso. Podemos remover avaliações que violem ' +
            'isto.',
        ),
      ],
    },
    {
      titulo: 'Uso indevido',
      blocos: [
        p(
          'Podemos suspender ou encerrar uma conta que tente burlar as regras de reserva, ' +
            'forjar presença, usar dados de terceiros sem autorização ou atacar o serviço.',
        ),
      ],
    },
    {
      titulo: 'Responsabilidade',
      blocos: [
        p(
          'O Kidoo responde pelo funcionamento do aplicativo e pela intermediação da reserva. ' +
            'A aula em si — conteúdo, professor, instalações e segurança — é responsabilidade ' +
            'do estabelecimento parceiro, que declara estar regular para a atividade que ' +
            'oferece.',
        ),
        p('Se uma turma for cancelada pelo estabelecimento, o coin volta para a sua cota.'),
      ],
    },
    {
      titulo: 'Mudanças e contato',
      blocos: [
        p(
          'Mudanças nestes termos são avisadas pelo app antes de valerem. Para falar com a ' +
            `gente sobre eles, escreva para ${EMAIL_PRIVACIDADE}.`,
        ),
        p('Estes termos são regidos pela lei brasileira.'),
      ],
    },
  ],
};

export const DOCUMENTOS = { privacidade: PRIVACIDADE, termos: TERMOS } as const;
export type DocumentoId = keyof typeof DOCUMENTOS;

/**
 * Os `[…]` que faltam preencher.
 *
 * Existe como função, e não como comentário, porque comentário não falha
 * build. `npm run test:documentos` chama isto e recusa publicar um documento
 * que ainda diz "[…razão social…]" para uma família de verdade.
 */
export function lacunas(documento: Documento): string[] {
  const achados: string[] = [];
  for (const secao of documento.secoes) {
    for (const bloco of secao.blocos) {
      const textos = bloco.tipo === 'p' ? [bloco.texto] : bloco.itens;
      for (const texto of textos) {
        for (const lacuna of texto.match(/\[[^\]]*\]/g) ?? []) {
          achados.push(`${secao.titulo}: ${lacuna}`);
        }
      }
    }
  }
  return achados;
}
