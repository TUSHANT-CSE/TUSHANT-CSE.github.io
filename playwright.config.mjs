import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './test',
  testMatch: 'browser.spec.mjs',
  timeout: 30000,
  workers: 1,
  reporter: 'list',
  outputDir: './test-results',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    channel: 'msedge',
    viewport: { width:1440, height:1000 },
    reducedMotion: 'reduce',
    headless: true,
  },
  webServer: {
    command: 'node scripts/site.mjs serve',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 15000,
  },
});
