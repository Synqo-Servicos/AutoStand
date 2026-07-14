import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      // `server-only` é um marker package que o Next resolve em build time
      // (para `empty.js` em contexto de servidor). Fora do bundler ele não
      // existe, então módulos "server-only" quebrariam ao serem importados
      // por um teste. Testes rodam em Node = contexto de servidor, então
      // apontar para o mesmo `empty.js` é a resolução fiel.
      "server-only": path.resolve(
        __dirname,
        "node_modules/next/dist/compiled/server-only/empty.js",
      ),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Cada teste só toca funções puras — não precisa de mock de DB nem
    // setup global. Se aparecer DB no futuro, isolar via "happy-dom" +
    // libsql in-memory.
  },
});
