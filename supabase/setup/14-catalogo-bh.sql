-- =====================================================================
-- Kidoo — tira os parceiros de teste de GPS e põe um catálogo de BH.
--
-- Rode uma vez, no SQL Editor. Ele é idempotente: rodar duas vezes não
-- duplica nada.
--
-- **Os nomes são inventados.** Nenhum destes estabelecimentos existe, e
-- isso é de propósito: pôr no app o nome de uma academia de verdade que
-- não combinou nada com você faria o Kidoo anunciar vaga em nome de
-- quem nunca concordou — e é a família que apareceria na porta.
--
-- Os bairros e as coordenadas são reais, porque é deles que sai a
-- distância no app e o portão do check-in. Você quer testar "perto de
-- mim" com distâncias que fazem sentido para quem mora em BH.
--
-- **Ninguém administra estes parceiros.** Eles não têm vínculo com
-- nenhuma conta, então não aparecem no seu painel — que continua sendo o
-- do seu estabelecimento de verdade. Eles existem para o app das
-- famílias ter o que mostrar.
-- =====================================================================

begin;

-- ------------------------------------------------------- fora os testes ---
-- `on delete cascade` leva junto atividades, turmas, repasses e vínculos.
-- As reservas que existirem nessas turmas vão junto: são de teste também.
delete from partners where name like 'Teste GPS%';

-- ------------------------------------------------------------ o catálogo ---
do $$
declare
  v_lugar record;
  v_ativ  record;
  v_pid   uuid;
  v_aid   uuid;
  v_dia   int;
  v_data  timestamptz;
