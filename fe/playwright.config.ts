import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  use: {
    ...devices['Desktop Chrome'],
    baseURL: 'http://127.0.0.1:5173',
    browserName: 'chromium',
    channel: process.env.E2E_BROWSER_CHANNEL || 'msedge',
    headless: true,
    trace: 'retain-on-failure',
  },
  reporter: 'list',
})
