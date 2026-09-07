-- =====================================================================
-- Kidoo — primeira atividade e primeiras turmas.
--
-- Opcional: dá para fazer tudo isto pelo painel do parceiro, que é como
-- vai ser no dia a dia. Este arquivo existe para o app das famílias já
-- abrir com algo dentro, em vez de um catálogo vazio.
--
-- Rode DEPOIS de `02-primeiro-parceiro.sql`.
-- =====================================================================

do $$
declare
  -- ------------------------------------------------------------------
  -- EDITE DAQUI
  -- ------------------------------------------------------------------
  v_parceiro   text := 'Academia Arena Kids';  -- o nome usado no arquivo 02
  v_titulo     text := 'Futebol Kids';
  -- Uma de: futebol, natacao, judo, danca, ginastica, tenis, basquete, volei, artes
  v_categoria  text := 'futebol';
  v_idade_min  smallint := 6;
  v_idade_max  smallint := 9;
  v_descricao  text := 'Aula de futebol para crianças, com foco em brincadeira e coordenação.';

  -- A turma como ela é hoje: lugares que comporta e quantos alunos você já
  -- tem matriculados direto. As vagas abertas são o que vai para o Kidoo.
  v_capacidade    smallint := 20;
  v_matriculados  smallint := 11;
  v_vagas_kidoo   smallint := 5;
  v_custo_coins   smallint := 2;
  -- ------------------------------------------------------------------
  -- ATÉ AQUI
  -- ------------------------------------------------------------------

  v_partner_id  uuid;
  v_activity_id uuid;
  v_dia         int;
begin
  select id into v_partner_id from partners where name = v_parceiro;
  if v_partner_id is null then
    raise exception 'Não achei o parceiro "%". Rode 02-primeiro-parceiro.sql antes.', v_parceiro;
  end if;

  insert into activities (partner_id, category_id, title, min_age, max_age, description, tags)
  values (v_partner_id, v_categoria, v_titulo, v_idade_min, v_idade_max, v_descricao,
          array['ao ar livre', 'em grupo'])
  returning id into v_activity_id;

  -- Uma turma por dia nos próximos 7 dias, às 17h. `kind` não entra aqui:
  -- é derivado da lotação por um gatilho, porque quem define o repasse não
  -- pode ser quem o recebe.
  for v_dia in 1..7 loop
    insert into class_sessions (activity_id, starts_at, capacity, enrolled, slots_open, coin_cost)
    values (
      v_activity_id,
      (current_date + v_dia) + time '17:00' at time zone 'America/Sao_Paulo',
      v_capacidade, v_matriculados, v_vagas_kidoo, v_custo_coins
    );
  end loop;

  raise notice 'Atividade "%" criada com 7 turmas. Aparece no app e no painel.', v_titulo;
end $$;
