import { fileURLToPath } from "node:url";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

// Configurazione della misura della lettura (v. evals/run.eval.ts): separata da quella dei test, che non deve mai
// chiamare servizi esterni. Carica .env.local per la chiave del motore, come fa Next.js per l'app.
export default defineConfig(({ mode }) => {
  Object.assign(process.env, loadEnv(mode, process.cwd(), ""));

  return {
    test: {
      environment: "node",
      include: ["evals/**/*.eval.ts"],
      globals: true,
    },
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
  };
});
