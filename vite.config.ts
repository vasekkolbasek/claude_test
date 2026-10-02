import { defineConfig, type Plugin } from 'vite';

/**
 * In production the Yandex Games platform serves `/sdk.js` next to the game.
 * Locally there is no SDK, so the dev/preview servers answer with an empty stub:
 * `window.YaGames` stays undefined and the game falls back to LocalPlatform
 * without a 404 in the console.
 */
function sdkStub(): Plugin {
  const handler = (req: { url?: string }, res: { setHeader(k: string, v: string): void; end(s: string): void }, next: () => void) => {
    if (req.url && req.url.split('?')[0] === '/sdk.js') {
      res.setHeader('Content-Type', 'application/javascript');
      res.end('/* local SDK stub: YaGames is intentionally undefined */');
      return;
    }
    next();
  };
  return {
    name: 'yandex-sdk-stub',
    configureServer(server) {
      server.middlewares.use(handler);
    },
    configurePreviewServer(server) {
      server.middlewares.use(handler);
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [sdkStub()],
  build: {
    target: 'es2020',
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    reportCompressedSize: false,
    chunkSizeWarningLimit: 2000,
  },
  server: { host: true },
});
