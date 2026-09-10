import { defineConfig } from "@playwright/test";

/**
 * End-to-end wallet tests. They need a local anvil with the contracts deployed
 * (`npm run chain` then `npm run deploy:local`) — `npm run test:e2e` does both for you.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: process.env.CI ? "list" : [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3100",
    trace: "retain-on-failure",
  },
  webServer: {
    // Production build, not `next dev`: it is what ships, and it keeps HMR out of the way.
    command: "npm run build && npm run start -- --port 3100",
    url: "http://localhost:3100/app",
    // Never reuse: the server inlines NEXT_PUBLIC_RPC_URL at build time, so a leftover server from
    // an earlier run would keep pointing the UI at a chain these tests no longer own.
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
