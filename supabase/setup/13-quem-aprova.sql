-- =====================================================================
-- Kidoo — dizer ao banco quem pode aprovar estabelecimentos.
--
-- Rode UMA VEZ, no SQL Editor, trocando o e-mail abaixo pelo da sua
-- conta. Sem isto, os pedidos chegam e ninguém consegue analisá-los —
-- nem você.
--
-- Esta lista é curta de propósito e não tem tela: quem entra aqui decide
-- quem vira "Parceiro verificado" no app e quem passa a receber repasse.
-- Uma tela para editá-la seria uma tela para escalar privilégio.
-- =====================================================================

-- >>> TROQUE O E-MAIL AQUI <<<
select set_config('kidoo.email', 'cfariarodrigues@gmail.com', false);

do $$
declare v_id uuid;
begin
  select id into v_id from auth.users where lower(email) = lower(current_setting('kidoo.email'));
  if v_id is null then
    raise exception 'Nenhuma conta com esse e-mail. Crie a conta no app ou no painel primeiro.';
  end if;

  insert into kidoo_admins (user_id) values (v_id) on conflict do nothing;
  raise notice 'ok: % pode analisar pedidos de estabelecimento', current_setting('kidoo.email');
end $$;

select u.email as quem_aprova, a.created_at as desde
  from kidoo_admins a join auth.users u on u.id = a.user_id
 order by a.created_at;
