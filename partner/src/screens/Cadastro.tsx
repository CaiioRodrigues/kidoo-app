import { useRef, useState } from 'react';

import { api, type NovoPedido, type Pedido } from '@/api';
import { MapaDoEspaco } from '@/components/MapaDoEspaco';
import { Card, Erro, useDados } from '@/components/ui';
import type { ActivityCategoryId } from '@app/types/domain';

/**
 * O cadastro do estabelecimento.
 *
 * Três telas na mesma rota, porque são três momentos da mesma conversa:
 * o formulário, a espera, e a recusa com o caminho de volta. Separá-las em
 * rotas faria alguém chegar por link na tela errada do próprio pedido.
 *
 * O que NÃO se pede aqui: o valor do repasse. Quem define é o Kidoo, na
 * aprovação — deixar o candidato sugerir seria deixá-lo emitir a própria nota.
 */
export function Cadastro({ aoEnviar }: { aoEnviar: () => void }) {
  const { dado: pedido, carregando } = useDados(() => api.meuPedido(), []);

  if (carregando && !pedido) {
    return (
      <Card>
        <p className="muted">Carregando seu cadastro…</p>
      </Card>
    );
  }

  if (pedido?.status === 'pendente') return <EmAnalise pedido={pedido} />;

  return (
    <Formulario
      recusado={pedido?.status === 'recusado' ? pedido : null}
      aoEnviar={aoEnviar}
    />
  );
}

function EmAnalise({ pedido }: { pedido: Pedido }) {
  return (
    <Card>
      <h2>Seu cadastro está em análise</h2>
      <p className="muted" style={{ marginTop: 8, maxWidth: 620 }}>
        Recebemos o pedido do <strong>{pedido.name}</strong>. Alguém do Kidoo confere os dados e
        o endereço antes de liberar — é o que faz o selo de parceiro verificado significar
        alguma coisa para as famílias.
      </p>
      <p className="faint" style={{ marginTop: 14 }}>
        Enviado em {new Date(pedido.createdAt).toLocaleDateString('pt-BR')} · Assim que for
        aprovado, este mesmo login abre o painel com a sua agenda.
      </p>
    </Card>
  );
}

const IDADE_MIN = 0;
const IDADE_MAX = 17;

