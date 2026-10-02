import { defineConfig } from '@playwright/test';

const args = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'];

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 240_000,
  expect: { timeout: 30_000 },
  retries: 0,
  workers: 1,
  reporter: [['list']],
  use: { baseURL: 'http://localhost:4173/game/', launchOptions: { args } },
  webServer: [
    { command: 'node scripts/serve.mjs dist 4173', url: 'http://localhost:4173/game/', reuseExistingServer: true, timeout: 20_000 },
    { command: 'node scripts/serve.mjs dist 4174', url: 'http://localhost:4174/game/', reuseExistingServer: true, timeout: 20_000, env: { MOCK_SDK: '1' } },
  ],
  projects: [
    { name: 'phone-landscape', use: { viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true } },
    { name: 'phone-portrait', use: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true } },
    { name: 'desktop', use: { viewport: { width: 1920, height: 1080 } } },
  ],
});
