import { createServer } from "node:http";
import { isIP, type AddressInfo } from "node:net";
import { createTaskServer } from "./http";

/** True for an address that only this machine can reach. */
function isLoopback(host: string): boolean {
  if (host === "localhost" || host === "::1") return true;
  return isIP(host) === 4 && host.startsWith("127.");
}

export interface StartServerOptions {
  port?: number;
  host?: string;
  token?: string;
}

export async function startServer(
  options: StartServerOptions = {},
): Promise<{ url: string; close(): Promise<void> }> {
  const host = options.host ?? "127.0.0.1";
  const shown = host.includes(":") ? `[${host}]` : host;
  // The Host allowlist needs the real port, known only after listen; the
  // handler reads `tasks` per request, so it is created once the port is known.
  let tasks: ReturnType<typeof createTaskServer> | undefined;
  const http = createServer((req, res) => tasks!.handle(req, res));
  await new Promise<void>((resolve, reject) => {
    http.once("error", reject);
    http.listen(options.port ?? 8787, host, resolve);
  });
  const { port } = http.address() as AddressInfo;
  tasks = createTaskServer({
    ...(options.token !== undefined && { token: options.token }),
    // On loopback only local names are valid; any other Host is a rebinding
    // page. On another address the operator's DNS names are unknown here.
    ...(isLoopback(host) && {
      allowedHosts: [
        ...new Set([
          `127.0.0.1:${port}`,
          `localhost:${port}`,
          `[::1]:${port}`,
          `${shown}:${port}`,
        ]),
      ],
    }),
  });
  return {
    url: `http://${shown}:${port}/`,
    close: () =>
      new Promise((resolve) => {
        tasks?.close();
        http.closeAllConnections();
        http.close(() => resolve());
      }),
  };
}
