import { useState } from 'react';

import { api, type Partner } from '@/api';
import { Card, Erro } from '@/components/ui';

/**
 * Onde o parceiro corrige o endereço e o telefone que a família vê.
 *
 * Os dois já existiam: o formulário de cadastro sempre exigiu rua e telefone.
 * O que faltava era a aprovação copiá-los para o estabelecimento — ficavam
 * parados na linha do pedido, onde nenhuma tela olhava, e o app mostrava só o
 * bairro. Esta tela existe para o depois: mudança de sala, número novo, o
 * complemento que faltou.
 *
 * Só estes dois campos. O selo de verificado não está aqui porque não é do
 * parceiro concedê-lo a si mesmo, e a coordenada não está porque é ela que
 * decide o check-in por proximidade — quem move a própria coordenada move o
 * portão junto. O banco concorda: o `grant` de update em `partners` lista as
 * colunas uma a uma.
 */
export function MeuLocal({ parceiros }: { parceiros: Partner[] }) {
  const [lista, setLista] = useState(parceiros);

  if (lista.length === 0) {
    return (
      <Card>
        <p className="muted">
          Esta conta ainda não administra nenhum estabelecimento. Fale com quem te convidou.
        </p>
      </Card>
    );
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Meu local</h1>
          <p className="page-sub">
            É o que a família vê no app quando toca no nome do seu espaço — e é por aqui que ela
            chega até você.
          </p>
        </div>
      </div>

      <div className="stack">
        {lista.map((parceiro) => (
          <Formulario
            key={parceiro.id}
            parceiro={parceiro}
            aoSalvar={(dados) =>
              setLista((atual) => atual.map((p) => (p.id === parceiro.id ? { ...p, ...dados } : p)))
            }
          />
        ))}
      </div>
    </>
  );
}

function Formulario({
  parceiro,
  aoSalvar,
}: {
  parceiro: Partner;
  aoSalvar: (dados: { address: string | null; phone: string | null }) => void;
}) {
  const [address, setAddress] = useState(parceiro.address ?? '');
  const [phone, setPhone] = useState(parceiro.phone ?? '');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);

  // Comparado com o que está gravado, e não um `sujo` que qualquer tecla liga:
  // quem digita uma letra e apaga não deveria ficar com um botão aceso pedindo
  // para salvar o que não mudou.
  const mudou =
    address.trim() !== (parceiro.address ?? '') || phone.trim() !== (parceiro.phone ?? '');

  async function salvar(evento: React.FormEvent) {
    evento.preventDefault();
    if (!mudou || salvando) return;
    setSalvando(true);
    setErro(null);
    setSalvo(false);
    try {
      const gravado = await api.salvarLocal(parceiro.id, { address, phone });
      aoSalvar(gravado);
      // Os campos passam a refletir o que o banco guardou — que pode não ser o
      // que foi digitado: espaço nas pontas some, e texto em branco vira nada.
      setAddress(gravado.address ?? '');
      setPhone(gravado.phone ?? '');
      setSalvo(true);
    } catch (caught) {
      setErro(caught instanceof Error ? caught.message : 'Não foi possível salvar.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Card>
      <form onSubmit={(e) => void salvar(e)}>
        <h3>{parceiro.name}</h3>
        <p className="faint" style={{ marginTop: 4 }}>
          {parceiro.neighborhood}, {parceiro.city}
        </p>

        <div className="campo" style={{ marginTop: 16 }}>
          <label htmlFor={`endereco-${parceiro.id}`}>Endereço</label>
          <input
            id={`endereco-${parceiro.id}`}
            className="input"
            value={address}
            maxLength={140}
            placeholder="Rua, número, complemento"
            onChange={(e) => {
              setAddress(e.target.value);
              setSalvo(false);
            }}
          />
          <p className="faint" style={{ marginTop: 6 }}>
            A rua como você diria a alguém pelo telefone. O mapa do app não depende deste texto —
            ele abre pela localização que ficou registrada no seu cadastro.
          </p>
        </div>

        <div className="campo" style={{ marginTop: 14 }}>
          <label htmlFor={`telefone-${parceiro.id}`}>Telefone</label>
          <input
            id={`telefone-${parceiro.id}`}
            className="input"
            value={phone}
            maxLength={20}
            inputMode="tel"
            placeholder="(31) 3333-4444"
            onChange={(e) => {
              setPhone(e.target.value);
              setSalvo(false);
            }}
          />
          <p className="faint" style={{ marginTop: 6 }}>
            O telefone do espaço, para a família ligar antes da aula. Não é o seu pessoal.
          </p>
        </div>

        {erro && <Erro>{erro}</Erro>}

        <div className="row" style={{ gap: 12, marginTop: 18, alignItems: 'center' }}>
          <button className="btn" type="submit" disabled={!mudou || salvando}>
            {salvando ? 'Salvando…' : 'Salvar'}
          </button>
          {salvo && !mudou && <span className="faint">Salvo. Já está valendo no app.</span>}
        </div>
      </form>
    </Card>
  );
}
