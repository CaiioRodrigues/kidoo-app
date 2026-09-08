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
create temp table if not exists kidoo_avisos (ordem int, etapa text, situacao text, detalhe text);
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

  insert into kidoo_avisos values (1, '1. alguém na fila de espera',
    case when v_esperando = 0 then 'NINGUÉM NA FILA' else 'ok' end,
    v_esperando || ' esperando, ' || v_a_avisar || ' ainda sem aviso');

  -- 2. O gatilho existe? ----------------------------------------------
  select exists (
    select 1 from pg_trigger
     where tgname = 'class_sessions_notify_waitlist' and not tgisinternal
  ) into v_gatilho;

  insert into kidoo_avisos values (2, '2. gatilho na turma',
    case when v_gatilho then 'ok' else 'FALTANDO' end,
    case when v_gatilho then 'dispara quando a vaga abre'
         else 'rode o 10-atualizar.sql' end);

  -- 3. O aviso foi gerado? --------------------------------------------
  select count(*), count(*) filter (where created_at > now() - interval '2 hours')
    into v_avisos, v_recentes from push_outbox;

  select title || ' — ' || to_char(created_at at time zone 'America/Sao_Paulo', 'DD/MM HH24:MI')
    into v_ultimo from push_outbox order by created_at desc limit 1;

  insert into kidoo_avisos values (3, '3. aviso gerado na caixa de saída',
    case when v_avisos = 0 then 'NENHUM AVISO GERADO' else 'ok' end,
    coalesce(v_avisos || ' no total, ' || v_recentes || ' nas últimas 2h · último: '
             || coalesce(v_ultimo, '—'), 'nenhum'));

  -- 4. Existe aparelho para receber? -----------------------------------
  -- É aqui que a corrente arrebentava até a correção de hoje:
  -- `register_push_token` não devolve nada, e o app tratava resposta vazia
  -- como erro — dentro de um `catch` silencioso. Nenhum celular chegou a ser
  -- registrado. Zero aqui com a build ANTIGA instalada é exatamente isso.
  select count(*) into v_tokens from push_tokens;

  insert into kidoo_avisos values (4, '4. celular registrado',
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

  insert into kidoo_avisos values (5, '5. entrega',
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
    insert into kidoo_avisos values (6, '6. agendamento a cada 5 min',
      'SEM pg_cron', 'veja o passo 2 de supabase/setup/09-avisos.md');
  else
    execute $q$
      select case when count(*) = 0 then 'NÃO AGENDADO'
                  else 'ok · ' || string_agg(schedule, ', ') end
        from cron.job where command like '%enviar-avisos%'
    $q$ into v_agenda;
    insert into kidoo_avisos values (6, '6. agendamento a cada 5 min',
      case when v_agenda like 'ok%' then 'ok' else v_agenda end,
      coalesce(v_agenda, '—'));
  end if;
end $diag$;

select etapa, situacao, detalhe from kidoo_avisos order by ordem;
