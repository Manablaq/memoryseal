import { defineConfig, devices } from "@playwright/test";

const rawPort = process.env.MEMORYSEAL_E2E_PORT ?? "3107";
const e2ePort = Number.parseInt(rawPort, 10);

if (
  !Number.isInteger(e2ePort) ||
  String(e2ePort) !== rawPort ||
  e2ePort < 1024 ||
  e2ePort > 65535
) {
  throw new Error(
    `Invalid MEMORYSEAL_E2E_PORT: ${JSON.stringify(rawPort)}`,
  );
}

const e2eHost = "127.0.0.1";
const e2eBaseUrl = `http://${e2eHost}:${e2ePort}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: true,
  retries: 0,
  reporter: "line",
  use: {
    baseURL: e2eBaseUrl,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command:
      `npm run dev -- --hostname ${e2eHost} --port ${e2ePort}`,
    url: e2eBaseUrl,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
