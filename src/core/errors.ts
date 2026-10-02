/** Global error capture: keeps the console clean and the game running. */
export const capturedErrors: string[] = [];

export function installErrorHandlers(onError?: (msg: string) => void): void {
  const push = (msg: string) => {
    if (capturedErrors.length < 50) capturedErrors.push(msg);
    onError?.(msg);
  };
  window.addEventListener('error', (e) => {
    // Resource loading errors (e.g. blocked scripts) have no `error` object.
    push(e.error ? `${e.message}\n${(e.error as Error).stack ?? ''}` : `resource: ${(e.target as HTMLElement)?.tagName ?? 'unknown'}`);
  }, true);
  window.addEventListener('unhandledrejection', (e) => {
    const r = e.reason;
    push(r instanceof Error ? `${r.message}\n${r.stack ?? ''}` : String(r));
    e.preventDefault();
  });
}
