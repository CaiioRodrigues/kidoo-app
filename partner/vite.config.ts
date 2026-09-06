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
  server: { port: 5273 },
});
