import { describe, it, expect, vi } from "vitest";
import { cacheOwner } from "./cache-owner";
import { fetchSampledPage } from "./sampled-pages";
import type { FetchResult } from "../fetcher";

vi.mock("../fetcher", () => ({ isSafeUrl: async () => true }));

const ok: FetchResult = {
  url: "https://example.com/p",
  status: 200,
  headers: {},
  body: "<html></html>",
  durationMs: 1,
} as unknown as FetchResult;

describe("cacheOwner", () => {
  it("is the context itself when nothing stamps an owner", () => {
    const ctx = {};
    expect(cacheOwner(ctx)).toBe(ctx);
  });

  it("is the stamped owner on a scoped copy", () => {
    const owner = {};
    const copy = { cacheOwner: owner };
    expect(cacheOwner(copy)).toBe(owner);
  });

  it("lets two scoped copies of one scan share a gatherer cache", async () => {
    const fetch = vi.fn(async () => ok);
    const owner = { fetch };
    const a = { ...owner, cacheOwner: owner };
    const b = { ...owner, cacheOwner: owner };

    await fetchSampledPage(a, ok.url);
    await fetchSampledPage(b, ok.url);

    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("keeps two scans apart", async () => {
    const fetch = vi.fn(async () => ok);
    const a = { fetch };
    const b = { fetch };

    await fetchSampledPage(a, ok.url);
    await fetchSampledPage(b, ok.url);

    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
