import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
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
});
