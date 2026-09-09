import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const apontaParaOBanco = Boolean(env.VITE_SUPABASE_URL && env.VITE_SUPABASE_ANON_KEY);

  /*
    Publicar sem as variáveis não dá erro: dá um painel em modo demonstração,
    com turmas, famílias e repasses inventados — e que parece de verdade. Um
    parceiro confirmaria presença de criança que não existe e conferiria um
    extrato que não é dele, sem nada na tela gritando.

    Por isso a build de produção para aqui. Quem quer mesmo a demonstração
    (para revisar telas, como este repositório faz) pede por escrito:
    `npm run build:demo`.
  */
  if (command === 'build' && !apontaParaOBanco && env.VITE_DEMO !== '1') {
    throw new Error(
      'Faltam VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.\n' +
        'Sem elas o painel publicado roda com dados fictícios que parecem reais.\n' +
        'Defina as duas no host (Vercel/Netlify/Cloudflare) ou num .env,\n' +
        'ou rode `npm run build:demo` se a demonstração for mesmo o que você quer.',
    );
  }

  return {
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // O painel e o app compartilham o domínio: `ClassSession`, `SlotKind`, a
      // curva de níveis. É um repositório só justamente para isso — se o tipo
      // fosse copiado, uma mudança no app só apareceria aqui quando quebrasse.
      '@app': fileURLToPath(new URL('../src', import.meta.url)),
    },
  },
  server: {
    port: 5273,
    // `host: true` publica o servidor na rede local, e não só em localhost.
    // É o que permite abrir o painel no celular — necessário para testar o
    // ciclo real: check-in no aparelho, confirmação no painel. O Metro do
    // Expo já faz o mesmo, pelo mesmo motivo.
    //
    // Vale só em desenvolvimento, e só para quem está na sua rede. Em
    // produção o painel é um site publicado, não este servidor.
    host: true,
  },
  };
});
