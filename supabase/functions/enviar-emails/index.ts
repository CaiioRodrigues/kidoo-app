/**
 * Entrega os e-mails de decisão que estão na caixa de saída.
 *
 * Roda como Edge Function no Supabase, com a chave de serviço — que é o único
 * jeito de ler `email_outbox`, fechada para app e painel.
 *
 * Irmã de `enviar-avisos`, e pelo mesmo motivo: quem escreve na caixa é a
 * transação da decisão (`approve_application`, `reject_application`), e ela
 * cria parceiro, vínculo de dono, atividades e repasse de uma vez. Uma chamada
 * HTTP ali dentro seguraria essa transação pelo tempo da rede, e uma queda do
 * serviço de e-mail desfaria uma aprovação que já estava certa.
 *
 * O texto do e-mail mora AQUI, e não no banco: a caixa guarda o que aconteceu
 * (`kind` + `data`), então mudar a redação não é migration, e uma mensagem que
 * ficou na fila sai com o texto novo.
 *
 * Deploy e agendamento estão em `supabase/setup/28-email-da-decisao.md`.
 */

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const RESEND_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
/** O remetente precisa ser de domínio verificado no Resend, senão ele recusa. */
const REMETENTE = Deno.env.get('EMAIL_REMETENTE') ?? 'Kidoo <nao-responda@sejakidoo.com.br>';
/** Para onde o botão leva. Sem barra no fim — cada uso escreve a sua. */
const PAINEL = (Deno.env.get('PAINEL_URL') ?? 'https://sejakidoo.com.br').replace(/\/+$/, '');

const RESEND = 'https://api.resend.com/emails';
/** Uma rodada por vez. O Resend limita requisições por segundo, não por lote. */
const POR_RODADA = 50;

type Pendente = {
  id: string;
  to_email: string;
  kind: string;
  data: Record<string, unknown>;
};

type Mensagem = { assunto: string; html: string; texto: string };

const cabecalhos = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
};

async function rest(caminho: string, init?: RequestInit): Promise<Response> {
  return fetch(`${SUPABASE_URL}/rest/v1/${caminho}`, {
    ...init,
    headers: { ...cabecalhos, ...(init?.headers ?? {}) },
  });
}

/**
 * Nome de estabelecimento e motivo de recusa são texto que uma pessoa digitou,
 * e vão para dentro de HTML. Sem escapar, um `<` no nome quebra a mensagem — e
 * um `<script>` no motivo seria pior que quebrada.
 */
