/** Finding: a custom User-Agent scan shares a cache slot with a default scan. */
const R = new URL("../../../packages/core/src", import.meta.url).pathname;
const { computeOriginCacheKey, shouldBypassOriginCache } = await import(
  `${R}/origin-cache.ts`
);

const url = "https://example.com/";
const botOpts = { headers: { "User-Agent": "GPTBot/1.0" } };
const plainKey = computeOriginCacheKey(url);
const botKey = computeOriginCacheKey(url);

console.log(`default scan key : ${plainKey}`);
console.log(`GPTBot scan key  : ${botKey}`);
console.log(`keys identical   : ${plainKey === botKey}`);
console.log(`GPTBot bypasses  : ${shouldBypassOriginCache(url, botOpts)}`);
console.log(
  `Authorization bypasses : ${shouldBypassOriginCache(url, { headers: { Authorization: "Bearer x" } })}`,
);
console.log(
  plainKey === botKey && !shouldBypassOriginCache(url, botOpts)
    ? "CONFIRMED: a bot-UA scan writes into the slot a default scan reads"
    : "NOT CONFIRMED",
);
