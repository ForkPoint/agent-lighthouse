/** Finding proof: a homepage scan caches originHomepage: undefined, and the
 * reassignment at orchestrator.ts:314 happens AFTER the cache write. */
const R = new URL("../../../packages/core/src", import.meta.url).pathname;
const { runScan } = await import(`${R}/orchestrator.ts`);
const { defaultOriginCache, computeOriginCacheKey } = await import(
  `${R}/origin-cache.ts`
);

await runScan("https://example.com/");
const key = computeOriginCacheKey("https://example.com/");
const entry = defaultOriginCache.get(key);

console.log(
  "scanned                    : https://example.com/ (a homepage scan)",
);
console.log("origin cache entry present :", !!entry);
console.log(
  "rootFiles cached           :",
  Object.keys(entry?.rootFiles ?? {}).length,
);
console.log(
  "originHomepage cached      :",
  entry?.originHomepage === undefined ? "undefined" : "present",
);
console.log(
  entry && entry.originHomepage === undefined
    ? "CONFIRMED: the next scan of any other path on this origin inherits no origin homepage"
    : "NOT CONFIRMED",
);
