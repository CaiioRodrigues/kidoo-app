-- Publicar a mesma turma várias semanas de uma vez.
--
-- O parceiro real não tem "uma turma": ele tem terça e quinta às 18h, o ano
-- inteiro. Com `publish_session` uma a uma, abrir dois meses de agenda são
-- dezesseis idas ao formulário — e é por isso que a agenda de um parceiro de
-- verdade ficaria vazia depois da primeira semana.
--
-- **A recorrência não vira um conceito no banco.** Não há tabela de regra nem
-- `series_id`: o que se grava são turmas comuns, iguais às publicadas uma a
-- uma. É uma decisão, não uma economia: uma regra de recorrência só ganha da
-- lista de datas quando alguém quiser editar "todas as terças de uma vez", e
-- até lá ela cobraria o preço de manter turma gerada e turma real em dois
-- estados diferentes (o que acontece com a turma de terça que a família já
-- reservou quando a regra muda?). O dia em que "editar a série" for pedido,
-- este caminho continua válido — as turmas já existem.
--
-- **As datas vêm prontas do navegador**, e isso também é decisão. "Toda terça
-- às 18h" é 18h no relógio de quem está em Belo Horizonte; calcular aqui
-- exigiria carregar o fuso do parceiro e reproduzir o horário de verão de
-- cada país. O navegador dele já sabe disso. O banco recebe instantes.
create or replace function publish_sessions(
  p_activity_id uuid,
  p_starts_at   timestamptz[],
  p_capacity    int,
  p_enrolled    int,
  p_slots_open  int,
  p_coin_cost   int
)
returns table (
  quando     timestamptz,
  session_id uuid,
  -- null = publicada agora. Senão, o motivo de ter sido pulada.
  pulada     text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quando timestamptz;
  v_id     uuid;
begin
  if not is_partner_member((select partner_id from activities where id = p_activity_id)) then
    raise exception 'not_this_partner' using errcode = '42501';
  end if;
  if p_enrolled + p_slots_open > p_capacity then
    raise exception 'over_capacity' using errcode = 'P0001';
  end if;
  if coalesce(array_length(p_starts_at, 1), 0) = 0 then
    raise exception 'no_dates' using errcode = 'P0001';
  end if;
  -- Teto: isto é conveniência de balcão, não importação em massa. Sem ele, um
  -- laço na tela pediria dez mil turmas e o parceiro descobriria depois.
  if array_length(p_starts_at, 1) > 60 then
    raise exception 'too_many_dates' using errcode = 'P0001';
  end if;

  foreach v_quando in array p_starts_at loop
    -- Uma data no passado não derruba as outras. Quem publica "as próximas 8
    -- semanas" numa quinta à noite tem a quinta de hoje na lista, e perder as
    -- outras sete por causa dela seria pior do que pular.
    if v_quando <= now() then
      quando := v_quando; session_id := null; pulada := 'no_passado';
      return next;
      continue;
    end if;

    -- Republicar as mesmas semanas é o engano mais fácil de cometer aqui, e
    -- ele dobraria a agenda em silêncio: duas turmas idênticas, cada uma com
    -- metade das reservas. Não há unique em (activity_id, starts_at) porque
    -- turmas diferentes podem começar juntas de propósito — mas *da mesma
    -- atividade*, no mesmo instante, é sempre engano.
    select cs.id into v_id from class_sessions cs
     where cs.activity_id = p_activity_id and cs.starts_at = v_quando
     limit 1;
    if found then
      quando := v_quando; session_id := v_id; pulada := 'ja_existia';
      return next;
      continue;
    end if;

    insert into class_sessions (activity_id, starts_at, capacity, enrolled, slots_open, coin_cost)
    values (p_activity_id, v_quando, p_capacity, p_enrolled, p_slots_open, p_coin_cost)
    returning id into v_id;

    quando := v_quando; session_id := v_id; pulada := null;
    return next;
  end loop;
end;
$$;

-- Uma chamada, uma transação: ou as oito semanas entram, ou nenhuma entra. Com
-- oito chamadas do navegador, uma queda de rede na quinta deixaria meia série
-- publicada e ninguém saberia quais.
grant execute on function publish_sessions(uuid, timestamptz[], int, int, int, int) to authenticated;
