import { Marca } from './ui';

/**
 * O rodapé, nas duas metades do painel.
 *
 * Só entram destinos que existem. Rodapé de produto novo costuma vir cheio de
 * "Termos", "Privacidade", "Blog" apontando para o nada — e link morto num
 * rodapé é pior do que rodapé curto: quem clica descobre que o resto também
 * pode ser fachada.
 */
export function Rodape({ aoCadastrar, aoEntrar }: { aoCadastrar?: () => void; aoEntrar?: () => void }) {
  return (
    <footer className="rodape">
      <div className="rodape-marca">
        <div>
          <Marca papel="" style={{ padding: 0, marginBottom: 8 }} />
          <p className="rodape-frase">
            Um clube de atividades para crianças. A família assina, a criança experimenta, o
            seu espaço recebe pelas vagas que já existiam.
          </p>
        </div>
      </div>

      {(aoCadastrar || aoEntrar) && (
        <div className="rodape-acoes">
          {aoCadastrar && (
            <button className="btn btn-sm" onClick={aoCadastrar}>
              Cadastrar meu espaço
            </button>
          )}
          {aoEntrar && (
            <button className="btn-link" onClick={aoEntrar}>
              Entrar no painel
            </button>
          )}
        </div>
      )}

      <div className="rodape-fim">
        {/* O ano vem do relógio: rodapé com ano cravado envelhece sozinho e é a
            primeira coisa que denuncia um site abandonado. */}
        <span className="faint">© {new Date().getFullYear()} Kidoo · Belo Horizonte</span>
      </div>
    </footer>
  );
}
