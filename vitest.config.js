import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.js', 'tests/integration/**/*.test.js', 'tests/seguridad/**/*.test.js'],
    // Las pruebas end-to-end las ejecuta Playwright, no Vitest.
    exclude: ['tests/e2e/**', 'node_modules/**'],
    reporters: ['default', 'junit'],
    outputFile: {
      junit: 'evidencias/vitest-junit.xml',
    },
    coverage: {
      provider: 'v8',
      reportsDirectory: 'evidencias/cobertura',
      reporter: ['text', 'text-summary', 'html', 'json-summary', 'lcov'],
      include: ['src/**/*.js'],
      // El punto de entrada solo arranca el servidor: se cubre con las E2E.
      exclude: ['src/server.js'],
      thresholds: {
        lines: 85,
        functions: 85,
        branches: 80,
        statements: 85,
      },
    },
  },
});
