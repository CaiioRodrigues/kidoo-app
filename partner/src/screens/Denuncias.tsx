import { useState } from 'react';

import { api, type DenunciaNaFila, type MotivoDaDenuncia } from '@/api';
import { Card, Erro, Vazio, useDados } from '@/components/ui';

/**
 * As denúncias que as famílias mandaram.
 *
 * Existe porque a fila de capas (000028) não cobre tudo: a capa publicada
 * antes de ela existir, e o julgamento que erra — quem analisa é gente, e vê
 * uma imagem por segundo.
 *
 * Denúncia de imagem chega com a capa JÁ FORA DO AR. Esta tela não decide se
 * esconde; decide se volta.
 */
const ROTULO: Record<MotivoDaDenuncia, string> = {
  imagem: 'Imagem imprópria',
  descricao: 'Descrição não confere',
  seguranca: 'Preocupação de segurança',
  outro: 'Outro motivo',
};

export function Denuncias() {
  const { dado: denuncias, carregando, erro, recarregar } = useDados(
    () => api.denunciasAbertas(),
    [],
  );

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Denúncias</h1>
          <p className="page-sub">
            O que as famílias marcaram como problema. Denúncia de imagem já tirou a capa do ar —
            aqui você decide se ela volta.
          </p>
        </div>
      </div>

      {erro && <Erro>{erro}</Erro>}
      {carregando && !denuncias && (
        <Card>
          <p className="muted">Carregando denúncias…</p>
        </Card>
      )}

      {denuncias && denuncias.length === 0 && (
        <Card>
          <Vazio marca="🏳️">
            <h3>Nenhuma denúncia aberta</h3>
            <p className="muted" style={{ marginTop: 6 }}>
              Quando uma família marcar um problema numa atividade, ele aparece aqui.
            </p>
          </Vazio>
        </Card>
      )}

      <div className="stack">
        {denuncias?.map((d) => (
          <CartaoDaDenuncia key={d.id} denuncia={d} aoResolver={recarregar} />
        ))}
      </div>
    </>
  );
}

function CartaoDaDenuncia({
  denuncia,
  aoResolver,
}: {
  denuncia: DenunciaNaFila;
  aoResolver: () => void;
}) {
  const [nota, setNota] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const resolver = async (restaurar: boolean) => {
    setOcupado(true);
    setErro(null);
    try {
      await api.resolverDenuncia(denuncia.id, restaurar, nota);
      aoResolver();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível resolver agora.');
    } finally {
      setOcupado(false);
    }
  };

  return (
    <section className="card">
      <div className="card-pad">
        <div className="row" style={{ gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
          <h3>{denuncia.activity}</h3>
          <span className="badge badge-espera">{ROTULO[denuncia.reason]}</span>
        </div>
        <p className="faint">
          {denuncia.partner} · {new Date(denuncia.createdAt).toLocaleDateString('pt-BR')}
        </p>

        {denuncia.detail ? (
          <p
            style={{
              margin: '12px 0 0',
              padding: '12px 14px',
              background: 'var(--card-muted)',
              borderRadius: 12,
            }}
          >
            {denuncia.detail}
          </p>
        ) : (
          <p className="faint" style={{ marginTop: 12 }}>
            A família não escreveu nada além do motivo.
          </p>
        )}

        {/* A imagem escondida aparece aqui, e é o ponto inteiro da tela: não dá
            para decidir se ela volta sem olhar para ela. */}
        {denuncia.hiddenUrl ? (
          <div style={{ marginTop: 14 }}>
            <p className="faint" style={{ margin: '0 0 6px', fontSize: 12 }}>
              Capa que saiu do ar
            </p>
            <a href={denuncia.hiddenUrl} target="_blank" rel="noopener noreferrer">
              <img
                src={denuncia.hiddenUrl}
                alt="Capa denunciada"
                style={{
                  width: 260,
                  height: 170,
                  objectFit: 'cover',
                  borderRadius: 10,
                  background: 'var(--card-muted)',
                  display: 'block',
                }}
              />
            </a>
          </div>
        ) : null}

        {erro && (
          <div style={{ marginTop: 12 }}>
            <Erro>{erro}</Erro>
          </div>
        )}

        <div className="field" style={{ marginTop: 14 }}>
          <label htmlFor={`nota-${denuncia.id}`}>Anotação (opcional)</label>
          <input
            id={`nota-${denuncia.id}`}
            className="input"
            maxLength={200}
            placeholder="O que você concluiu"
            value={nota}
            onChange={(e) => setNota(e.target.value)}
          />
        </div>

        <div className="row" style={{ gap: 10, marginTop: 12 }}>
          {denuncia.hiddenUrl ? (
            <button className="btn" disabled={ocupado} onClick={() => void resolver(true)}>
              {ocupado ? 'Aguarde…' : 'A imagem está ok, devolver ao ar'}
            </button>
          ) : null}
          <button className="btn btn-perigo" disabled={ocupado} onClick={() => void resolver(false)}>
            {ocupado
              ? 'Aguarde…'
              : denuncia.hiddenUrl
                ? 'Manter fora do ar'
                : 'Marcar como resolvida'}
          </button>
        </div>
      </div>
    </section>
  );
}
