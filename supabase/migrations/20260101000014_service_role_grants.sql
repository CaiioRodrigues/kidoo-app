-- O entregador precisa de permissão na tabela, não só de ignorar a RLS.
--
-- A migration da fila fechou `push_outbox` e `push_tokens` sem policy nenhuma,
-- com este comentário: "quem entrega usa a chave de serviço, que ignora RLS".
-- A frase é verdadeira e a conclusão era falsa. Ignorar RLS é uma coisa; ter
-- privilégio na tabela é outra, e vem antes. Sem `grant`, o `service_role`
-- nem chega a ser avaliado por política alguma — o Postgres barra no
-- privilégio, e a Edge Function recebe:
--
--   42501: permission denied for table push_outbox
--
-- O efeito é o pior possível: a fila enche, o gatilho funciona, a função é
-- chamada a cada cinco minutos e falha na primeira consulta. Nada chega, e
-- nada no banco parece errado.
--
-- Os privilégios são exatamente os que a função usa, e nada além:
--   push_outbox  select (ler os pendentes) + update (marcar sent_at/error)
--   push_tokens  select (achar o aparelho) + delete (tirar token morto,
--                 quando o Expo responde DeviceNotRegistered)
--
-- `insert` em `push_outbox` fica de fora de propósito: quem escreve aviso é o
-- gatilho, dentro do banco. E `insert`/`update` em `push_tokens` também: quem
-- registra aparelho é a família, pela função `register_push_token`.
do $$
begin
  -- O papel só existe no Supabase; no Postgres local do teste ele é criado
  -- pelo `run.sh` para que estas permissões sejam verificáveis.
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    raise notice 'sem papel service_role: pulando os grants do entregador';
    return;
  end if;

  grant select, update on push_outbox to service_role;
  grant select, delete on push_tokens to service_role;
end $$;
