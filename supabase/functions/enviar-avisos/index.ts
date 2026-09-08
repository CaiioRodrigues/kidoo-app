/**
 * Entrega os avisos que estão na caixa de saída.
 *
 * Roda como Edge Function no Supabase, com a chave de serviço — que é o único
 * jeito de ler `push_outbox`, fechada para app e painel.
 *
 * Por que a entrega é um processo à parte, e não uma chamada dentro do gatilho:
 * o gatilho roda dentro da transação que devolve a vaga (`cancel_booking`, ou o
 * parceiro abrindo lugares). Uma chamada HTTP ali seguraria o lock da turma
 * pelo tempo da rede, e uma falha do serviço de push desfaria o cancelamento
 * da família. Escrever numa tabela é instantâneo e não falha por rede; entregar
 * pode tentar de novo amanhã sem desfazer nada.
 *
 * Deploy e agendamento estão em `supabase/setup/09-avisos.md`.
 */

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const EXPO_PUSH = 'https://exp.host/--/api/v2/push/send';

/** O Expo aceita no máximo 100 mensagens por requisição. */
const LOTE = 100;

type Aviso = {
  id: string;
  guardian_id: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
};

type Recado = {
  to: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  channelId: string;
};

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

Deno.serve(async () => {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return new Response('faltam SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY', { status: 500 });
  }

  // Pendentes, mais antigos primeiro: quem esperou mais é avisado antes.
  const pendentesResp = await rest(
    'push_outbox?sent_at=is.null&order=created_at.asc&limit=200' +
      '&select=id,guardian_id,title,body,data',
  );
  if (!pendentesResp.ok) {
    return new Response(`falha ao ler a caixa: ${await pendentesResp.text()}`, { status: 500 });
  }
  const pendentes: Aviso[] = await pendentesResp.json();
  if (pendentes.length === 0) {
    return Response.json({ pendentes: 0, enviados: 0 });
  }

  // Uma consulta só para todos os destinatários, em vez de uma por aviso: numa
  // turma que abre 5 vagas de uma vez, seriam 5 idas ao banco por nada.
  const donos = [...new Set(pendentes.map((a) => a.guardian_id))];
  const tokensResp = await rest(
    `push_tokens?user_id=in.(${donos.join(',')})&select=token,user_id`,
  );
  const tokens: { token: string; user_id: string }[] = tokensResp.ok
    ? await tokensResp.json()
    : [];

  const porDono = new Map<string, string[]>();
  for (const t of tokens) {
    porDono.set(t.user_id, [...(porDono.get(t.user_id) ?? []), t.token]);
  }

  // Cada aviso pode virar vários recados: a mesma família pode ter o app em
  // dois aparelhos, e o aviso perde a graça se chega só no tablet.
  const recados: Recado[] = [];
  const avisoDoRecado: string[] = [];
  const semAparelho: string[] = [];

  for (const aviso of pendentes) {
    const destinos = porDono.get(aviso.guardian_id) ?? [];
    if (destinos.length === 0) {
      // Ninguém para avisar. Marcamos como resolvido com motivo, senão ele
      // ficaria pendente para sempre e cresceria a fila a cada rodada.
      semAparelho.push(aviso.id);
      continue;
    }
    for (const to of destinos) {
      recados.push({
        to,
        title: aviso.title,
        body: aviso.body,
        data: aviso.data,
        channelId: 'vagas',
      });
      avisoDoRecado.push(aviso.id);
    }
  }

  const entregues = new Set<string>();
  const falhos = new Map<string, string>();
  const tokensMortos: string[] = [];

  for (let i = 0; i < recados.length; i += LOTE) {
    const fatia = recados.slice(i, i + LOTE);
    const resp = await fetch(EXPO_PUSH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept-Encoding': 'gzip, deflate' },
      body: JSON.stringify(fatia),
    });

    if (!resp.ok) {
      // Falha do lote inteiro: deixa pendente para a próxima rodada. Marcar
      // como enviado aqui perderia o aviso para sempre.
      continue;
    }

    const { data } = (await resp.json()) as {
      data: { status: string; message?: string; details?: { error?: string } }[];
    };

    data.forEach((bilhete, j) => {
      const avisoId = avisoDoRecado[i + j];
      const recado = fatia[j];
      if (!avisoId || !recado) return;

      if (bilhete.status === 'ok') {
        entregues.add(avisoId);
        return;
      }
      falhos.set(avisoId, bilhete.message ?? 'erro desconhecido');
      // Aparelho que desinstalou o app: o token nunca mais vai funcionar, e
      // mantê-lo faria toda rodada futura gastar uma tentativa nele.
      if (bilhete.details?.error === 'DeviceNotRegistered') {
        tokensMortos.push(recado.to);
      }
    });
  }

  const agora = new Date().toISOString();

  // Um aviso que chegou em pelo menos um aparelho está entregue. Falhar no
  // tablet não é motivo para mandar de novo no celular que já recebeu.
  for (const id of falhos.keys()) {
    if (entregues.has(id)) falhos.delete(id);
  }

  async function marcar(ids: string[], corpo: Record<string, unknown>) {
    if (ids.length === 0) return;
    await rest(`push_outbox?id=in.(${ids.join(',')})`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify(corpo),
    });
  }

  await marcar([...entregues], { sent_at: agora, error: null });
  await marcar(semAparelho, { sent_at: agora, error: 'sem aparelho registrado' });
  for (const [id, erro] of falhos) {
    await marcar([id], { sent_at: agora, error: erro });
  }

  if (tokensMortos.length > 0) {
    await rest(`push_tokens?token=in.(${tokensMortos.map((t) => `"${t}"`).join(',')})`, {
      method: 'DELETE',
      headers: { Prefer: 'return=minimal' },
    });
  }

  return Response.json({
    pendentes: pendentes.length,
    enviados: entregues.size,
    sem_aparelho: semAparelho.length,
    falhas: falhos.size,
    tokens_removidos: tokensMortos.length,
  });
});
