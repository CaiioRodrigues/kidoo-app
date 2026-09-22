import { DOCUMENTOS, type Bloco, type DocumentoId } from '@shared/documentos';

/**
 * Termos de Uso e Política de Privacidade, na web.
 *
 * Existe porque a loja exige **URL**, não tela: o formulário de publicação do
 * Google Play e da App Store tem um campo de endereço da política de
 * privacidade, e ele precisa abrir para quem não tem conta nem aplicativo.
 *
 * O texto vem de `shared/documentos.ts`, o mesmo arquivo que o app renderiza.
 * Escrever duas vezes é como as duas versões passam a divergir — e divergir
 * aqui significa a família ter aceitado uma coisa e a loja publicar outra.
 *
 * Sem login e antes de qualquer outra coisa no `App`: um documento que só
 * abre depois de entrar não serve para o fim que ele tem.
 */
export function Documento({ id }: { id: DocumentoId }) {
  const documento = DOCUMENTOS[id];
  const outro: DocumentoId = id === 'termos' ? 'privacidade' : 'termos';

  return (
    <div className="doc">
      <article className="doc-folha">
        <p className="doc-marca">Kidoo</p>
        <h1>{documento.titulo}</h1>
        <p className="doc-resumo">{documento.resumo}</p>
        <p className="faint">Atualizado em {documento.atualizadoEm}</p>

        {documento.secoes.map((secao) => (
          <section key={secao.titulo}>
            <h2>{secao.titulo}</h2>
            {secao.blocos.map((bloco, i) => (
              <BlocoDoTexto key={i} bloco={bloco} />
            ))}
          </section>
        ))}

        <hr />
        <p>
          <a href={`/${outro}`}>{DOCUMENTOS[outro].titulo}</a>
          {' · '}
          <a href="/">Voltar ao Kidoo</a>
        </p>
      </article>
    </div>
  );
}

function BlocoDoTexto({ bloco }: { bloco: Bloco }) {
  if (bloco.tipo === 'p') return <p>{bloco.texto}</p>;
  return (
    <ul>
      {bloco.itens.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}
