import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
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
