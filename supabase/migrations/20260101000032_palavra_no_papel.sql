-- =====================================================================
-- O papel deixa de dizer só um número: passa a dizer uma palavra.
-- =====================================================================
--
-- A 000031 entregou papéis numerados de 1 até o total, e disse, no próprio
-- cabeçalho, o que eles não resolviam: número sequencial não é segredo. Quem
-- tem o link e sabe que a festa tem 60 convidados digita 37 e vota no lugar de
-- quem ainda não votou.
--
-- Agora cada papel recebe um código sorteado — `MORCEGO 84` —, e é ele que a
-- pessoa digita. Adivinhar deixa de ser contar até 60: são 160 palavras vezes
-- 90 duplas de dígitos, e só os papéis entregues valem.
--
-- ------------------------------------------------------- o que não muda ---
--
-- `voter_key` continua sendo o NÚMERO do papel. O código é a prova de que
-- aquele papel é seu, não a identidade — o índice único da 000030, a grade de
-- quem organiza e a apuração seguem iguais. Trocar a identidade obrigaria a
-- mexer nos três, e não havia motivo.
--
-- ------------------------------------------------------- as palavras ------
--
-- Genéricas de propósito, como todo o resto deste schema: bicho, fruta,
-- objeto. A primeira votação é de fantasia, a próxima pode ser de parceiro do
-- ano, e um papel escrito CAVEIRA seria estranho nessa.
--
-- Sem acento e sem espaço no que se compara: o papel mostra `ABÓBORA 12` e
-- quem digita "abobora12", "Abóbora 12" ou "ABOBORA-12" entra do mesmo jeito.
-- Num teclado de celular, às duas da manhã, essa diferença é o suporte
-- técnico da festa inteira.
-- =====================================================================

/**
 * O que sobra de um código depois de tirar o que só atrapalha.
 *
 * Minúscula, sem acento, sem espaço nem traço. É esta forma que é guardada e
 * comparada — o bonito fica no papel.
 */
create or replace function poll_word(p_texto text)
returns text
language sql
immutable
set search_path = public
as $$
  select regexp_replace(
           lower(translate(coalesce(p_texto, ''),
                           'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
                           'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC')),
           '[^a-z0-9]', '', 'g');
$$;

create table if not exists poll_tickets (
  poll_id uuid not null references polls (id) on delete cascade,
  -- O número do papel. É ele que vai para `ballots.voter_key`.
  number  int  not null,
  -- O código normalizado, que é o que se compara.
  word    text not null,
  -- E como ele sai impresso: `MORCEGO 84`.
  label   text not null,
  primary key (poll_id, number),
  -- Dois papéis com o mesmo código seriam duas pessoas com a mesma chave.
  unique (poll_id, word)
);

-- Fechada por ausência, como a `ballots`: o código É o segredo, e uma tabela
-- que o cliente lê é uma tabela que entrega os papéis de todo mundo. Quem
-- organiza chega por função; quem vota nunca chega.
alter table poll_tickets enable row level security;
revoke all on poll_tickets from anon, authenticated;

/**
 * A chave do votante, conferida e normalizada.
 *
 * Três caminhos, nesta ordem:
 *
 *   1. a votação tem papéis com código — o que se digita é o código, e a
 *      chave é o número do papel correspondente;
 *   2. a votação tem faixa numérica e nenhum papel (as criadas antes desta
 *      migration) — vale o número, como valia;
 *   3. nenhum dos dois: a chave é o id que o navegador guarda.
 *
 * O caminho 2 existe porque papel entregue não se recolhe: uma festa que já
 * imprimiu números continua funcionando.
 */
create or replace function poll_voter_key(p_poll_id uuid, p_voter_key text)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_max int;
  v_key text := btrim(coalesce(p_voter_key, ''));
  v_num int;
begin
  if v_key = '' then
    raise exception 'voter_required' using errcode = 'P0001';
  end if;

  if exists (select 1 from poll_tickets where poll_id = p_poll_id) then
    select number into v_num
      from poll_tickets
     where poll_id = p_poll_id and word = poll_word(v_key);
    if not found then
      raise exception 'invalid_ticket' using errcode = 'P0001';
    end if;
    return v_num::text;
  end if;

  select voter_numbers into v_max from polls where id = p_poll_id;
  if v_max is null then
    return v_key;
  end if;

  if v_key !~ '^[0-9]{1,3}$' then
    raise exception 'invalid_number' using errcode = 'P0001';
  end if;
  if v_key::int < 1 or v_key::int > v_max then
    raise exception 'number_out_of_range' using errcode = 'P0001';
  end if;
  return v_key::int::text;
end;
$$;

-- ------------------------------------------------------ o que está no ar --

-- `palavras` diz à tela o que pedir: a palavra do papel, ou o número. Sem
-- isso ela teria de adivinhar pelo formato do que a pessoa digitou.
create or replace function current_poll()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select to_jsonb(p) - 'passphrase' || jsonb_build_object(
           'protegida', p.passphrase is not null,
           'numeros', p.voter_numbers,
           'palavras', exists (select 1 from poll_tickets t where t.poll_id = p.id),
           'categories', coalesce((
             select jsonb_agg(jsonb_build_object('id', c.id, 'label', c.label)
                              order by c.position, c.label)
               from poll_categories c where c.poll_id = p.id), '[]'::jsonb),
           'entries', coalesce((
             select jsonb_agg(jsonb_build_object('id', e.id, 'name', e.name,
                                                 'photoPath', e.photo_path)
                              order by e.created_at)
               from poll_entries e where e.poll_id = p.id), '[]'::jsonb)
         )
    from polls p
   where p.status <> 'rascunho'
   order by p.created_at desc
   limit 1;
