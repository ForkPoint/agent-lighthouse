import { describe, expect, it } from "vitest";
import { startServer } from "./start";

describe("startServer", () => {
  it("listens on loopback and serves the page", async () => {
    const server = await startServer({ port: 0 });
    try {
      expect(server.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/$/);
      const html = await (await fetch(server.url)).text();
      expect(html).toContain("new EventSource");
      expect(html).toContain("/updates?after=");
      expect(html).not.toMatch(/\bETA\b|\bremaining\b/i);
    } finally {
      await server.close();
    }
  });
});
