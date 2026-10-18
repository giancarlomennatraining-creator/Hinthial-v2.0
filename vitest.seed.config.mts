import { fileURLToPath } from "node:url";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

// Semina dei profili demo (v. tests/seed/demo.seed.ts): separata dalla suite dei test, che non deve mai scrivere sul
// database. Carica .env.local per le chiavi di Supabase, come fa Next.js per l'app. Ambiente "node": la cifratura è la
// Web Crypto nativa, e le parti che nel browser leggono PDF o disegnano su canvas sono sostituite (v. demo.seed.ts).
export default defineConfig(({ mode }) => {
  Object.assign(process.env, loadEnv(mode, process.cwd(), ""));

  return {
    test: {
      environment: "node",
      include: ["tests/seed/**/*.seed.ts"],
      globals: true,
      testTimeout: 30 * 60 * 1000,
      hookTimeout: 30 * 60 * 1000,
    },
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
  };
});
