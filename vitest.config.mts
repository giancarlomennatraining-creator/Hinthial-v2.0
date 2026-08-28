import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

export default defineConfig(({ mode }) => {
  // Loads .env.local (and friends) into process.env for tests --- e.g.
  // the RLS integration test needs NEXT_PUBLIC_SUPABASE_URL and friends.
  // Mirrors what Next.js does automatically for the app itself.
  Object.assign(process.env, loadEnv(mode, process.cwd(), ""));

  return {
    plugins: [react()],
    test: {
      environment: "jsdom",
      include: ["tests/unit/**/*.test.{ts,tsx}"],
      setupFiles: ["./tests/unit/setup.ts"],
      globals: true,
    },
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
  };
});
