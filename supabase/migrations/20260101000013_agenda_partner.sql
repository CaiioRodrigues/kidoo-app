-- De qual estabelecimento é cada turma.
--
-- O painel se apresenta como UM estabelecimento — "Hoje no seu espaço", o nome
-- no rodapé —, mas `partner_agenda` sempre devolveu as turmas de todos os
-- parceiros que a conta administra, porque é isso que `is_partner_member`
-- responde. Enquanto cada conta cuidava de um lugar só, a diferença não
-- aparecia.
--
-- Ela apareceu no teste de GPS: cinco parceiros de teste na mesma conta, três
-- turmas cada, todos com nomes quase iguais. A tela virou quinze linhas
-- indistinguíveis, e abrir vaga na turma errada não dá erro nenhum — a família
-- fica esperando um aviso que nunca sai, e o silêncio parece defeito do push.
--
-- A correção não é filtrar por um parceiro só: a conta administra os cinco de
-- verdade, e esconder quatro seria mentir na direção contrária. É **dizer de
-- quem é cada turma**, e deixar a tela mostrar isso quando houver mais de um.
--
-- `drop` antes de `create` porque mudar as colunas de retorno de uma função
-- `returns table` não é substituição, é outra assinatura.
drop function if exists partner_agenda(timestamptz, timestamptz);

create or replace function partner_agenda(p_from timestamptz, p_to timestamptz)
returns table (
  session_id     uuid,
  activity_id    uuid,
  activity_title text,
  category_id    text,
  partner_id     uuid,
  partner_name   text,
  starts_at      timestamptz,
  capacity       smallint,
  enrolled       smallint,
  slots_open     smallint,
  slots_taken    smallint,
  kind           slot_kind,
  coin_cost      smallint,
  checked_in     bigint,
  confirmed      bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select s.id, a.id, a.title, a.category_id, p.id, p.name, s.starts_at,
         s.capacity, s.enrolled, s.slots_open, s.slots_taken, s.kind, s.coin_cost,
         count(*) filter (where b.status in ('checked_in','completed')),
         count(*) filter (where b.partner_confirmed_at is not null)
    from class_sessions s
    join activities a on a.id = s.activity_id
    join partners   p on p.id = a.partner_id
    left join bookings b on b.session_id = s.id and b.status <> 'cancelled'
   where is_partner_member(a.partner_id)
     and s.starts_at >= p_from and s.starts_at < p_to
   group by s.id, a.id, a.title, a.category_id, p.id, p.name, s.starts_at,
            s.capacity, s.enrolled, s.slots_open, s.slots_taken, s.kind, s.coin_cost
   order by s.starts_at;
$$;

grant execute on function partner_agenda(timestamptz, timestamptz) to authenticated;
