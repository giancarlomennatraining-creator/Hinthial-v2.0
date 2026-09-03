import { defineConfig, devices } from "@playwright/test";

// Loads .env.local (Supabase URL/keys) for the test runner process itself
// --- the webServer child process loads it separately via Next.js. No-op
// if the file doesn't exist yet (Supabase not configured).
if (typeof process.loadEnvFile === "function") {
  try {
    process.loadEnvFile(".env.local");
  } catch {
    // Not configured yet --- tests that need it will fail with a clear
    // Supabase error instead.
  }
}

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  globalTeardown: "./tests/e2e/global-teardown.ts",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // Synthetic camera/mic (a moving color pattern + a tone) with
        // permission auto-granted --- lets e2e tests exercise
        // AudioVideoRecorder (v. capsules) without a real device. Inert
        // for every other test: only takes effect when a page actually
        // calls getUserMedia.
        launchOptions: {
          args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"],
        },
      },
    },
  ],
  webServer: {
    command: "npm run build && npm run start",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
