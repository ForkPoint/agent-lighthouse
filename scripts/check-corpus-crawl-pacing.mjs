import assert from "node:assert/strict";
import { fetcher, permitted } from "./discover-brand-pages.mjs";

const original = fetcher.fetch;
const calls = [];
fetcher.fetch = async ({ url }) => {
  calls.push(url);
  return url.includes("denied-corpus.example")
    ? { status: 403 }
    : {
        status: 200,
        body: "User-agent: *\nAllow: /\nDisallow: /private/\nCrawl-delay: 1\n",
      };
};
try {
  const start = Date.now();
  const allowed = await Promise.all([
    permitted("https://paced-corpus.example/a"),
    permitted("https://paced-corpus.example/b"),
  ]);
  const elapsed = Date.now() - start;
  assert.deepEqual(allowed, [undefined, undefined]);
  assert.ok(
    elapsed >= 1900,
    `Concurrent requests ignored crawl delay: ${elapsed}ms`,
  );
  assert.equal(
    calls.length,
    1,
    "Concurrent callers duplicated the robots fetch",
  );
  assert.equal(
    await permitted("https://paced-corpus.example/private/a"),
    "robots-disallow",
  );
  assert.equal(
    await permitted("https://denied-corpus.example/a"),
    "robots-refused",
  );
  console.log(
    JSON.stringify({
      allowed: 2,
      elapsedMs: elapsed,
      robotsFetches: calls.length,
      disallow: "preserved",
      refusal: "preserved",
    }),
  );
} finally {
  fetcher.fetch = original;
}
