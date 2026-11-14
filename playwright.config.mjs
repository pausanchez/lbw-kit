// End-to-end tests of the gallery page (site/index.html, from `npm run build && node gallery/build.mjs --page`):
// every widget type drawn by the real built library, in Chromium, Firefox and WebKit (Edge with E2E_EDGE=1).
// Smoke (pull requests): npx playwright test --project=chromium --grep @smoke
import { defineConfig, devices } from '@playwright/test';

const port = Number(process.env.E2E_PORT || 4178);
const CI = !!process.env.CI;

const projects = [
  { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
  { name: 'webkit', use: { ...devices['Desktop Safari'] } },
];
if (process.env.E2E_EDGE === '1') projects.push({ name: 'msedge', use: { ...devices['Desktop Edge'], channel: 'msedge' } });

export default defineConfig({
  testDir: 'e2e',
  testMatch: '*.spec.mjs',
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  workers: CI ? 4 : undefined,
  timeout: 30_000,
  expect: { timeout: 6_000 },
  reporter: CI ? [['github'], ['html', { open: 'never', outputFolder: 'playwright-report' }]] : [['list']],
  outputDir: 'test-results',
  use: {
    baseURL: `http://127.0.0.1:${port}/`,
    locale: 'es-ES',
    timezoneId: 'Europe/Madrid',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects,
  webServer: {
    command: 'node e2e/serve.mjs',
    url: `http://127.0.0.1:${port}/`,
    reuseExistingServer: !CI,
    env: { E2E_PORT: String(port) },
    timeout: 10_000,
  },
});
