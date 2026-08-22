import { defineConfig } from "@playwright/test";

/**
 * Pinned to the Chromium already on this machine; the bundled version the test
 * runner wants isn't downloadable here.
 */
const CHROMIUM = process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const PORT = 3100;

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "off",
    launchOptions: { executablePath: CHROMIUM },
  },
  /**
   * The suite runs its own server on its own port, so it never depends on
   * whatever a developer happens to have running, and never fights it for 3000.
   *
   * ANTHROPIC_API_KEY is deliberately blanked: these tests cover the UI flows
   * and the way every AI feature degrades when no key is present. Real scoring
   * is verified by `npm run ai:calibrate`, which measures it against actual
   * reader scores rather than asserting it returned something.
   */
  webServer: {
    command: `npm run dev -- --port ${PORT}`,
    port: PORT,
    reuseExistingServer: false,
    timeout: 120_000,
    env: { ANTHROPIC_API_KEY: "" },
  },
});
