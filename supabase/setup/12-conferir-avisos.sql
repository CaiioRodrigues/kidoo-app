-- =====================================================================
-- Kidoo — por que o aviso de vaga não chegou.
--
-- Cole INTEIRO no SQL Editor do Supabase e clique em Run. Ele não muda
-- nada: só percorre a corrente do aviso e diz em qual elo ela parou.
--
--   fila de espera → gatilho → caixa de saída → aparelho → entrega
--
-- Cada etapa tem um veredito. A PRIMEIRA que não vier "ok" é a causa;
-- as seguintes são consequência dela, não problemas separados.
-- =====================================================================
-- `quando` não aparece no resultado: existe só para as linhas 7 e 8 saírem em
-- ordem de data. Ordenar pelo texto poria sexta antes de terça.
create temp table if not exists kidoo_avisos
  (ordem int, etapa text, situacao text, detalhe text, quando timestamptz);
truncate kidoo_avisos;

do $diag$
declare
  v_esperando   int;
  v_a_avisar    int;
  v_gatilho     boolean;
  v_avisos      int;
  v_recentes    int;
  v_ultimo      text;
  v_tokens      int;
  v_pendentes   int;
  v_enviados    int;
  v_erro        text;
  v_agenda      text;
begin
  -- 1. Alguém está na fila? -------------------------------------------
  select count(*), count(*) filter (where notified_at is null)
    into v_esperando, v_a_avisar
    from session_waitlist;

  insert into kidoo_avisos (ordem, etapa, situacao, detalhe) values (1, '1. alguém na fila de espera',
    case when v_esperando = 0 then 'NINGUÉM NA FILA' else 'ok' end,
    v_esperando || ' esperando, ' || v_a_avisar || ' ainda sem aviso');

  -- 2. O gatilho existe? ----------------------------------------------
  select exists (
    select 1 from pg_trigger
     where tgname = 'class_sessions_notify_waitlist' and not tgisinternal
  ) into v_gatilho;

  insert into kidoo_avisos (ordem, etapa, situacao, detalhe) values (2, '2. gatilho na turma',
    case when v_gatilho then 'ok' else 'FALTANDO' end,
    case when v_gatilho then 'dispara quando a vaga abre'
         else 'rode o 10-atualizar.sql' end);

  -- 3. O aviso foi gerado? --------------------------------------------
  select count(*), count(*) filter (where created_at > now() - interval '2 hours')
    into v_avisos, v_recentes from push_outbox;

  select title || ' — ' || to_char(created_at at time zone 'America/Sao_Paulo', 'DD/MM HH24:MI')
    into v_ultimo from push_outbox order by created_at desc limit 1;

  -- Caixa vazia COM gente na fila quase sempre quer dizer a mesma coisa: o
  -- aviso foi pedido numa turma e a vaga foi aberta em outra. O gatilho avisa
  -- quem espera pela turma que abriu, e só — e o engano não deixa rastro
  -- nenhum, porque nada dá errado: a fila fica lá e a vaga abre.
  insert into kidoo_avisos (ordem, etapa, situacao, detalhe) values (3, '3. aviso gerado na caixa de saída',
    case when v_avisos = 0 then 'NENHUM AVISO GERADO' else 'ok' end,
    case when v_avisos = 0 and v_esperando > 0
         then 'compare a linha 7 com a turma em que você abriu vaga: '
              || 'precisa ser a MESMA'
         else v_avisos || ' no total, ' || v_recentes || ' nas últimas 2h · último: '
              || coalesce(v_ultimo, '—') end);

  -- 4. Existe aparelho para receber? -----------------------------------
  -- É aqui que a corrente arrebentava até a correção de hoje:
  -- `register_push_token` não devolve nada, e o app tratava resposta vazia
  -- como erro — dentro de um `catch` silencioso. Nenhum celular chegou a ser
  -- registrado. Zero aqui com a build ANTIGA instalada é exatamente isso.
  select count(*) into v_tokens from push_tokens;

  insert into kidoo_avisos (ordem, etapa, situacao, detalhe) values (4, '4. celular registrado',
    case when v_tokens = 0 then 'NENHUM APARELHO' else 'ok' end,
    case when v_tokens = 0
         then 'instale a build nova e abra o app uma vez'
         else v_tokens || ' aparelho(s)' end);

  -- 5. A entrega aconteceu? --------------------------------------------
  select count(*) filter (where sent_at is null),
         count(*) filter (where sent_at is not null)
    into v_pendentes, v_enviados from push_outbox;

  select error into v_erro
    from push_outbox where error is not null order by created_at desc limit 1;

  insert into kidoo_avisos (ordem, etapa, situacao, detalhe) values (5, '5. entrega',
    case when v_avisos = 0 then '—'
         when v_enviados > 0 and v_pendentes = 0 then 'ok'
         when v_pendentes > 0 then 'PARADO NA CAIXA'
         else 'ok' end,
    v_enviados || ' entregue(s), ' || v_pendentes || ' parado(s)'
      || coalesce(' · último erro: ' || v_erro, ''));

  -- 6. Quem tira da caixa está rodando? --------------------------------
  -- `cron.job` só existe com o pg_cron instalado, e é resolvido no plano da
  -- consulta: uma referência direta rebentaria antes de qualquer `case`.
  if to_regclass('cron.job') is null then
    insert into kidoo_avisos (ordem, etapa, situacao, detalhe) values (6, '6. agendamento a cada 5 min',
      'SEM pg_cron', 'veja o passo 2 de supabase/setup/09-avisos.md');
  else
    execute $q$
      select case when count(*) = 0 then 'NÃO AGENDADO'
                  else 'ok · ' || string_agg(schedule, ', ') end
        from cron.job where command like '%enviar-avisos%'
    $q$ into v_agenda;
    insert into kidoo_avisos (ordem, etapa, situacao, detalhe) values (6, '6. agendamento a cada 5 min',
      case when v_agenda like 'ok%' then 'ok' else v_agenda end,
      coalesce(v_agenda, '—'));
  end if;
  -- 7. E, principalmente: a fila é DAQUELA turma? -----------------------
  -- O gatilho avisa quem espera pela turma que abriu vaga, e só. Pedir aviso
  -- numa quinta e reabrir vaga em outra é o engano mais fácil de cometer
  -- agora que o painel lista 21 dias — e ele não deixa rastro nenhum: a fila
  -- fica lá, a vaga abre, e nada acontece porque são turmas diferentes.
  --
  -- Compare as linhas abaixo com a turma que você editou no painel.
  insert into kidoo_avisos
  select 7, '7. fila: ' || coalesce(a.title, '?'),
         to_char(s.starts_at at time zone 'America/Sao_Paulo', 'Dy DD/MM HH24:MI'),
         'vagas abertas: ' || s.slots_open || ' · reservadas: ' || s.slots_taken
           || ' · ' || case when s.starts_at <= now() then 'JÁ COMEÇOU (o aviso não sai)'
                            else 'ainda vai acontecer' end
           || ' · aviso: ' || case when w.notified_at is null then 'ainda não'
                                   else 'já enviado' end
           || ' · turma ' || left(s.id::text, 8),
         s.starts_at
    from session_waitlist w
    join class_sessions s on s.id = w.session_id
    left join activities a on a.id = s.activity_id;
  -- 6b. O agendamento rodou? E o que a função respondeu? ---------------
  -- "Agendado" não é "funcionando". O cron pode disparar a cada 5 minutos e a
  -- Edge Function responder 401 (chave errada no cabeçalho) ou 404 (função
  -- nunca publicada) — e nada disso aparece na caixa de saída, que continua
  -- cheia em silêncio. O pg_net guarda a resposta HTTP; é ela que diz qual dos
  -- dois é.
  if to_regclass('cron.job_run_details') is not null then
    execute $q$
      select coalesce(status || ' · ' || to_char(start_time at time zone 'America/Sao_Paulo',
                                                 'DD/MM HH24:MI')
                      || coalesce(' · ' || nullif(return_message, ''), ''),
                      'nunca rodou')
        from cron.job_run_details order by start_time desc limit 1
    $q$ into v_agenda;
    insert into kidoo_avisos (ordem, etapa, situacao, detalhe) values (61,
      '6b. última execução do agendamento',
      case when v_agenda is null then 'NUNCA RODOU'
           when v_agenda like 'succeeded%' then 'ok' else 'FALHOU' end,
      coalesce(v_agenda, 'nenhuma execução registrada ainda (espere 5 min)'));
  end if;

  if to_regclass('net._http_response') is not null then
    execute $q$
      select coalesce(status_code::text, 'sem resposta')
             || coalesce(' · ' || nullif(error_msg, ''), '')
             || coalesce(' · ' || left(content, 90), '')
        from net._http_response order by created desc limit 1
    $q$ into v_agenda;
    insert into kidoo_avisos (ordem, etapa, situacao, detalhe) values (62,
      '6c. o que a função respondeu',
      case when v_agenda is null then 'NENHUMA CHAMADA'
           when v_agenda like '200%' then 'ok'
           when v_agenda like '401%' or v_agenda like '403%' then 'CHAVE RECUSADA'
           when v_agenda like '404%' then 'FUNÇÃO NÃO PUBLICADA'
           else 'ERRO' end,
      coalesce(v_agenda, 'o cron nunca chamou a função'));
  end if;

  -- 8. As irmãs gêmeas ------------------------------------------------
  -- Toda turma futura da MESMA atividade da fila. É aqui que o engano fica
  -- visível: o `11-parceiros-teste.sql` cria 5 parceiros com 3 turmas cada,
  -- todos chamados "Teste GPS ...", e no painel elas só se distinguem pelo
  -- dia e pela hora. Abrir vaga na irmã errada não dá erro nenhum.
  --
  -- Abra a vaga na linha que tiver "← A FILA É DESTA".
  insert into kidoo_avisos
  select 8, '8. turmas de ' || a.title,
         to_char(s.starts_at at time zone 'America/Sao_Paulo', 'Dy DD/MM HH24:MI'),
         'vagas abertas: ' || s.slots_open || ' · reservadas: ' || s.slots_taken
           || ' · turma ' || left(s.id::text, 8)
           || case when exists (select 1 from session_waitlist w where w.session_id = s.id)
                   then '  ← A FILA É DESTA' else '' end,
         s.starts_at
    from class_sessions s
    join activities a on a.id = s.activity_id
   where s.starts_at > now()
     and a.id in (select s2.activity_id
                    from session_waitlist w2 join class_sessions s2 on s2.id = w2.session_id);
end $diag$;

select etapa, situacao, detalhe from kidoo_avisos order by ordem, quando nulls first;
