-- =====================================================================
-- O cliente para de poder escrever no que decide dinheiro.
-- =====================================================================
--
-- Achado num pentest contra o próprio banco: com um token de família comum,
-- **um único PATCH** fazia cada uma destas coisas.
--
--   update subscriptions set status = 'ativa'        -- destrava o portão
--   update subscriptions set coins_remaining = 9999  -- coins de graça
--   insert into bonus_grants (...) values (...)      -- bônus de graça
--   update children set xp = 999999                  -- nível falso
--   insert into children (..., xp) values (..., 999999)
--   update guardians set email = 'outro@exemplo.com' -- descola do auth
--
-- Nenhuma delas é furo de RLS: a policy diz "as SUAS linhas", e eram as
-- linhas dela mesma. O furo é o GRANT. `20260101000004` concedeu
-- `select, insert, update, delete` em bloco nessas tabelas, e a policy nunca
-- foi desenhada para ser a única guarda — ela responde QUAIS linhas, não
-- QUAIS colunas nem SE pode escrever.
--
-- O custo era real: coin comprado com nada vira aula, e aula confirmada vira
-- repasse em dinheiro para um parceiro de verdade.
--
-- O que o cliente de fato escreve, e é tudo o que fica:
--
--   guardians  update (photo_url)
--   children   insert (as colunas do formulário) e update (photo_url)
--
-- O resto — cota, bônus, XP — só muda por função `security definer`:
-- `subscribe_plan`, `book_session`, `cancel_booking`, `confirm_by_partner`,
-- `roll_subscription_cycle`, `set_subscription_status`. Elas continuam
-- funcionando: rodam com o privilégio do dono, não com o de quem chama.
-- =====================================================================

-- ------------------------------------------------- a cota e o bônus --------

-- Nenhuma escrita direta, de ninguém. `select` fica: as duas telas leem.
revoke insert, update, delete on subscriptions from authenticated;
revoke insert, update, delete on bonus_grants  from authenticated;

-- ------------------------------------------------- o responsável -----------

-- Grant de tabela não sabe excluir coluna: derruba e reconcede.
revoke insert, update, delete on guardians from authenticated;
grant update (photo_url) on guardians to authenticated;

-- ------------------------------------------------- a criança ---------------

revoke insert, update, delete on children from authenticated;

-- O cadastro. `xp` fora: criança nasce com zero, e quem dá XP é a presença
-- confirmada pelo parceiro.
grant insert (guardian_id, name, birth_date, gender, photo_url, interests)
  on children to authenticated;

-- A troca de foto, e nada mais. `KidooApi.children` tem `list`, `create` e
-- `updatePhoto` — o dia em que existir "editar perfil", a migration daquele
-- dia acrescenta as colunas.
grant update (photo_url) on children to authenticated;
