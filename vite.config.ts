import { defineConfig, type Plugin } from 'vite';

// The real /sdk.js is served by Yandex Games. Locally we serve an empty stub so the
// static <script src="/sdk.js"> tag never produces a 404 in the console.
function sdkStub(): Plugin {
  const handler = (req: { url?: string }, res: { setHeader(k: string, v: string): void; end(s: string): void }, next: () => void) => {
    if (req.url && req.url.split('?')[0] === '/sdk.js') {
      res.setHeader('Content-Type', 'application/javascript');
      res.end('/* local stub: Yandex Games SDK is unavailable outside the platform */');
      return;
    }
    next();
  };
  return {
    name: 'sdk-stub',
    configureServer(server) { server.middlewares.use(handler); },
    configurePreviewServer(server) { server.middlewares.use(handler); },
  };
}

export default defineConfig({
  base: './',
  plugins: [sdkStub()],
  build: {
    target: 'es2019',
    outDir: 'dist',
    assetsDir: 'assets',
    assetsInlineLimit: 0,
    sourcemap: false,
    chunkSizeWarningLimit: 1500,
    modulePreload: { polyfill: false },
  },
  server: { host: true },
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
  },
} as never);
