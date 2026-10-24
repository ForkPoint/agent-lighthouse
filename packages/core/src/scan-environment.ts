import { AsyncLocalStorage } from "node:async_hooks";

/** Resolves a host name the way `dns.promises.lookup` does. */
export type HostLookup = (hostname: string) => Promise<{ address: string }>;

/**
 * What a scan reads from the machine it runs on: the clock, name
 * resolution and random numbers. A live scan uses the machine's own. A
 * replay sets all three, so the same captures give the same report.
 */
export interface ScanEnvironment {
  /** Epoch milliseconds. */
  now?: () => number;
  lookup?: HostLookup;
  /** A number in [0, 1), as `Math.random` returns. */
  random?: () => number;
}

const environment = new AsyncLocalStorage<ScanEnvironment>();

/** Run `fn`, and the async work it starts, in `env`. */
export function withScanEnvironment<T>(env: ScanEnvironment, fn: () => T): T {
  return environment.run({ ...environment.getStore(), ...env }, fn);
}

/** The scan's clock in epoch milliseconds; the machine's outside a scan. */
export function scanNow(): number {
  return environment.getStore()?.now?.() ?? Date.now();
}

/** The scan's name resolver, or `undefined` for the system resolver. */
export function scanLookup(): HostLookup | undefined {
  return environment.getStore()?.lookup;
}

/** The scan's random numbers; `Math.random` outside a scan. */
export function scanRandom(): number {
  return environment.getStore()?.random?.() ?? Math.random();
}

/**
 * `length` random bytes as lower-case hex, from {@link scanRandom}: a probe
 * name or token no site serves on purpose, which a replay of the scan
 * repeats. Not for secrets.
 */
export function scanRandomHex(length: number): string {
  let hex = "";
  for (let i = 0; i < length; i += 1)
    hex += Math.floor(scanRandom() * 256)
      .toString(16)
      .padStart(2, "0");
  return hex;
}

/**
 * A repeatable generator seeded from a string (mulberry32 over an FNV-1a
 * hash). Not for secrets: it makes values a replay can reproduce, such as a
 * probe token seeded from the scan id.
 */
export function seededRandom(seed: string): () => number {
  let state = 0x811c9dc5;
  for (let i = 0; i < seed.length; i += 1) {
    state ^= seed.charCodeAt(i);
    state = Math.imul(state, 0x01000193);
  }
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
