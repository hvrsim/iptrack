import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e', fullyParallel: false, workers: 1,
  use: { baseURL: 'http://localhost:4173', headless: true },
  webServer: {
    command: 'IPTRACK_E2E=1 pnpm --filter web exec vite preview --host localhost --port 4173',
    url: 'http://localhost:4173', reuseExistingServer: false, timeout: 60000,
  },
});
