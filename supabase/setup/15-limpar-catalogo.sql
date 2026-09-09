-- =====================================================================
-- Kidoo — tirar da base todo estabelecimento que não é de verdade.
--
-- Apaga os parceiros que entraram por script — os `Teste GPS%` e o
-- catálogo inventado de BH — e deixa só quem tem dono: um parceiro com
-- vínculo em `partner_members` nasceu de um cadastro real, seu ou de
-- alguém que você aprovou.
--
-- É esse o critério, e não uma lista de nomes: uma lista envelhece no
-- dia em que você inventar o nono estabelecimento de teste. "Tem dono"
-- não envelhece.
--
-- Cole INTEIRO no SQL Editor. Rodar duas vezes não faz mal.
-- =====================================================================

begin;

-- Reserva sai à mão, e o banco obriga: `bookings` aponta para as turmas com
-- `on delete restrict` porque reserva é registro financeiro — é sobre ela que
-- o repasse é calculado. Aqui são reservas de teste, contra estabelecimentos
-- que nunca existiram.
delete from bookings
 where activity_id in (
   select a.id from activities a
     join partners p on p.id = a.partner_id
    where not exists (select 1 from partner_members m where m.partner_id = p.id)
 );

-- O resto cai por cascade: atividades, turmas, repasses e filas de espera.
delete from partners p
 where not exists (select 1 from partner_members m where m.partner_id = p.id);

commit;

-- =====================================================================
-- Quem ficou — e de quem é.
-- =====================================================================
select p.name as estabelecimento,
       p.neighborhood as bairro,
       u.email as dono,
       count(distinct a.id) as atividades,
       count(s.id) filter (where s.starts_at > now()) as turmas_futuras
  from partners p
  join partner_members m on m.partner_id = p.id
  join auth.users u on u.id = m.user_id
  left join activities a on a.partner_id = p.id
  left join class_sessions s on s.activity_id = a.id
 group by p.name, p.neighborhood, u.email
 order by p.name;
