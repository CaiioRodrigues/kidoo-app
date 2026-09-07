-- =====================================================================
-- Kidoo — cadastrar o primeiro parceiro.
--
-- ANTES de rodar isto, crie a conta de acesso do parceiro:
--   Authentication → Users → Add user → Create new user
--   Marque "Auto Confirm User" (senão a pessoa não consegue entrar).
--
-- Depois edite APENAS o bloco marcado abaixo e rode no SQL Editor.
-- =====================================================================

do $$
declare
  -- ------------------------------------------------------------------
  -- EDITE DAQUI
  -- ------------------------------------------------------------------
  v_email        text := 'parceiro@exemplo.com';   -- e-mail da conta criada acima
  v_nome         text := 'Academia Arena Kids';
  v_bairro       text := 'Buritis';
  v_cidade       text := 'Belo Horizonte';
  -- Coordenada do local. Pegue no Google Maps: clique com o botão direito
  -- sobre o endereço e copie os dois números. É daqui que sai a distância
  -- mostrada no app e a checagem de proximidade do check-in.
  v_latitude     double precision := -19.9702;
  v_longitude    double precision := -43.9803;

  -- Quanto o Kidoo paga por presença confirmada, em CENTAVOS.
  -- Vaga ociosa custa menos porque a turma acontece de qualquer jeito.
  v_repasse_ociosa integer := 800;    -- R$ 8,00
  v_repasse_cheia  integer := 1800;   -- R$ 18,00
  -- ------------------------------------------------------------------
  -- ATÉ AQUI
  -- ------------------------------------------------------------------

  v_user_id    uuid;
  v_partner_id uuid;
begin
  select id into v_user_id from auth.users where lower(email) = lower(v_email);
  if v_user_id is null then
    raise exception
      'Não existe usuário com o e-mail %. Crie a conta em Authentication → Users antes de rodar isto.',
      v_email;
  end if;

  insert into partners (name, neighborhood, city, verified, latitude, longitude)
  values (v_nome, v_bairro, v_cidade, true, v_latitude, v_longitude)
  returning id into v_partner_id;

  -- É esta linha que dá acesso ao painel. Sem ela, a pessoa entra e vê
  -- "conta sem estabelecimento".
  insert into partner_members (partner_id, user_id, role)
  values (v_partner_id, v_user_id, 'owner');

  insert into payout_rates (partner_id, kind, amount_cents) values
    (v_partner_id, 'ociosa', v_repasse_ociosa),
    (v_partner_id, 'cheia',  v_repasse_cheia);

  raise notice 'Parceiro % criado com id %. Já dá para entrar no painel.', v_nome, v_partner_id;
end $$;
