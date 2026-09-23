import { defineConfig, devices } from '@playwright/test';

const TEST_PORT = process.env.PW_PORT || '5178';

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.ts',
  timeout: 30000,
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://localhost:${TEST_PORT}`,
    trace: 'on-first-retry',
    viewport: { width: 1280, height: 720 },
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
  },
  webServer: [
    {
      // E2E_MEMORY_DB=1 levanta el backend con datos en memoria (sin PostgreSQL)
      command: process.env.E2E_MEMORY_DB ? 'node tests/support/memory-server.js' : 'node server/index.js',
      url: 'http://127.0.0.1:3001/api/health',
      reuseExistingServer: !process.env.CI,
      timeout: 60000,
      stdout: 'pipe',
      stderr: 'pipe',
    },
    {
      command: `npx vite --host 0.0.0.0 --port ${TEST_PORT}`,
      url: `http://127.0.0.1:${TEST_PORT}`,
      reuseExistingServer: false,
      timeout: 60000,
      stdout: 'pipe',
      stderr: 'pipe',
    }
  ],
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
