import { describe, expect, it } from "vitest";
import { connect } from "node:net";
import { startServer } from "./start";

/** Sends one raw GET with the given Host header and returns the status line. */
function rawGet(port: number, host: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const socket = connect(port, "127.0.0.1");
    let data = "";
    socket.on("data", (chunk) => (data += chunk.toString()));
    socket.on("end", () => resolve(data.split("\r\n")[0]!));
    socket.on("error", reject);
    socket.write(
      `GET / HTTP/1.1\r\nHost: ${host}\r\nConnection: close\r\n\r\n`,
    );
  });
}

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

  it("refuses a foreign Host header on a loopback bind", async () => {
    const server = await startServer({ port: 0 });
    try {
      const port = Number(new URL(server.url).port);
      expect(await rawGet(port, `evil.example:${port}`)).toMatch(
        /^HTTP\/1\.1 421/,
      );
      expect(await rawGet(port, `localhost:${port}`)).toMatch(
        /^HTTP\/1\.1 200/,
      );
      expect(await rawGet(port, `[::1]:${port}`)).toMatch(/^HTTP\/1\.1 200/);
    } finally {
      await server.close();
    }
  });

  it("answers a preflight from an allowed origin only", async () => {
    const server = await startServer({
      port: 0,
      allowedOrigins: ["chrome-extension://abc"],
    });
    try {
      const preflight = (origin: string) =>
        fetch(new URL("/detect", server.url), {
          method: "OPTIONS",
          headers: { origin, "access-control-request-method": "POST" },
        });
      const allowed = await preflight("chrome-extension://abc");
      expect(allowed.status).toBe(204);
      expect(allowed.headers.get("access-control-allow-origin")).toBe(
        "chrome-extension://abc",
      );
      expect((await preflight("chrome-extension://xyz")).status).toBe(403);
    } finally {
      await server.close();
    }
  });
});
