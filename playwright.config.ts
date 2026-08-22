import { defineConfig } from "@playwright/test";

/**
 * Pinned to the Chromium already on this machine; the bundled version the test
 * runner wants isn't downloadable here.
 */
const CHROMIUM = process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

export default defineConfig({
  testDir: "./e2e",
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: process.env.BASE_URL ?? "http://localhost:3000",
    trace: "off",
    launchOptions: { executablePath: CHROMIUM },
  },
});