$$;

-- -------------------------------------------------------- quem organiza ---

/** Cria a votação, as categorias e os papéis. */
create or replace function create_poll(
  p_title         text,
  p_subtitle      text,
  p_categories    text[],
  p_passphrase    text default null,
  p_voter_numbers int default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  /*
    Genéricas de propósito, e escolhidas para serem ditas em voz alta na porta
    sem soletrar: nada de "exceção", nada de par que se confunde de longe.
  */
  v_palavras text[] := array[
    'abacaxi','abelha','abobora','agulha','alface','ancora','anel','antena','arvore','aviao',
    'balao','baleia','banana','bandeira','barco','batata','bengala','bicicleta','bolacha','bolha',
    'bota','bule','bussola','cacto','cadeira','caixa','caju','caneca','caneta','capacete',
    'caracol','carroca','cascata','castelo','cavalo','cebola','cenoura','cereja','chapeu','chave',
    'chuva','cigarra','coelho','cogumelo','coqueiro','coruja','cristal','dado','damasco','dedal',
    'diamante','dinossauro','elefante','escada','escova','espelho','estrela','farol','feijao','ferradura',
    'figo','flauta','floresta','foguete','folha','formiga','fogueira','fruta','gaivota','galho',
    'garrafa','geleia','girafa','goiaba','guarda','harpa','helice','hipopotamo','ilha','iguana',
    'janela','jabuti','jacare','jasmim','jipe','lagarta','lagoa','lampada','lanterna','laranja',
    'leao','limao','livro','lontra','luneta','maca','machado','manga','mapa','martelo',
    'medalha','melancia','moinho','montanha','morango','mosaico','navio','nuvem','oliveira','onca',
    'orquidea','ostra','pacote','palmeira','pandeiro','panela','papagaio','pataca','pedra','peixe',
    'pena','pepino','pera','pincel','pinheiro','pipa','piranha','planeta','pluma','polvo',
    'pomar','ponte','portao','quadro','queijo','quilha','rabanete','radio','raiz','rede',
    'relogio','remo','rio','roda','rosa','sabia','sanfona','sapato','semente','serra',
    'sino','sofa','tambor','tartaruga','tatu','telhado','tijolo','tomate','trenzinho','tucano',
    'tulipa','uva','vagalume','vaso','vela','vento','vidro','violao','xicara','zebra'
  ];
  v_id  uuid;
  v_cat text;
  v_i   smallint := 0;
begin
  if not is_kidoo_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;
  if coalesce(btrim(p_title), '') = '' then
    raise exception 'title_required' using errcode = 'P0001';
  end if;
  if coalesce(array_length(p_categories, 1), 0) = 0 then
    raise exception 'categories_required' using errcode = 'P0001';
  end if;
  if p_voter_numbers is not null and (p_voter_numbers < 2 or p_voter_numbers > 999) then
    raise exception 'invalid_range' using errcode = 'P0001';
  end if;

  insert into polls (title, subtitle, status, passphrase, voter_numbers)
  values (btrim(p_title), nullif(btrim(coalesce(p_subtitle, '')), ''), 'inscricoes',
          nullif(btrim(coalesce(p_passphrase, '')), ''), p_voter_numbers)
  returning id into v_id;

  foreach v_cat in array p_categories loop
    if btrim(v_cat) <> '' then
      insert into poll_categories (poll_id, label, position)
      values (v_id, btrim(v_cat), v_i);
      v_i := v_i + 1;
    end if;
  end loop;

  if p_voter_numbers is not null then
    /*
      Palavra cruzada com dois dígitos, sorteada do produto inteiro.

      Cruzar antes de sortear, em vez de sortear a palavra e depois o número,
      é o que garante código distinto mesmo numa festa maior que a lista: são
      160 × 90 pares, e o `limit` tira N deles sem repetir o par. Até 160
      convidados nem a palavra se repete.
    */
    insert into poll_tickets (poll_id, number, word, label)
    select v_id,
           row_number() over ()::int,
           poll_word(s.w || s.d::text),
           upper(s.w) || ' ' || s.d::text
      from (
        select w, d
          from unnest(v_palavras) as w
          cross join generate_series(10, 99) as d
         order by random()
         limit p_voter_numbers
      ) s;
  end if;

  return v_id;
end;
$$;

/**
 * Os papéis de uma votação, para quem organiza imprimir e recortar.
 *
 * Só por aqui: a tabela é fechada, porque a lista de códigos é a lista de
 * votos de todo mundo. E vem com `voted`, que é a pergunta que fez o papel
 * existir — quem falta?
 */
create or replace function poll_tickets_admin(p_poll_id uuid)
returns table (number int, label text, voted boolean)
language sql
stable
security definer
set search_path = public
as $$
  select t.number, t.label,
         exists (select 1 from ballots b
                  where b.poll_id = t.poll_id and b.voter_key = t.number::text)
    from poll_tickets t
   where t.poll_id = p_poll_id and is_kidoo_admin()
   order by t.number;
$$;

grant execute on function current_poll()                             to anon, authenticated;
grant execute on function create_poll(text, text, text[], text, int) to authenticated;
grant execute on function poll_tickets_admin(uuid)                   to authenticated;
