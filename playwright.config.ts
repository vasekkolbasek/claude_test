import { defineConfig, devices } from '@playwright/test';

// PW_CHROMIUM overrides the browser; otherwise Playwright's bundled Chromium is used.
const executablePath = process.env.PW_CHROMIUM || undefined;

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 180_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4180/games/neon-swarm/',
    launchOptions: { executablePath, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] },
    trace: 'off',
  },
  webServer: {
    // serve the extracted release archive from a sub-folder to prove relative paths work
    command: 'node scripts/extract-release.mjs && node scripts/serve.mjs release/build 4180 /games/neon-swarm/',
    url: 'http://localhost:4180/games/neon-swarm/index.html',
    reuseExistingServer: false,
    timeout: 20_000,
  },
  projects: [
    { name: 'mobile', use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } },
    { name: 'desktop', use: { viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 } },
  ],
});