function Formulario({
  recusado,
  aoEnviar,
}: {
  recusado: Pedido | null;
  aoEnviar: () => void;
}) {
  const { dado: categorias } = useDados(() => api.categorias(), []);

  const [form, setForm] = useState<NovoPedido>(() => ({
    name: recusado?.name ?? '',
    neighborhood: recusado?.neighborhood ?? '',
    city: recusado?.city ?? '',
    address: recusado?.address ?? '',
    latitude: recusado?.latitude ?? 0,
    longitude: recusado?.longitude ?? 0,
    phone: recusado?.phone ?? '',
    categories: recusado?.categories ?? [],
    minAge: recusado?.minAge ?? 4,
    maxAge: recusado?.maxAge ?? 12,
    photoPath: recusado?.photoPath ?? null,
    legalName: recusado?.legalName ?? '',
    cnpj: recusado?.cnpj ?? '',
    pixKey: recusado?.pixKey ?? '',
  }));
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [subindoFoto, setSubindoFoto] = useState(false);
  const entradaFoto = useRef<HTMLInputElement>(null);

  const muda = <K extends keyof NovoPedido>(campo: K, valor: NovoPedido[K]) =>
    setForm((atual) => ({ ...atual, [campo]: valor }));

  const temCoordenada = form.latitude !== 0 || form.longitude !== 0;

  const escolherFoto = async (arquivo: File | undefined) => {
    if (!arquivo) return;
    if (arquivo.size > 5 * 1024 * 1024) {
      setErro('A foto passa de 5 MB. Escolha uma menor.');
      return;
    }
    setSubindoFoto(true);
    setErro(null);
    try {
      muda('photoPath', await api.subirFotoDoPedido(arquivo));
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível enviar a foto.');
    } finally {
      setSubindoFoto(false);
      if (entradaFoto.current) entradaFoto.current.value = '';
    }
  };

  const alternarCategoria = (id: ActivityCategoryId) =>
    setForm((atual) => ({
      ...atual,
      categories: atual.categories.includes(id)
        ? atual.categories.filter((c) => c !== id)
        : [...atual.categories, id],
    }));

  const faltando =
    !form.name.trim() ||
    !form.address.trim() ||
    !form.neighborhood.trim() ||
    !form.city.trim() ||
    !form.phone.trim() ||
    form.categories.length === 0 ||
    !temCoordenada;

  const enviar = async () => {
    setEnviando(true);
    setErro(null);
    try {
      await api.enviarPedido(form, recusado?.id);
      aoEnviar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível enviar seu cadastro.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <>
      {/*
        A recusa vem antes do formulário, e com o motivo em cima: sem ele o
        candidato reenvia exatamente o mesmo pedido, e quem analisa recusa o
        mesmo pedido de novo. O formulário já vem preenchido com o que ele
        mandou — corrigir uma linha não pode custar digitar tudo de novo.
      */}
      {recusado && (
        <Card>
          <h3 style={{ marginBottom: 6 }}>Seu cadastro precisa de um ajuste</h3>
          <div className="alert alert-erro" role="status">
            {recusado.reason ?? 'Sem motivo informado.'}
          </div>
          <p className="faint" style={{ marginTop: 12 }}>
            Corrija abaixo e envie de novo — os dados que você já preencheu estão aqui.
          </p>
        </Card>
      )}

      <Card>
        <h2 style={{ marginBottom: 4 }}>Cadastre seu estabelecimento</h2>
        <p className="faint" style={{ marginBottom: 20, maxWidth: 640 }}>
          Conte onde fica e o que você oferece. Alguém do Kidoo confere antes de liberar — é o
          que faz "parceiro verificado" valer alguma coisa para quem vai deixar uma criança aí.
        </p>

        <div className="cadastro-grade">
          <div className="field span-2">
            <label htmlFor="nome">Nome do espaço</label>
            <input id="nome" className="input" value={form.name} maxLength={80}
                   placeholder="Academia Arena Kids"
                   onChange={(e) => muda('name', e.target.value)} />
          </div>

          <div className="field span-2">
            <label htmlFor="endereco">Endereço</label>
            <input id="endereco" className="input" value={form.address} maxLength={140}
                   placeholder="Rua das Palmeiras, 240"
                   onChange={(e) => muda('address', e.target.value)} />
            <span className="faint">Buscar pelo CEP, ali embaixo, preenche este e os dois
              seguintes.</span>
          </div>

          <div className="field">
            <label htmlFor="bairro">Bairro</label>
            <input id="bairro" className="input" value={form.neighborhood} maxLength={60}
                   onChange={(e) => muda('neighborhood', e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="cidade">Cidade</label>
            <input id="cidade" className="input" value={form.city} maxLength={60}
                   onChange={(e) => muda('city', e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="telefone">Telefone</label>
            <input id="telefone" className="input" value={form.phone} maxLength={20}
                   placeholder="(31) 99999-0000"
                   onChange={(e) => muda('phone', e.target.value)} />
          </div>
        </div>

        <div className="cadastro-secao">
          <strong>Onde fica</strong>
          <p className="faint" style={{ margin: '4px 0 14px', maxWidth: 640 }}>
            É deste ponto que sai a distância que a família vê — e o check-in só libera perto
            dele. Busque pelo CEP e <strong>toque no mapa</strong> para marcar a porta do seu
            espaço (o alfinete também arrasta, para ajustar).
          </p>
          {/*
            O alfinete é a fonte da verdade, e não a leitura do aparelho. Num
            computador de recepção o GPS do navegador vem do Wi-Fi ou do IP e
            erra por centenas de metros — com um portão de 250 m, isso faria
            toda família chegar no local e ouvir "você ainda não chegou".
          */}
          <MapaDoEspaco
            latitude={form.latitude}
            longitude={form.longitude}
            aoMover={(lat, lng) =>
              setForm((atual) => ({ ...atual, latitude: lat, longitude: lng }))
            }
            aoAcharEndereco={(e) =>
              setForm((atual) => ({
                ...atual,
                // O número da rua o CEP não traz: preservamos o que ele já
                // digitou em vez de apagar por cima.
                address: atual.address.trim() || e.address,
                neighborhood: e.neighborhood,
                city: e.city,
              }))
            }
          />
        </div>

        <div className="cadastro-secao">
          <strong>O que você oferece</strong>
          <p className="faint" style={{ margin: '4px 0 12px' }}>
            Escolha as modalidades. Cada uma vira uma atividade no seu painel depois da
            aprovação.
          </p>
          <div className="dias" role="group" aria-label="Modalidades">
            {categorias?.map((c) => (
              <button key={c.id} type="button" className="chip-modalidade"
                      aria-pressed={form.categories.includes(c.id)}
                      onClick={() => alternarCategoria(c.id)}>
                <span aria-hidden="true">{c.emoji}</span> {c.label}
              </button>
            ))}
          </div>

          <div className="row" style={{ gap: 12, marginTop: 16, flexWrap: 'wrap' }}>
            <div className="field" style={{ width: 150 }}>
              <label htmlFor="idade-min">Idade mínima</label>
              <input id="idade-min" className="input" type="number" min={IDADE_MIN} max={IDADE_MAX}
                     value={form.minAge}
                     onChange={(e) => muda('minAge', Number(e.target.value))} />
            </div>
            <div className="field" style={{ width: 150 }}>
              <label htmlFor="idade-max">Idade máxima</label>
              <input id="idade-max" className="input" type="number" min={IDADE_MIN} max={IDADE_MAX}
                     value={form.maxAge}
                     onChange={(e) => muda('maxAge', Number(e.target.value))} />
            </div>
          </div>
        </div>

        <div className="cadastro-secao">
          <strong>Uma foto do espaço</strong>
          <p className="faint" style={{ margin: '4px 0 12px', maxWidth: 620 }}>
            Serve para quem analisa conhecer o lugar. A imagem que a família vê no app você
            escolhe depois, por atividade, no painel.
          </p>
          <input ref={entradaFoto} type="file" accept="image/jpeg,image/png,image/webp"
                 style={{ display: 'none' }}
                 onChange={(e) => void escolherFoto(e.target.files?.[0])} />
          <div className="row" style={{ gap: 10 }}>
            <button type="button" className="btn btn-secundario" disabled={subindoFoto}
                    onClick={() => entradaFoto.current?.click()}>
              {subindoFoto ? 'Enviando…' : form.photoPath ? 'Trocar foto' : 'Escolher foto'}
            </button>
            {form.photoPath && <span className="badge badge-ok">Foto enviada</span>}
          </div>
        </div>

        <div className="cadastro-secao">
          <strong>Dados para o repasse</strong>
          <p className="faint" style={{ margin: '4px 0 12px', maxWidth: 620 }}>
            Opcional agora, e guardado para quando o pagamento existir. Pedir cedo evita ter que
            voltar em todo mundo depois.
          </p>
          <div className="cadastro-grade">
            <div className="field span-2">
              <label htmlFor="razao">Razão social</label>
              <input id="razao" className="input" value={form.legalName ?? ''} maxLength={120}
                     onChange={(e) => muda('legalName', e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="cnpj">CNPJ</label>
              <input id="cnpj" className="input mono" value={form.cnpj ?? ''} maxLength={20}
                     placeholder="00.000.000/0001-00"
                     onChange={(e) => muda('cnpj', e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="pix">Chave Pix</label>
              <input id="pix" className="input" value={form.pixKey ?? ''} maxLength={80}
                     onChange={(e) => muda('pixKey', e.target.value)} />
            </div>
          </div>
        </div>

        {erro && (
          <div style={{ marginTop: 16 }}>
            <Erro>{erro}</Erro>
          </div>
        )}

        <div className="row" style={{ marginTop: 20, gap: 12, flexWrap: 'wrap' }}>
          <button className="btn" disabled={faltando || enviando} onClick={() => void enviar()}>
            {enviando ? 'Enviando…' : recusado ? 'Enviar correção' : 'Enviar cadastro'}
          </button>
          {faltando && (
            <span className="faint">
              Falta preencher nome, endereço, bairro, cidade, telefone, ao menos uma modalidade
              e a localização.
            </span>
          )}
        </div>
      </Card>
    </>
  );
}
