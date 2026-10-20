import { describe, expect, it } from "vitest";
import {
  ClassificationConfidence,
  PageType,
  PayloadOrigin,
} from "@forkpoint/agent-lighthouse-core";
import { InMemoryPayloadStore, type DetectionEntry } from "./payload-store";
import {
  DETECTION_TTL_MS,
  MAX_DETECTION_BYTES,
  MAX_DETECTIONS,
} from "./limits";

function entry(html = "<p>hi</p>"): Omit<DetectionEntry, "detectionId"> {
  const url = "https://shop.test/p/1";
  return {
    target: url,
    payload: { url, html, origin: PayloadOrigin.Fetched, sha256: "ab" },
    identity: {
      url,
      type: PageType.Product,
      confidence: ClassificationConfidence.Strong,
      signals: [],
      payloadSha256: "ab",
      origin: PayloadOrigin.Fetched,
      partial: false,
    },
  };
}

function makeStore() {
  let now = 0;
  let n = 0;
  const store = new InMemoryPayloadStore({
    now: () => now,
    newId: () => `d_${++n}`,
  });
  return { store, advance: (ms: number) => (now += ms) };
}

describe("InMemoryPayloadStore", () => {
  it("stores an entry under a new id and reads it back", () => {
    const { store } = makeStore();
    const id = store.put(entry())!;
    expect(id).toBe("d_1");
    expect(store.get(id)?.payload.html).toBe("<p>hi</p>");
    expect(store.get(id)?.detectionId).toBe("d_1");
    expect(store.get("d_9")).toBeUndefined();
  });

  it("keeps an entry readable more than once, until its TTL ends", () => {
    const { store, advance } = makeStore();
    const id = store.put(entry())!;
    expect(store.get(id)).toBeDefined();
    advance(DETECTION_TTL_MS);
    expect(store.get(id)).toBeDefined();
    advance(1);
    expect(store.get(id)).toBeUndefined();
  });

  it("evicts the oldest entry when the count cap is reached", () => {
    const { store } = makeStore();
    for (let i = 0; i < MAX_DETECTIONS; i++) store.put(entry());
    const newest = store.put(entry())!;
    expect(store.get("d_1")).toBeUndefined();
    expect(store.get("d_2")).toBeDefined();
    expect(store.get(newest)).toBeDefined();
  });

  it("evicts the oldest entries when the byte cap is reached", () => {
    const { store } = makeStore();
    const big = "x".repeat(Math.floor(MAX_DETECTION_BYTES / 3));
    store.put(entry(big));
    store.put(entry(big));
    store.put(entry(big));
    store.put(entry(big));
    expect(store.get("d_1")).toBeUndefined();
    expect(store.get("d_2")).toBeDefined();
    expect(store.get("d_4")).toBeDefined();
  });

  it("refuses an entry over the byte cap on its own, and evicts nothing", () => {
    const { store } = makeStore();
    store.put(entry());
    expect(store.put(entry("x".repeat(MAX_DETECTION_BYTES + 1)))).toBe(
      undefined,
    );
    expect(store.get("d_1")).toBeDefined();
  });

  it("deletes an entry", () => {
    const { store } = makeStore();
    const id = store.put(entry())!;
    expect(store.delete(id)).toBe(true);
    expect(store.get(id)).toBeUndefined();
    expect(store.delete(id)).toBe(false);
  });
});
