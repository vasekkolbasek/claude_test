type Handler<T> = (payload: T) => void;

/** Minimal typed event emitter. */
export class Emitter<M extends object> {
  private map = new Map<keyof M, Set<Handler<any>>>();
  on<K extends keyof M>(type: K, fn: Handler<M[K]>): () => void {
    let set = this.map.get(type);
    if (!set) this.map.set(type, (set = new Set()));
    set.add(fn);
    return () => set!.delete(fn);
  }
  emit<K extends keyof M>(type: K, payload: M[K]): void {
    const set = this.map.get(type);
    if (set) for (const fn of set) fn(payload);
  }
  clear(): void { this.map.clear(); }
}
