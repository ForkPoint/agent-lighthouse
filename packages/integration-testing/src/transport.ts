import { lookup } from "node:dns";
import { BlockList, isIP } from "node:net";
import { Agent, request } from "undici";

export const TransportReason = {
  Timeout: "request timeout",
  BodyLimit: "response body limit",
  UnsafeTarget: "unsafe target",
} as const;
export type TransportReason =
  (typeof TransportReason)[keyof typeof TransportReason];
export class PrivateTransportError extends Error {
  constructor(readonly reason: TransportReason) {
    super(reason);
  }
}
export interface FetchResult {
  status: number;
  body: string;
  contentType: string;
  error?: boolean;
}
interface RequestInput {
  url: string;
  method: "GET" | "POST";
  body?: string;
  headers: Record<string, string>;
  signal: AbortSignal;
  timeout: number;
  contentType?: string;
  followRedirects: boolean;
  acceptHeader: string;
}
export interface PrivateTransport {
  fetch(input: RequestInput): Promise<FetchResult>;
  close(): Promise<void>;
}
const blocked = new BlockList();
for (const [address, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 3],
] as const)
  blocked.addSubnet(address, prefix, "ipv4");
const globalV6 = new BlockList();
globalV6.addSubnet("2000::", 3, "ipv6");
blocked.addSubnet("2001:db8::", 32, "ipv6");
blocked.addSubnet("2002::", 16, "ipv6");
blocked.addSubnet("2001::", 32, "ipv6");
export function isPublicAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return !blocked.check(address, "ipv4");
  return (
    family === 6 &&
    globalV6.check(address, "ipv6") &&
    !blocked.check(address, "ipv6")
  );
}

/** The connection lookup validates the exact address handed to the TLS socket. */
export function createPrivateTransport(baseUrl: string): PrivateTransport {
  const origin = new URL(baseUrl).origin;
  const dispatcher = new Agent({
    connect: {
      lookup(hostname, options, callback) {
        lookup(hostname, { ...options, all: true }, (error, addresses) => {
          if (error) {
            callback(error, [], undefined);
            return;
          }
          if (
            !addresses.length ||
            addresses.some(({ address }) => !isPublicAddress(address))
          ) {
            callback(
              new PrivateTransportError(TransportReason.UnsafeTarget),
              [],
              undefined,
            );
            return;
          }
          if (options.all) callback(null, addresses, undefined);
          else {
            const first = addresses[0]!;
            callback(null, first.address, first.family);
          }
        });
      },
    },
  });
  return {
    async fetch(input) {
      const url = new URL(input.url);
      const hostname = url.hostname.replace(/^\[|\]$/g, "");
      if (
        url.origin !== origin ||
        url.protocol !== "https:" ||
        url.username ||
        url.password ||
        (isIP(hostname) && !isPublicAddress(hostname))
      )
        throw new PrivateTransportError(TransportReason.UnsafeTarget);
      const timeoutSignal = AbortSignal.timeout(input.timeout);
      const signal = AbortSignal.any([input.signal, timeoutSignal]);
      try {
        const response = await request(url, {
          dispatcher,
          method: input.method,
          headers: {
            ...input.headers,
            accept: input.acceptHeader,
            ...(input.body !== undefined
              ? { "content-type": "application/json" }
              : {}),
          },
          ...(input.body !== undefined ? { body: input.body } : {}),
          signal,
          headersTimeout: input.timeout,
          bodyTimeout: input.timeout,
        });
        const chunks: Buffer[] = [];
        let size = 0;
        try {
          for await (const chunk of response.body) {
            const bytes = Buffer.from(chunk);
            size += bytes.length;
            if (size > 1024 * 1024)
              throw new PrivateTransportError(TransportReason.BodyLimit);
            chunks.push(bytes);
          }
        } finally {
          response.body.destroy();
        }
        const contentType = response.headers["content-type"];
        return {
          status: response.statusCode,
          body: Buffer.concat(chunks).toString("utf8"),
          contentType: typeof contentType === "string" ? contentType : "",
        };
      } catch (failure) {
        if (input.signal.aborted) throw failure;
        if (
          timeoutSignal.aborted ||
          (failure instanceof Error &&
            "code" in failure &&
            [
              "UND_ERR_HEADERS_TIMEOUT",
              "UND_ERR_BODY_TIMEOUT",
              "UND_ERR_CONNECT_TIMEOUT",
            ].includes(String(failure.code)))
        )
          throw new PrivateTransportError(TransportReason.Timeout);
        if (
          failure instanceof Error &&
          failure.cause instanceof PrivateTransportError
        )
          throw failure.cause;
        throw failure;
      }
    },
    async close() {
      await dispatcher.destroy();
    },
  };
}
