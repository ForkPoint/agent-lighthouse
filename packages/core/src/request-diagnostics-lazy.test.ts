import { describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ subscriptions: {} as Record<string, number> }));
vi.mock("node:diagnostics_channel", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("node:diagnostics_channel")>();
  return {
    ...actual,
    channel(name: string) {
      const topic = actual.channel(name);
      return {
        subscribe(listener: Parameters<typeof topic.subscribe>[0]) {
          h.subscriptions[name] = (h.subscriptions[name] ?? 0) + 1;
          // Bind to the real Channel. Spying on its subscribe property would
          // interfere with Node's inactive-to-active prototype transition.
          topic.subscribe(listener);
        },
      };
    },
  };
});

describe("diagnostics opt-in installation", () => {
  it("keeps a fresh module disabled and installs once on the first enabled request", async () => {
    vi.resetModules();
    h.subscriptions = {};
    const topics = [
      "undici:request:create",
      "undici:client:sendHeaders",
      "undici:request:headers",
      "undici:request:trailers",
      "undici:request:error",
    ];
    const { createFetcherWith } = await import("./fetcher.js");
    const transport = async () => ({
      statusCode: 200,
      headers: {},
      body: {
        async *[Symbol.asyncIterator]() {
          yield new Uint8Array(0);
        },
        async dump() {},
      },
    });
    const disabled = createFetcherWith({}, transport);
    await disabled.fetch({ url: "https://site.test" });
    expect(topics.map((name) => h.subscriptions[name] ?? 0)).toEqual([
      0, 0, 0, 0, 0,
    ]);
    const first = createFetcherWith({ requestDiagnostics: true }, transport);
    await first.fetch({ url: "https://site.test" });
    const second = createFetcherWith({ requestDiagnostics: true }, transport);
    await second.fetch({ url: "https://site.test" });
    await first.fetch({ url: "https://site.test" });
    expect(topics.map((name) => h.subscriptions[name] ?? 0)).toEqual([
      1, 1, 1, 1, 1,
    ]);
  });
});
