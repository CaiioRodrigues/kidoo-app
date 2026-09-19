-- =====================================================================
-- A avaliação deixa de carregar o id de quem a escreveu.
-- =====================================================================
--
-- `reviews` é de leitura pública de propósito: o catálogo mostra nota e
-- comentário para quem nem tem conta. O que vinha junto sem precisar era a
-- coluna `guardian_id`.
--
-- Ela não abre porta nenhuma — a RLS decide por `auth.uid()`, que vem do
-- token, e não por id que alguém mande. O problema é outro: com ela exposta,
-- qualquer pessoa liga todas as avaliações do mesmo responsável entre
-- estabelecimentos. Somado ao `author_name`, que é o primeiro nome, isso
-- monta um perfil de por onde aquela família anda com a criança. Num app
-- infantil, é mais do que a tela precisa mostrar para ser útil.
--
-- O app nunca pediu essa coluna: os dois `select` do adapter são
-- `id, booking_id` e `id, activity_id, author_name, rating, comment,
-- created_at, helpful_count`. Então isto não tira nada de ninguém.
--
-- `submit_review` continua devolvendo a linha inteira, e continua certo:
-- ela é `security definer` e devolve a avaliação de quem acabou de escrever.
-- Ver o próprio id não é vazamento.
-- =====================================================================

-- Não dá para tirar uma coluna de um `grant` de tabela: o jeito é derrubar o
-- grant inteiro e reconceder coluna a coluna. Mesmo caminho do `update` de
-- `partners`, que precisou disso para proteger `verified` e a coordenada.
revoke select on reviews from anon, authenticated;

grant select (id, booking_id, activity_id, author_name, rating, comment, created_at, helpful_count)
  on reviews to anon, authenticated;
