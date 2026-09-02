/** Finding proof: OriginCache has no size bound; entries only leave on a
 * later get() of that same expired key, which a never-rescanned origin never
 * receives. */
const R = new URL("../../../packages/core/src", import.meta.url).pathname;
const { OriginCache } = await import(`${R}/origin-cache.ts`);

const c = new OriginCache(1); // 1 ms TTL: every entry is expired immediately
for (let i = 0; i < 5000; i++) {
  c.set(`https://site-${i}.example|v1`, {
    origin: `https://site-${i}.example`,
    version: "v1",
    readAt: new Date().toISOString(),
    rootFiles: {},
  } as never);
}
await new Promise((r) => setTimeout(r, 20)); // everything is now past its TTL
console.log(`entries written              : 5000`);
console.log(`TTL                          : 1 ms, elapsed 20 ms`);
console.log(`cache.size after expiry      : ${c.size}`);
console.log(
  c.size === 5000
    ? "CONFIRMED: expired entries are retained until someone gets that exact key"
    : "NOT CONFIRMED",
);
