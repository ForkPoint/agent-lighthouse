import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { createTaskServer } from "./http";

export interface StartServerOptions {
  port?: number;
  host?: string;
  token?: string;
}

export async function startServer(
  options: StartServerOptions = {},
): Promise<{ url: string; close(): Promise<void> }> {
  const tasks = createTaskServer(
    options.token === undefined ? {} : { token: options.token },
  );
  const http = createServer((req, res) => tasks.handle(req, res));
  const host = options.host ?? "127.0.0.1";
  await new Promise<void>((resolve, reject) => {
    http.once("error", reject);
    http.listen(options.port ?? 8787, host, resolve);
  });
  const { port } = http.address() as AddressInfo;
  const shown = host.includes(":") ? `[${host}]` : host;
  return {
    url: `http://${shown}:${port}/`,
    close: () =>
      new Promise((resolve) => {
        tasks.close();
        http.closeAllConnections();
        http.close(() => resolve());
      }),
  };
}
