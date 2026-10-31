import { defineConfig, devices } from '@playwright/test';

const PUERTO = 3100;
const URL_BASE = 'http://127.0.0.1:' + PUERTO;

export default defineConfig({
  testDir: './tests/e2e',
  // Las pruebas se escriben para ser independientes entre si, por lo que
  // pueden ejecutarse en paralelo.
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  reporter: [
    ['list'],
    ['html', { outputFolder: 'evidencias/playwright-report', open: 'never' }],
    ['junit', { outputFile: 'evidencias/playwright-junit.xml' }],
  ],
  outputDir: 'evidencias/playwright-resultados',
  use: {
    baseURL: URL_BASE,
    // Evidencia automatica de los fallos para la bitacora de defectos.
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // Playwright arranca y detiene el servidor automaticamente.
  webServer: {
    command: 'node src/server.js',
    url: URL_BASE + '/api/salud',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    env: {
      PORT: String(PUERTO),
      // Base de datos dedicada a las pruebas E2E.
      DB_PATH: 'evidencias/e2e.db',
    },
  },
});