begin
  for v_lugar in
    select * from (values
      -- nome (inventado)          bairro            lat          lng
      ('Arena Buritis Kids',       'Buritis',        -19.9702, -43.9803),
      ('Espaço Movimento Savassi', 'Savassi',        -19.9386, -43.9339),
      ('Clube da Lagoa',           'Pampulha',       -19.8551, -43.9797),
      ('Vila Esportiva Sion',      'Sion',           -19.9520, -43.9330),
      ('Ateliê Cidade Nova',       'Cidade Nova',    -19.8890, -43.9210),
      ('Quadra Santo Antônio',     'Santo Antônio',  -19.9483, -43.9430),
      ('Centro Castelo Ativo',     'Castelo',        -19.8890, -43.9760),
      ('Ginásio Barreiro',         'Barreiro',       -19.9760, -44.0270)
    ) as t(nome, bairro, lat, lng)
  loop
    -- `where not exists` em vez de `on conflict`: `partners` não tem chave
    -- única no nome, e criar uma agora quebraria quem já tem dois espaços
    -- com o mesmo nome em bairros diferentes.
    select id into v_pid from partners where name = v_lugar.nome;
    if v_pid is null then
      insert into partners (name, neighborhood, city, verified, latitude, longitude)
      values (v_lugar.nome, v_lugar.bairro, 'Belo Horizonte', true, v_lugar.lat, v_lugar.lng)
      returning id into v_pid;
    end if;

    -- O repasse padrão da casa, o mesmo que a aprovação de um pedido aplica.
    insert into payout_rates (partner_id, kind, amount_cents) values
      (v_pid, 'ociosa', 800), (v_pid, 'cheia', 1800)
    on conflict (partner_id, kind) do nothing;

    perform set_config('kidoo.pid', v_pid::text, false);
  end loop;

  -- ---------------------------------------------------------- atividades ---
  for v_ativ in
    select * from (values
      -- parceiro                   categoria    título                        idades   lotação  matric  vagas  coins  horários (dia da semana:hora)
      ('Arena Buritis Kids',        'futebol',   'Futebol Kids',                 5, 10,   20, 11,  5, 2, array['2:18','4:18','6:09']),
      ('Arena Buritis Kids',        'volei',     'Vôlei Iniciante',              9, 13,   16,  6,  4, 3, array['3:19','5:19']),
      ('Espaço Movimento Savassi',  'ginastica', 'Ginástica Divertida',          3,  7,   12,  4,  4, 3, array['2:09','4:09','6:16']),
      ('Espaço Movimento Savassi',  'danca',     'Ballet para Pequenos',         4,  9,   14,  9,  3, 2, array['3:17','5:17']),
      ('Clube da Lagoa',            'natacao',   'Natação Infantil',             4, 12,   10,  6,  3, 3, array['2:08','4:08','6:10']),
      ('Clube da Lagoa',            'futebol',   'Escolinha de Futebol',         6, 12,   24, 15,  6, 2, array['3:18','5:18']),
      ('Vila Esportiva Sion',       'judo',      'Judô para Pequenos',           5, 11,   14,  8,  4, 3, array['2:17','4:17']),
      ('Vila Esportiva Sion',       'basquete',  'Basquete de Base',             9, 14,   18,  7,  5, 3, array['3:19','6:11']),
      ('Ateliê Cidade Nova',        'artes',     'Ateliê de Artes',              4, 11,   12,  5,  4, 2, array['2:15','4:15','6:14']),
      ('Quadra Santo Antônio',      'futebol',   'Futebol de Sábado',            7, 13,   22, 18,  4, 2, array['6:08','6:10']),
      ('Centro Castelo Ativo',      'tenis',     'Mini Tênis',                   6, 11,    8,  3,  4, 4, array['3:16','5:16']),
      ('Centro Castelo Ativo',      'ginastica', 'Ginástica Artística',          7, 13,   14,  9,  3, 3, array['2:19','4:19']),
      ('Ginásio Barreiro',          'natacao',   'Natação de Base',              5, 12,   12,  4,  5, 3, array['2:10','4:10']),
      ('Ginásio Barreiro',          'danca',     'Dança Livre',                  6, 12,   20, 13,  5, 2, array['5:18','6:15'])
    ) as t(parceiro, categoria, titulo, idade_min, idade_max,
           lotacao, matriculados, vagas, coins, horarios)
  loop
    select id into v_pid from partners where name = v_ativ.parceiro;
    if v_pid is null then continue; end if;

    select id into v_aid from activities
     where partner_id = v_pid and title = v_ativ.titulo;
    if v_aid is null then
      insert into activities (partner_id, category_id, title, min_age, max_age, description, tags)
      values (v_pid, v_ativ.categoria, v_ativ.titulo, v_ativ.idade_min, v_ativ.idade_max,
              'Turma recreativa, com foco em movimento, convivência e diversão.',
              array['recreativa'])
      returning id into v_aid;
    end if;

    -- Duas semanas de turmas, nos dias da semana que a atividade acontece.
    -- Duas semanas porque é a janela que a tira de dias do app mostra.
    for v_dia in 0..13 loop
      declare
        v_hoje date := current_date + v_dia;
        v_dow  int  := extract(dow from current_date + v_dia);
        v_h    text;
      begin
        foreach v_h in array v_ativ.horarios loop
          if split_part(v_h, ':', 1)::int = v_dow then
            v_data := (v_hoje + (split_part(v_h, ':', 2) || ':00')::time)
                        at time zone 'America/Sao_Paulo';
            -- Turma que já começou não interessa a ninguém, e a visão do app
            -- já a esconderia — mas gravá-la sujaria a agenda do parceiro.
            if v_data > now() and not exists (
              select 1 from class_sessions
               where activity_id = v_aid and starts_at = v_data
            ) then
              insert into class_sessions
                (activity_id, starts_at, capacity, enrolled, slots_open, coin_cost)
              values (v_aid, v_data, v_ativ.lotacao, v_ativ.matriculados,
                      v_ativ.vagas, v_ativ.coins);
            end if;
          end if;
        end loop;
      end;
    end loop;
  end loop;
end $$;

commit;

-- =====================================================================
-- O que ficou no ar.
-- =====================================================================
select p.neighborhood as bairro,
       p.name         as estabelecimento,
       count(distinct a.id) as atividades,
       count(s.id)          as turmas_futuras,
       sum(s.slots_open - s.slots_taken) as vagas_abertas
  from partners p
  join activities a on a.partner_id = p.id
  left join class_sessions s on s.activity_id = a.id and s.starts_at > now()
 where p.city = 'Belo Horizonte'
 group by p.neighborhood, p.name
 order by p.neighborhood;