function escapar(valor: unknown): string {
  return String(valor ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

/** O envelope da marca, para as duas mensagens não divergirem. */
function moldura(titulo: string, miolo: string, botao: { texto: string; href: string }): string {
  return `<!doctype html>
<html lang="pt-BR"><body style="margin:0;padding:24px;background:#F6F4FB;
  font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#1F1633">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
      style="max-width:520px;background:#FFFFFF;border-radius:20px;padding:32px">
      <tr><td>
        <p style="margin:0 0 24px;font-size:20px;font-weight:700;color:#6A3FC6">Kidoo</p>
        <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3">${titulo}</h1>
        ${miolo}
        <p style="margin:28px 0 0">
          <a href="${botao.href}" style="display:inline-block;background:#6A3FC6;color:#FFFFFF;
            text-decoration:none;padding:14px 22px;border-radius:999px;font-weight:600">
            ${botao.texto}</a>
        </p>
        <p style="margin:28px 0 0;font-size:13px;color:#6E6580">
          Este endereço não recebe respostas. Para falar com a gente, use o painel.
        </p>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;
}

const P = 'margin:0 0 12px;font-size:15px;line-height:1.6';

function montar(pendente: Pendente): Mensagem | null {
  const nome = escapar(pendente.data.estabelecimento);

  if (pendente.kind === 'pedido_aprovado') {
    return {
      assunto: 'Seu espaço foi aprovado no Kidoo',
      texto:
        `O ${pendente.data.estabelecimento} foi aprovado no Kidoo.\n\n` +
        `Entre no painel para publicar suas primeiras turmas: ${PAINEL}\n\n` +
        `Criamos uma atividade para cada modalidade que você informou. ` +
        `Falta abrir os horários — é o que faz as famílias encontrarem você.`,
      html: moldura(
        `${nome} está dentro 🎉`,
        `<p style="${P}">Seu cadastro foi aprovado. A partir de agora o
           ${nome} aparece para as famílias do Kidoo.</p>
         <p style="${P}">Já criamos uma atividade para cada modalidade que você
           informou. <strong>Falta abrir os horários</strong> — é isso que faz
           uma turma aparecer na busca e receber reserva.</p>`,
        { texto: 'Publicar minhas turmas', href: PAINEL },
      ),
    };
  }

  if (pendente.kind === 'pedido_recusado') {
    const motivo = escapar(pendente.data.motivo);
    return {
      assunto: 'Sobre o cadastro do seu espaço no Kidoo',
      texto:
        `Não conseguimos aprovar o cadastro do ${pendente.data.estabelecimento} ainda.\n\n` +
        `Motivo: ${pendente.data.motivo}\n\n` +
        `Isso não encerra nada: entre no painel, o formulário está lá preenchido ` +
        `para você corrigir e reenviar. ${PAINEL}`,
      html: moldura(
        'Precisamos de um ajuste',
        `<p style="${P}">Ainda não conseguimos aprovar o cadastro do
           ${nome}. Quem analisou escreveu o porquê:</p>
         <p style="margin:0 0 12px;padding:14px 16px;background:#F6F4FB;border-radius:12px;
            font-size:15px;line-height:1.6">${motivo}</p>
         <p style="${P}">Isso não encerra nada. No painel, o formulário está lá
           preenchido do jeito que você mandou — corrija o ponto acima e envie
           de novo.</p>`,
        { texto: 'Corrigir e reenviar', href: PAINEL },
      ),
    };
  }

  return null;
}

Deno.serve(async () => {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return new Response('faltam SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY', { status: 500 });
  }
  if (!RESEND_KEY) {
    return new Response('falta RESEND_API_KEY', { status: 500 });
  }

  // Pendentes, mais antigos primeiro: quem esperou a decisão há mais tempo é
  // avisado antes.
  const resp = await rest(
    `email_outbox?sent_at=is.null&order=created_at.asc&limit=${POR_RODADA}` +
      '&select=id,to_email,kind,data',
  );
  if (!resp.ok) {
    return new Response(`falha ao ler a caixa: ${await resp.text()}`, { status: 500 });
  }
  const pendentes: Pendente[] = await resp.json();
  if (pendentes.length === 0) {
    return Response.json({ pendentes: 0, enviados: 0 });
  }

  const agora = new Date().toISOString();
  let enviados = 0;
  const falhas: string[] = [];

  async function marcar(id: string, erro: string | null) {
    await rest(`email_outbox?id=eq.${id}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ sent_at: agora, error: erro }),
    });
  }

  for (const pendente of pendentes) {
    const mensagem = montar(pendente);
    if (!mensagem) {
      // Tipo que esta versão da função não conhece. Marcar como resolvido com
      // motivo, senão ele fica pendente para sempre e cresce a fila a cada
      // rodada — foi o cuidado que `enviar-avisos` tomou com aviso sem
      // aparelho.
      await marcar(pendente.id, `tipo desconhecido: ${pendente.kind}`);
      falhas.push(pendente.id);
      continue;
    }

    let entrega: Response;
    try {
      entrega = await fetch(RESEND, {
        method: 'POST',
        headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: REMETENTE,
          to: [pendente.to_email],
          subject: mensagem.assunto,
          html: mensagem.html,
          text: mensagem.texto,
        }),
      });
    } catch (e) {
      // Rede caiu no meio. NÃO marca: fica pendente e sai na próxima rodada.
      // Marcar aqui perderia o aviso para sempre.
      falhas.push(`${pendente.id}: ${e instanceof Error ? e.message : 'rede'}`);
      continue;
    }

    if (entrega.ok) {
      await marcar(pendente.id, null);
      enviados += 1;
      continue;
    }

    const texto = await entrega.text();
    // 4xx é recusa do serviço — chave errada, domínio não verificado, endereço
    // inválido. Tentar de novo dá o mesmo erro para sempre, então fica
    // registrado e sai da fila. 5xx e 429 é problema do outro lado: deixa
    // pendente, que amanhã funciona.
    if (entrega.status >= 400 && entrega.status < 500 && entrega.status !== 429) {
      await marcar(pendente.id, `${entrega.status}: ${texto.slice(0, 300)}`);
    }
    falhas.push(`${pendente.id}: ${entrega.status}`);
  }

  return Response.json({ pendentes: pendentes.length, enviados, falhas: falhas.length });
});
