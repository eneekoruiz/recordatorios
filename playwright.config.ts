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
    trace: 'retain-on-failure',
    viewport: { width: 1280, height: 720 },
  },
  webServer: [
    {
      // E2E_MEMORY_DB=1 levanta el backend con datos en memoria (sin PostgreSQL)
      command: process.env.E2E_MEMORY_DB ? 'npx tsx tests/support/memory-server.js' : 'npx tsx server/index.ts',
      url: 'http://127.0.0.1:3001/api/health',
      reuseExistingServer: !process.env.CI,
      timeout: 180000,
      stdout: 'pipe',
      stderr: 'pipe',
    },
    {
      command: process.env.PW_DEV_SERVER === '1'
        ? `npx vite --host 127.0.0.1 --port ${TEST_PORT} --strictPort`
        : `${process.env.PW_BUILD_READY === '1' ? '' : 'npm run build && '}npx vite preview --host 127.0.0.1 --port ${TEST_PORT} --strictPort`,
      url: `http://127.0.0.1:${TEST_PORT}`,
      reuseExistingServer: false,
      timeout: 180000,
      stdout: 'pipe',
      stderr: 'pipe',
    }
  ],
  projects: [
    {
      name: 'chromium',
      testIgnore: /mobile\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
      },
    },
    {
      name: 'iphone',
      testMatch: /mobile\.spec\.ts/,
      // Trace on Windows shows >30s of cold startup before the six-view journey.
      // This is a functional check; every layout assertion keeps its own limit.
      timeout: 120000,
      use: { ...devices['iPhone 14'], browserName: 'webkit' },
    },
  ],
});
