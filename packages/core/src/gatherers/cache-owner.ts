/**
 * The object a per-scan gatherer cache is keyed on.
 *
 * Every gatherer memoises its work in a `WeakMap` so that one scan shares one
 * fetch and two scans share nothing. The runner hands each audit a scoped copy
 * of the `CheckContext` (`{ ...ctx, pages }`), and a copy has a new identity.
 * Keying on the copy would miss the cache once per audit and repeat every
 * fetch. The runner therefore stamps `cacheOwner` on the copy, pointing back at
 * the object all copies descend from, and every gatherer keys on that.
 *
 * A context without the stamp — an orchestrator context, or a test fixture —
 * is its own owner.
 */
export function cacheOwner(ctx: object): object {
  return (ctx as { cacheOwner?: object }).cacheOwner ?? ctx;
}
