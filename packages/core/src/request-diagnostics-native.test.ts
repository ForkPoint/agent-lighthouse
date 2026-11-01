import { readFileSync } from "node:fs";
import { once } from "node:events";
import {
  createSecureServer,
  constants,
  type ServerHttp2Session,
} from "node:http2";
import type { AddressInfo } from "node:net";
import { join } from "node:path";
import { Agent } from "undici";
import { expect, it } from "vitest";
import { createFetcher, type HttpExchange } from "./fetcher";
import { createRequestScheduler } from "./request-scheduler";

it("marks native H2 REFUSED_STREAM resend timings ambiguous without adding retries", async () => {
  // Synthetic localhost certificate; this fixture never contacts a public host.
  const cert = readFileSync(join(__dirname, "tests/http2/localhost-cert.pem"));
  const server = createSecureServer({
    cert,
    key: readFileSync(join(__dirname, "tests/http2/localhost-key.pem")),
    settings: { maxConcurrentStreams: 4 },
  });
  const sessions = new Set<ServerHttp2Session>();
  server.on("session", (session) => {
    sessions.add(session);
    session.on("error", () => {});
  });
  let sends = 0;
  server.on("stream", (stream) => {
    sends++;
    stream.on("error", () => {});
    if (sends === 1) stream.close(constants.NGHTTP2_REFUSED_STREAM);
    else {
      stream.respond({ ":status": 200 });
      stream.end("ok");
    }
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const dispatcher = new Agent({
    connections: 1,
    allowH2: true,
    connect: { ca: cert },
    h2Options: { maxConcurrentStreams: 4 },
  });
  const exchanges: HttpExchange[] = [];
  const fetcher = createFetcher({
    dispatcher,
    requestScheduler: createRequestScheduler(),
    readyRequestScheduling: true,
    requestDiagnostics: true,
    onExchange: (exchange) => exchanges.push(exchange),
  });
  try {
    const result = await fetcher.fetch({
      url: `https://localhost:${(server.address() as AddressInfo).port}/`,
    });
    expect(result.status).toBe(200);
    expect(result.body).toBe("ok");
    expect(sends).toBe(2);
    expect(exchanges).toHaveLength(1);
    expect(exchanges[0]).toMatchObject({
      fetchId: 1,
      hop: 0,
      diagnostics: {
        headersSent: true,
        responseHeaders: true,
        bodyEnded: true,
        transportWaitMs: null,
        responseWaitMs: null,
        bodyMs: null,
        protocol: null,
      },
    });
  } finally {
    await dispatcher.destroy();
    for (const session of sessions) session.destroy();
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});
