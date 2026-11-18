import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 45_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    viewport: { width: 1440, height: 900 },
    reducedMotion: 'reduce',
    headless: true,
    launchOptions: {
      executablePath: '/usr/bin/google-chrome',
      args: [
        '--no-sandbox',
        '--disable-dev-shm-usage',
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream',
      ],
    },
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'glb',
      testMatch: /.*_glb\.spec\.ts/,
      use: {
        baseURL: 'http://127.0.0.1:45380',
      },
    },
    {
      name: 'irn',
      testMatch: /.*_irn.*\.spec\.ts/,
      use: {
        baseURL: 'http://127.0.0.1:45381',
      },
    },
  ],
  webServer: [
    {
      command:
        'MOCKZA_WEB_PORT=45380 MOCKZA_WEB_ROOT=dist-glb node ../scripts/serve_web_static.mjs',
      url: 'http://127.0.0.1:45380/',
      reuseExistingServer: !process.env.CI,
      timeout: 15_000,
    },
    {
      command:
        'MOCKZA_WEB_PORT=45381 MOCKZA_WEB_ROOT=dist-irn node ../scripts/serve_web_static.mjs',
      url: 'http://127.0.0.1:45381/',
      reuseExistingServer: !process.env.CI,
      timeout: 15_000,
    },
  ],
});
