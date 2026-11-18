import { defineConfig } from '@playwright/test';

// Browser tests of the finished build. Uses the Chrome already on the computer
// or on GitHub's test machines, so no extra browser is downloaded.
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4173',
    channel: 'chrome',
    viewport: { width: 390, height: 844 },
    serviceWorkers: 'block',
  },
  webServer: { command: 'npm run preview -- --port 4173 --strictPort', url: 'http://localhost:4173', reuseExistingServer: !process.env.CI },
});
