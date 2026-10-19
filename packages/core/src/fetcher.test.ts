import { vi } from "vitest";
import { SCANNER_USER_AGENT, MAX_RESPONSE_BODY_BYTES } from "./constants";

vi.mock("undici", () => {
  class Agent {
    compose() {
      return this;
    }
  }
  return {
    request: vi.fn(),
    Agent,
    interceptors: {
      redirect: vi.fn(() => ({})),
    },
  };
});

vi.mock("node:dns/promises", () => ({
  default: { lookup: vi.fn() },
}));

import { request } from "undici";
import dns from "node:dns/promises";
import {
  createFetcher,
  isSafeUrl,
  MAX_REDIRECTS,
  splitCredentials,
} from "./fetcher";
import { HttpMethod } from "./types";

const mockRequest = vi.mocked(request);
const mockLookup = vi.mocked(dns.lookup);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * A body stream that yields one chunk, as undici's body does. `read` is the
 * spy a test checks or replaces to hold the body back.
 */
function streamOf(bytes: Uint8Array) {
  return {
    read: vi.fn(async (): Promise<Uint8Array> => bytes),
    async *[Symbol.asyncIterator](this: { read(): Promise<Uint8Array> }) {
      yield await this.read();
    },
  };
}

function mockResponse(
  statusCode: number,
  body: string,
  headers: Record<string, string> = {},
) {
  return {
    statusCode,
    headers,
    body: {
      ...streamOf(Buffer.from(body, "utf8")),
      dump: vi.fn().mockResolvedValue(undefined),
    },
  };
}

/** A response whose body is real bytes rather than text. */
function mockBinaryResponse(
  bytes: Uint8Array,
  headers: Record<string, string> = {},
) {
  return {
    statusCode: 200,
    headers,
    body: {
      ...streamOf(bytes),
      dump: vi.fn().mockResolvedValue(undefined),
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// createFetcher
// ---------------------------------------------------------------------------

describe("createFetcher", () => {
  it("returns an object with a fetch method", () => {
    const fetcher = createFetcher();
    expect(fetcher).toHaveProperty("fetch");
    expect(typeof fetcher.fetch).toBe("function");
  });
});

// ---------------------------------------------------------------------------
// fetcher.fetch — successful responses
// ---------------------------------------------------------------------------

describe("fetcher.fetch", () => {
  it("returns a FetchResult for a successful 200 response", async () => {
    mockRequest.mockResolvedValue(
      mockResponse(200, "<html>Hello</html>", {
        "content-type": "text/html",
      }) as any,
    );

    const fetcher = createFetcher();
    const result = await fetcher.fetch({ url: "https://example.com" });

    expect(result.status).toBe(200);
    expect(result.body).toBe("<html>Hello</html>");
    expect(result.url).toBe("https://example.com");
    expect(result.finalUrl).toBe("https://example.com");
    expect(result.contentType).toBe("text/html");
    expect(result.contentLength).toBe("<html>Hello</html>".length);
    expect(result.error).toBeUndefined();
    expect(result.ttfbMs).toBeGreaterThanOrEqual(0);
    expect(result.totalMs).toBeGreaterThanOrEqual(0);
  });

  it("returns a FetchResult for a 404 response", async () => {
    mockRequest.mockResolvedValue(mockResponse(404, "Not Found") as any);

    const fetcher = createFetcher();
    const result = await fetcher.fetch({ url: "https://example.com/missing" });

    expect(result.status).toBe(404);
    expect(result.body).toBe("Not Found");
    expect(result.error).toBeUndefined();
  });

  it("lowercases response header keys", async () => {
    mockRequest.mockResolvedValue(
      mockResponse(200, "", {
        "Content-Type": "application/json",
        "X-Custom-Header": "custom-value",
      }) as any,
    );

    const fetcher = createFetcher();
    const result = await fetcher.fetch({ url: "https://example.com" });

    expect(result.headers["content-type"]).toBe("application/json");
    expect(result.headers["x-custom-header"]).toBe("custom-value");
  });
});

// ---------------------------------------------------------------------------
// fetcher.fetch — error handling
// ---------------------------------------------------------------------------

describe("fetcher.fetch — error handling", () => {
  it("handles network errors gracefully with status 0 and error field", async () => {
    mockRequest.mockRejectedValue(new Error("ECONNREFUSED"));

    const fetcher = createFetcher();
    const result = await fetcher.fetch({ url: "https://unreachable.test" });

    expect(result.status).toBe(0);
    expect(result.body).toBe("");
    expect(result.error).toBe("ECONNREFUSED");
    expect(result.url).toBe("https://unreachable.test");
    expect(result.headers).toEqual({});
    expect(result.contentLength).toBe(0);
  });

  it("handles timeout errors (AbortSignal.timeout triggers)", async () => {
    mockRequest.mockRejectedValue(new Error("The operation was aborted"));

    const fetcher = createFetcher();
    const result = await fetcher.fetch({
      url: "https://slow.test",
      timeout: 100,
    });

    expect(result.status).toBe(0);
    expect(result.error).toBe("The operation was aborted");
  });

  it("handles non-Error thrown values", async () => {
    mockRequest.mockRejectedValue("string error");

    const fetcher = createFetcher();
    const result = await fetcher.fetch({ url: "https://example.com" });

    expect(result.status).toBe(0);
    expect(result.error).toBe("Unknown fetch error");
  });
});

// ---------------------------------------------------------------------------
// splitCredentials + basic-auth handling
// ---------------------------------------------------------------------------

describe("splitCredentials", () => {
  it("returns the URL unchanged when there are no credentials", () => {
    expect(splitCredentials("https://example.com/path")).toEqual({
      url: "https://example.com/path",
    });
  });

  it("does not treat an @ in the path as credentials", () => {
    expect(splitCredentials("https://example.com/@handle")).toEqual({
      url: "https://example.com/@handle",
    });
  });

  it("extracts basic-auth creds into an Authorization header and strips them from the URL", () => {
    const { url, authHeader } = splitCredentials(
      "https://user:pass@example.com/x",
    );
    expect(url).toBe("https://example.com/x");
    expect(authHeader).toBe(
      `Basic ${Buffer.from("user:pass").toString("base64")}`,
    );
  });

  it("decodes percent-encoded userinfo before base64-encoding the header", () => {
    const { authHeader } = splitCredentials("https://user:p%40ss@example.com/");
    expect(authHeader).toBe(
      `Basic ${Buffer.from("user:p@ss").toString("base64")}`,
    );
  });

  it("handles username-only credentials", () => {
    const { url, authHeader } = splitCredentials("https://token@example.com/");
    expect(url).toBe("https://example.com/");
    expect(authHeader).toBe(
      `Basic ${Buffer.from("token:").toString("base64")}`,
    );
  });
});

describe("fetcher.fetch — basic auth from URL", () => {
  it("sends Authorization from URL userinfo and requests the credential-free URL", async () => {
    mockRequest.mockResolvedValue(mockResponse(200, "ok") as any);

    const fetcher = createFetcher();
    const result = await fetcher.fetch({
      url: "https://user:pass@example.com/secure",
    });

    expect(mockRequest).toHaveBeenCalledWith(
      "https://example.com/secure",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: `Basic ${Buffer.from("user:pass").toString("base64")}`,
        }),
      }),
    );
    // Credentials must never leak into the returned result.
    expect(result.url).toBe("https://example.com/secure");
    expect(result.finalUrl).toBe("https://example.com/secure");
  });

  it("does not set Authorization when the URL has no credentials", async () => {
    mockRequest.mockResolvedValue(mockResponse(200, "") as any);

    const fetcher = createFetcher();
    await fetcher.fetch({ url: "https://example.com" });

    const headers = mockRequest.mock.calls[0]![1]?.headers as Record<
      string,
      string
    >;
    expect(headers["Authorization"]).toBeUndefined();
    // Fast path: exact URL is passed through unchanged (no trailing-slash rewrite).
    expect(mockRequest).toHaveBeenCalledWith(
      "https://example.com",
      expect.anything(),
    );
  });
});

// ---------------------------------------------------------------------------
// fetcher.fetch — error cause enrichment
// ---------------------------------------------------------------------------

describe("fetcher.fetch — error cause enrichment", () => {
  it("appends undici's cause code to the error detail", async () => {
    mockRequest.mockRejectedValue(
      Object.assign(new TypeError("fetch failed"), {
        cause: { code: "ENOTFOUND" },
      }),
    );

    const fetcher = createFetcher();
    const result = await fetcher.fetch({ url: "https://nope.test" });

    expect(result.error).toBe("fetch failed (ENOTFOUND)");
  });

  it("uses a top-level error code when there is no cause", async () => {
    mockRequest.mockRejectedValue(
      Object.assign(new Error("connect"), { code: "UND_ERR_CONNECT_TIMEOUT" }),
    );

    const fetcher = createFetcher();
    const result = await fetcher.fetch({ url: "https://slow.test" });

    expect(result.error).toBe("connect (UND_ERR_CONNECT_TIMEOUT)");
  });

  it("falls back to the bare message when neither code nor cause is present", async () => {
    mockRequest.mockRejectedValue(new Error("ECONNREFUSED"));

    const fetcher = createFetcher();
    const result = await fetcher.fetch({ url: "https://unreachable.test" });

    expect(result.error).toBe("ECONNREFUSED");
  });
});

// ---------------------------------------------------------------------------
// fetcher.fetch — HTTP methods
// ---------------------------------------------------------------------------

describe("fetcher.fetch — HTTP methods", () => {
  it("defaults method to GET", async () => {
    mockRequest.mockResolvedValue(mockResponse(200, "") as any);

    const fetcher = createFetcher();
    await fetcher.fetch({ url: "https://example.com" });

    expect(mockRequest).toHaveBeenCalledWith(
      "https://example.com",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("passes POST method through", async () => {
    mockRequest.mockResolvedValue(mockResponse(200, "{}") as any);

    const fetcher = createFetcher();
    await fetcher.fetch({
      url: "https://example.com/api",
      method: HttpMethod.Post,
      body: '{"key":"value"}',
      contentType: "application/json",
    });

    expect(mockRequest).toHaveBeenCalledWith(
      "https://example.com/api",
      expect.objectContaining({
        method: "POST",
        body: '{"key":"value"}',
        headers: expect.objectContaining({
          "Content-Type": "application/json",
        }),
      }),
    );
  });

  it("does not read body for OPTIONS requests (dumps instead)", async () => {
    const resp = mockResponse(204, "");
    mockRequest.mockResolvedValue(resp as any);

    const fetcher = createFetcher();
    const result = await fetcher.fetch({
      url: "https://example.com",
      method: HttpMethod.Options,
    });

    expect(resp.body.dump).toHaveBeenCalled();
    expect(resp.body.read).not.toHaveBeenCalled();
    expect(result.body).toBe("");
  });

  it("reads body for GET requests", async () => {
    const resp = mockResponse(200, "response body");
    mockRequest.mockResolvedValue(resp as any);

    const fetcher = createFetcher();
    await fetcher.fetch({ url: "https://example.com" });

    expect(resp.body.read).toHaveBeenCalled();
    expect(resp.body.dump).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// fetcher.fetch — headers
// ---------------------------------------------------------------------------

describe("fetcher.fetch — request headers", () => {
  // Header names are case-insensitive on the wire. A caller's lowercase
  // `user-agent` must be replaced by the scanner's, not sent beside it as
  // one joined value.
  it("replaces a caller header of the same name in another casing", async () => {
    mockRequest.mockResolvedValue(mockResponse(200, "") as any);

    const fetcher = createFetcher({
      headers: { "user-agent": "CallerBot/1.0" },
    });
    await fetcher.fetch({
      url: "https://user:pw@example.com",
      headers: { authorization: "Bearer stale" },
    });

    const headers = mockRequest.mock.calls[0]![1]?.headers as Record<
      string,
      string
    >;
    const names = Object.keys(headers).map((k) => k.toLowerCase());
    expect(names.filter((n) => n === "user-agent")).toHaveLength(1);
    expect(names.filter((n) => n === "authorization")).toHaveLength(1);
    expect(headers["User-Agent"]).toBe(SCANNER_USER_AGENT);
    expect(headers["Authorization"]).toBe(
      `Basic ${Buffer.from("user:pw").toString("base64")}`,
    );
  });

  it("keeps a caller header the scanner does not set", async () => {
    mockRequest.mockResolvedValue(mockResponse(200, "") as any);

    const fetcher = createFetcher({ headers: { "X-Scan-Id": "abc" } });
    await fetcher.fetch({ url: "https://example.com" });

    const headers = mockRequest.mock.calls[0]![1]?.headers as Record<
      string,
      string
    >;
    expect(headers["X-Scan-Id"]).toBe("abc");
  });

  it("sets the custom User-Agent header", async () => {
    mockRequest.mockResolvedValue(mockResponse(200, "") as any);

    const fetcher = createFetcher();
    await fetcher.fetch({ url: "https://example.com" });

    expect(mockRequest).toHaveBeenCalledWith(
      "https://example.com",
      expect.objectContaining({
        headers: expect.objectContaining({
          "User-Agent": SCANNER_USER_AGENT,
        }),
      }),
    );
  });

  it("sets Accept header from acceptHeader option", async () => {
    mockRequest.mockResolvedValue(mockResponse(200, "") as any);

    const fetcher = createFetcher();
    await fetcher.fetch({
      url: "https://example.com",
      acceptHeader: "application/json",
    });

    expect(mockRequest).toHaveBeenCalledWith(
      "https://example.com",
      expect.objectContaining({
        headers: expect.objectContaining({
          Accept: "application/json",
        }),
      }),
    );
  });

  it("defaults Accept header to */*", async () => {
    mockRequest.mockResolvedValue(mockResponse(200, "") as any);

    const fetcher = createFetcher();
    await fetcher.fetch({ url: "https://example.com" });

    expect(mockRequest).toHaveBeenCalledWith(
      "https://example.com",
      expect.objectContaining({
        headers: expect.objectContaining({
          Accept: "*/*",
        }),
      }),
    );
  });

  it("does not set Content-Type for GET requests", async () => {
    mockRequest.mockResolvedValue(mockResponse(200, "") as any);

    const fetcher = createFetcher();
    await fetcher.fetch({ url: "https://example.com" });

    const callHeaders = mockRequest.mock.calls[0]![1]?.headers as Record<
      string,
      string
    >;
    expect(callHeaders["Content-Type"]).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// fetcher.fetch — request configuration
// ---------------------------------------------------------------------------

describe("fetcher.fetch — request configuration", () => {
  it("passes an AbortSignal for timeout", async () => {
    mockRequest.mockResolvedValue(mockResponse(200, "") as any);

    const fetcher = createFetcher();
    await fetcher.fetch({ url: "https://example.com", timeout: 5000 });

    const callOptions = mockRequest.mock.calls[0]![1] as any;
    expect(callOptions.signal).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// fetcher.fetch — body handling & header filtering
// ---------------------------------------------------------------------------

describe("fetcher.fetch — body and headers edge cases", () => {
  it("does not set Content-Type for POST without an explicit contentType", async () => {
    mockRequest.mockResolvedValue(mockResponse(200, "ok") as any);

    const fetcher = createFetcher();
    await fetcher.fetch({
      url: "https://example.com/api",
      method: HttpMethod.Post,
      body: "raw",
    });

    const callHeaders = mockRequest.mock.calls[0]![1]?.headers as Record<
      string,
      string
    >;
    expect(callHeaders["Content-Type"]).toBeUndefined();
  });

  it("truncates response bodies larger than MAX_RESPONSE_BODY_BYTES", async () => {
    const huge = "a".repeat(MAX_RESPONSE_BODY_BYTES + 100);
    mockRequest.mockResolvedValue(
      mockResponse(200, huge, { "content-type": "text/html" }) as any,
    );

    const fetcher = createFetcher();
    const result = await fetcher.fetch({ url: "https://example.com/big" });

    expect(result.body.length).toBe(MAX_RESPONSE_BODY_BYTES);
    expect(result.contentLength).toBe(MAX_RESPONSE_BODY_BYTES);
  });

  // A UTF-8 decode replaces every invalid sequence with U+FFFD, which destroys
  // the binary metadata the provenance audits read.
  it("returns raw bytes and an empty body when the request asks for binary", async () => {
    const bytes = new Uint8Array([
      0xff, 0xd8, 0xff, 0xeb, 0x00, 0x10, 0x4a, 0x50,
    ]);
    mockRequest.mockResolvedValue(
      mockBinaryResponse(bytes, { "content-type": "image/jpeg" }) as any,
    );

    const fetcher = createFetcher();
    const result = await fetcher.fetch({
      url: "https://example.com/a.jpg",
      binary: true,
    });

    expect(result.bytes).toBeInstanceOf(Uint8Array);
    expect(Array.from(result.bytes ?? [])).toEqual(Array.from(bytes));
    expect(result.body).toBe("");
    expect(result.contentLength).toBe(bytes.byteLength);
  });

  it("leaves bytes undefined for an ordinary text request", async () => {
    mockRequest.mockResolvedValue(
      mockResponse(200, "<html></html>", {
        "content-type": "text/html",
      }) as any,
    );

    const fetcher = createFetcher();
    const result = await fetcher.fetch({ url: "https://example.com/" });

    expect(result.bytes).toBeUndefined();
    expect(result.body).toBe("<html></html>");
  });

  it("stops reading an endless body instead of buffering it whole", async () => {
    const chunk = Buffer.alloc(1024 * 1024, 0x61);
    let yielded = 0;
    let closed = false;
    mockRequest.mockResolvedValue({
      statusCode: 200,
      headers: { "content-type": "text/html" },
      body: {
        async *[Symbol.asyncIterator]() {
          try {
            for (;;) {
              yielded++;
              yield chunk;
            }
          } finally {
            closed = true;
          }
        },
        dump: vi.fn().mockResolvedValue(undefined),
      },
    } as any);

    const result = await createFetcher().fetch({
      url: "https://example.com/endless",
    });

    expect(result.body.length).toBe(MAX_RESPONSE_BODY_BYTES);
    expect(closed).toBe(true);
    expect(yielded * chunk.length).toBeLessThanOrEqual(
      3 * MAX_RESPONSE_BODY_BYTES,
    );
  });

  it("keeps the first units of a multi-byte body exactly", async () => {
    const huge = "é".repeat(MAX_RESPONSE_BODY_BYTES + 10);
    mockRequest.mockResolvedValue(
      mockResponse(200, huge, { "content-type": "text/html" }) as any,
    );
    const result = await createFetcher().fetch({ url: "https://example.com/" });
    expect(result.body).toBe(huge.slice(0, MAX_RESPONSE_BODY_BYTES));
  });

  it("caps a binary response at MAX_RESPONSE_BODY_BYTES", async () => {
    const huge = new Uint8Array(MAX_RESPONSE_BODY_BYTES + 100).fill(0x41);
    mockRequest.mockResolvedValue(
      mockBinaryResponse(huge, { "content-type": "image/png" }) as any,
    );

    const fetcher = createFetcher();
    const result = await fetcher.fetch({
      url: "https://example.com/big.png",
      binary: true,
    });

    expect(result.bytes?.byteLength).toBe(MAX_RESPONSE_BODY_BYTES);
    expect(result.contentLength).toBe(MAX_RESPONSE_BODY_BYTES);
  });

  // RFC 9110 §5.3: repeated field lines are one field value. Set-Cookie is the
  // standing exception, because its own values may contain commas.
  it("keeps repeated Set-Cookie lines on separate lines", async () => {
    mockRequest.mockResolvedValue(
      mockResponse(200, "", {
        "content-type": "text/html",
        "set-cookie": ["a=1", "b=2"] as unknown as string,
      }) as any,
    );

    const fetcher = createFetcher();
    const result = await fetcher.fetch({ url: "https://example.com" });

    expect(result.headers["content-type"]).toBe("text/html");
    expect(result.headers["set-cookie"]).toBe("a=1\nb=2");
  });

  it('joins repeated header lines with ", " so none is lost', async () => {
    mockRequest.mockResolvedValue(
      mockResponse(200, "", {
        "x-robots-tag": [
          "googlebot: max-snippet:0",
          "noarchive",
        ] as unknown as string,
        "x-content-type-options": ["nosniff", "nosniff"] as unknown as string,
      }) as any,
    );

    const fetcher = createFetcher();
    const result = await fetcher.fetch({ url: "https://example.com" });

    expect(result.headers["x-robots-tag"]).toBe(
      "googlebot: max-snippet:0, noarchive",
    );
    expect(result.headers["x-content-type-options"]).toBe("nosniff, nosniff");
  });

  // There is one dispatcher now — the chain is walked here, not by undici — so
  // followRedirects is visible in how many requests are issued, not in which
  // dispatcher is passed.
  it("issues one request when followRedirects is false and walks the chain when it is not", async () => {
    mockRequest.mockResolvedValue(
      mockResponse(301, "", { location: "/next" }) as any,
    );

    const fetcher = createFetcher();
    await fetcher.fetch({
      url: "https://example.com/a",
      followRedirects: false,
    });
    expect(mockRequest).toHaveBeenCalledTimes(1);

    mockRequest.mockClear();
    await fetcher.fetch({ url: "https://example.com/a" });
    // The original request plus MAX_REDIRECTS hops.
    expect(mockRequest).toHaveBeenCalledTimes(MAX_REDIRECTS + 1);
  });

  it("ignores header values that are neither a string nor an array", async () => {
    mockRequest.mockResolvedValue(
      mockResponse(200, "", {
        "x-weird": undefined as unknown as string,
      }) as any,
    );

    const fetcher = createFetcher();
    const result = await fetcher.fetch({ url: "https://example.com" });

    expect(result.headers["x-weird"]).toBeUndefined();
  });

  it("defaults contentType to empty string when no content-type header present", async () => {
    mockRequest.mockResolvedValue(mockResponse(200, "body", {}) as any);

    const fetcher = createFetcher();
    const result = await fetcher.fetch({ url: "https://example.com" });

    expect(result.contentType).toBe("");
  });

  it("reports the error and ttfb when the body read fails after a response", async () => {
    mockRequest.mockResolvedValue({
      statusCode: 200,
      headers: {},
      body: {
        // oxlint-disable-next-line require-yield
        async *[Symbol.asyncIterator]() {
          throw new Error("body read failed");
        },
        dump: vi.fn().mockResolvedValue(undefined),
      },
    } as any);

    const fetcher = createFetcher();
    const result = await fetcher.fetch({ url: "https://example.com" });

    expect(result.status).toBe(0);
    expect(result.error).toBe("body read failed");
    expect(result.ttfbMs).toBeGreaterThanOrEqual(0);
  });
});

// ---------------------------------------------------------------------------
// isSafeUrl
// ---------------------------------------------------------------------------

describe("isSafeUrl", () => {
  it("rejects malformed URLs", async () => {
    expect(await isSafeUrl("not a url")).toBe(false);
  });

  it("rejects non-http(s) protocols", async () => {
    expect(await isSafeUrl("ftp://example.com/file")).toBe(false);
  });

  it("rejects localhost and loopback hostnames", async () => {
    expect(await isSafeUrl("http://localhost/")).toBe(false);
    expect(await isSafeUrl("http://127.0.0.1/")).toBe(false);
    expect(await isSafeUrl("http://[::1]/")).toBe(false);
  });

  // Regression: URL.hostname keeps the brackets, so the loopback comparison
  // never matched and this only failed because the DNS mock returned nothing.
  it("rejects an IPv6 loopback literal without a DNS lookup", async () => {
    mockLookup.mockResolvedValue({
      address: "93.184.216.34",
      family: 4,
    });
    expect(await isSafeUrl("http://[::1]/")).toBe(false);
    expect(mockLookup).not.toHaveBeenCalled();
  });

  it("rejects private IP literals without a DNS lookup", async () => {
    expect(await isSafeUrl("http://10.0.0.5/")).toBe(false);
    expect(mockLookup).not.toHaveBeenCalled();
  });

  it.each([
    "http://[::ffff:127.0.0.1]/",
    "http://[::ffff:10.0.0.7]/",
    "http://[::ffff:169.254.169.254]/",
    "http://[::]/",
  ])(
    "rejects the private IPv6 literal %s without a DNS lookup",
    async (url) => {
      expect(await isSafeUrl(url)).toBe(false);
      expect(mockLookup).not.toHaveBeenCalled();
    },
  );

  it("rejects hostnames that resolve to a private address", async () => {
    mockLookup.mockResolvedValue({ address: "10.1.2.3", family: 4 });
    expect(await isSafeUrl("https://internal.example.com/")).toBe(false);
  });

  it("accepts hostnames that resolve to a public address", async () => {
    mockLookup.mockResolvedValue({
      address: "93.184.216.34",
      family: 4,
    });
    expect(await isSafeUrl("https://example.com/")).toBe(true);
  });

  it("returns false when DNS lookup throws", async () => {
    mockLookup.mockRejectedValue(new Error("ENOTFOUND"));
    expect(await isSafeUrl("https://nonexistent.example/")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Redirect chain safety
// ---------------------------------------------------------------------------

describe("createFetcher redirect handling", () => {
  // mockClear leaves queued mockResolvedValueOnce implementations in place, so
  // an unconsumed queue would leak into the next case. Reset them per test.
  beforeEach(() => {
    mockRequest.mockReset();
    mockLookup.mockReset();
  });

  it("refuses to follow a redirect that leaves public address space", async () => {
    mockRequest
      .mockResolvedValueOnce(
        mockResponse(302, "", {
          location: "http://169.254.169.254/latest/meta-data/",
        }) as never,
      )
      .mockResolvedValueOnce(mockResponse(200, "internal secrets") as never);
    // The starting host resolves publicly, so the gate is armed.
    mockLookup.mockResolvedValue({
      address: "93.184.216.34",
      family: 4,
    });

    const result = await createFetcher().fetch({
      url: "https://example.com/start",
    });

    expect(result.error).toBe("redirect-refused");
    expect(result.body).toBe("");
    expect(result.finalUrl).toBe("https://example.com/start");
    expect(mockRequest).toHaveBeenCalledTimes(1);
  });

  it("refuses an IPv4-mapped IPv6 redirect without requesting the private hop", async () => {
    mockRequest
      .mockResolvedValueOnce(
        mockResponse(302, "", {
          location: "http://[::ffff:169.254.169.254]/latest/meta-data/",
        }) as never,
      )
      .mockResolvedValueOnce(mockResponse(200, "internal secrets") as never);
    mockLookup.mockResolvedValue({
      address: "93.184.216.34",
      family: 4,
    });

    const result = await createFetcher().fetch({
      url: "https://example.com/start",
    });

    expect(result.error).toBe("redirect-refused");
    expect(result.body).toBe("");
    expect(result.finalUrl).toBe("https://example.com/start");
    expect(mockRequest).toHaveBeenCalledTimes(1);
  });

  it("follows a same-site redirect and reports the URL that answered", async () => {
    mockRequest
      .mockResolvedValueOnce(
        mockResponse(301, "", { location: "/end" }) as never,
      )
      .mockResolvedValueOnce(mockResponse(200, "arrived") as never);
    mockLookup.mockResolvedValue({
      address: "93.184.216.34",
      family: 4,
    });

    const result = await createFetcher().fetch({
      url: "https://example.com/start",
    });

    expect(result.status).toBe(200);
    expect(result.body).toBe("arrived");
    expect(result.url).toBe("https://example.com/start");
    expect(result.finalUrl).toBe("https://example.com/end");
  });

  it("records every hop with its status, so a caller can tell a move from a detour", async () => {
    mockRequest
      .mockResolvedValueOnce(
        mockResponse(301, "", { location: "https://new.example/" }) as never,
      )
      .mockResolvedValueOnce(
        mockResponse(302, "", { location: "https://us.new.example/" }) as never,
      )
      .mockResolvedValueOnce(mockResponse(200, "arrived") as never);
    mockLookup.mockResolvedValue({
      address: "93.184.216.34",
      family: 4,
    });

    const result = await createFetcher().fetch({ url: "https://old.example/" });

    expect(result.redirectChain).toEqual([
      { status: 301, from: "https://old.example/", to: "https://new.example/" },
      {
        status: 302,
        from: "https://new.example/",
        to: "https://us.new.example/",
      },
    ]);
  });

  it("carries no redirect chain when the response was not a redirect", async () => {
    mockRequest.mockResolvedValueOnce(mockResponse(200, "direct") as never);

    const result = await createFetcher().fetch({ url: "https://example.com/" });

    expect(result.redirectChain).toBeUndefined();
  });

  it("does not follow redirects when followRedirects is false", async () => {
    mockRequest.mockResolvedValueOnce(
      mockResponse(302, "", { location: "/end" }) as never,
    );

    const result = await createFetcher().fetch({
      url: "https://example.com/start",
      followRedirects: false,
    });

    expect(result.status).toBe(302);
    expect(result.finalUrl).toBe("https://example.com/start");
    expect(mockRequest).toHaveBeenCalledTimes(1);
  });

  it("stops after MAX_REDIRECTS hops and returns the last response", async () => {
    for (let i = 0; i <= MAX_REDIRECTS; i += 1) {
      mockRequest.mockResolvedValueOnce(
        mockResponse(302, "", { location: `/hop-${i + 1}` }) as never,
      );
    }
    mockLookup.mockResolvedValue({
      address: "93.184.216.34",
      family: 4,
    });

    const result = await createFetcher().fetch({
      url: "https://example.com/hop-0",
    });

    expect(mockRequest).toHaveBeenCalledTimes(MAX_REDIRECTS + 1);
    expect(result.status).toBe(302);
    expect(result.finalUrl).toBe(
      `https://example.com/hop-${String(MAX_REDIRECTS)}`,
    );
  });

  // Some storefronts redirect until the cookie they set comes back. Without
  // it the chain ran to the hop limit and the scan read no page.
  it("sends cookies set on one hop back on the next hops of the chain", async () => {
    mockLookup.mockResolvedValue({ address: "93.184.216.34", family: 4 });
    mockRequest
      .mockResolvedValueOnce(
        mockResponse(302, "", {
          location: "https://www.example.com/locale",
          "set-cookie": [
            "session=abc; Path=/; Domain=example.com; Secure",
            "tracking=1; Domain=other.test",
          ] as unknown as string,
        }) as never,
      )
      .mockResolvedValueOnce(
        mockResponse(302, "", {
          location: "/en/",
          "set-cookie": "locale=en; Path=/",
        }) as never,
      )
      .mockResolvedValueOnce(mockResponse(200, "<html>home</html>") as never);

    const result = await createFetcher().fetch({
      url: "https://example.com/",
    });

    expect(result.status).toBe(200);
    const cookieOf = (call: number) =>
      (mockRequest.mock.calls[call]![1]!.headers as Record<string, string>)[
        "Cookie"
      ];
    expect(cookieOf(0)).toBeUndefined();
    expect(cookieOf(1)).toBe("session=abc");
    expect(cookieOf(2)).toBe("session=abc; locale=en");
  });

  it("starts every fetch with an empty cookie jar", async () => {
    mockLookup.mockResolvedValue({ address: "93.184.216.34", family: 4 });
    mockRequest
      .mockResolvedValueOnce(
        mockResponse(302, "", {
          location: "/b",
          "set-cookie": "session=abc; Path=/",
        }) as never,
      )
      .mockResolvedValueOnce(mockResponse(200, "") as never)
      .mockResolvedValueOnce(mockResponse(200, "") as never);

    const fetcher = createFetcher();
    await fetcher.fetch({ url: "https://example.com/a" });
    await fetcher.fetch({ url: "https://example.com/b" });

    const headers = mockRequest.mock.calls[2]![1]?.headers as Record<
      string,
      string
    >;
    expect(headers["Cookie"]).toBeUndefined();
  });

  // The cookies go only on hops, so the case above passes even with one jar
  // for every fetch. A second fetch that redirects too shows the leak.
  it("does not carry one fetch's cookies onto the hops of the next", async () => {
    mockLookup.mockResolvedValue({ address: "93.184.216.34", family: 4 });
    mockRequest
      .mockResolvedValueOnce(
        mockResponse(302, "", {
          location: "/b",
          "set-cookie": "session=abc; Path=/",
        }) as never,
      )
      .mockResolvedValueOnce(mockResponse(200, "") as never)
      .mockResolvedValueOnce(mockResponse(302, "", { location: "/d" }) as never)
      .mockResolvedValueOnce(mockResponse(200, "") as never);

    const fetcher = createFetcher();
    await fetcher.fetch({ url: "https://example.com/a" });
    await fetcher.fetch({ url: "https://example.com/c" });

    const headers = mockRequest.mock.calls[3]![1]?.headers as Record<
      string,
      string
    >;
    expect(mockRequest.mock.calls[3]![0]).toBe("https://example.com/d");
    expect(headers["Cookie"]).toBeUndefined();
  });

  // A caller's own Cookie header is kept on every hop. The cookies the chain
  // set are added after it, not put in its place.
  it("adds the chain's cookies after a Cookie header the caller sent", async () => {
    mockLookup.mockResolvedValue({ address: "93.184.216.34", family: 4 });
    mockRequest
      .mockResolvedValueOnce(
        mockResponse(302, "", {
          location: "/b",
          "set-cookie": "session=abc; Path=/",
        }) as never,
      )
      .mockResolvedValueOnce(mockResponse(302, "", { location: "/c" }) as never)
      .mockResolvedValueOnce(mockResponse(200, "") as never);

    await createFetcher().fetch({
      url: "https://example.com/a",
      headers: { cookie: "consent=yes" },
    });

    const cookieOf = (call: number) => {
      const headers = mockRequest.mock.calls[call]![1]!.headers as Record<
        string,
        string
      >;
      return Object.entries(headers)
        .filter(([name]) => name.toLowerCase() === "cookie")
        .map(([, value]) => value);
    };
    expect(cookieOf(0)).toEqual(["consent=yes"]);
    expect(cookieOf(1)).toEqual(["consent=yes; session=abc"]);
    expect(cookieOf(2)).toEqual(["consent=yes; session=abc"]);
  });

  // Browsers follow 20 redirects. Some storefronts take 6 or more hops to set
  // a locale cookie and land on the homepage; a limit of 5 read no page there.
  it("follows a chain longer than five hops to its answer", async () => {
    mockLookup.mockResolvedValue({ address: "93.184.216.34", family: 4 });
    for (let i = 0; i < 7; i += 1) {
      mockRequest.mockResolvedValueOnce(
        mockResponse(302, "", { location: `/hop-${String(i + 1)}` }) as never,
      );
    }
    mockRequest.mockResolvedValueOnce(mockResponse(200, "home") as never);

    const result = await createFetcher().fetch({
      url: "https://example.com/hop-0",
    });

    expect(result.status).toBe(200);
    expect(result.body).toBe("home");
    expect(result.finalUrl).toBe("https://example.com/hop-7");
    expect(result.redirectChain).toHaveLength(7);
  });

  it("continues a redirected POST as a GET without the body", async () => {
    mockRequest
      .mockResolvedValueOnce(
        mockResponse(303, "", { location: "/done" }) as never,
      )
      .mockResolvedValueOnce(mockResponse(200, "ok") as never);
    mockLookup.mockResolvedValue({
      address: "93.184.216.34",
      family: 4,
    });

    await createFetcher().fetch({
      url: "https://example.com/submit",
      method: HttpMethod.Post,
      body: '{"a":1}',
      contentType: "application/json",
    });

    const second = mockRequest.mock.calls[1]![1] as {
      method: string;
      body?: string;
    };
    expect(second.method).toBe("GET");
    expect(second.body).toBeUndefined();
  });

  it("still follows redirects when the scan target is itself a private host", async () => {
    mockRequest
      .mockResolvedValueOnce(
        mockResponse(302, "", {
          location: "http://127.0.0.1:3000/app",
        }) as never,
      )
      .mockResolvedValueOnce(mockResponse(200, "dev server") as never);

    const result = await createFetcher().fetch({
      url: "http://127.0.0.1:3000/",
    });

    expect(result.status).toBe(200);
    expect(result.body).toBe("dev server");
  });
});

// ---------------------------------------------------------------------------
// maxConcurrent — the wait must sit outside the clocks
// ---------------------------------------------------------------------------

describe("createFetcher — maxConcurrent", () => {
  /** A response that does not resolve until the test releases it. */
  function heldResponse(): {
    response: ReturnType<typeof mockResponse>;
    release: () => void;
  } {
    let release!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    const response = mockResponse(200, "ok");
    response.body.read = vi.fn(async () => {
      await held;
      return Buffer.from("ok");
    });
    return { response, release };
  }

  it("issues at most `maxConcurrent` requests at a time, in arrival order", async () => {
    const issued: string[] = [];
    const gates = [heldResponse(), heldResponse(), heldResponse()];
    let n = 0;
    mockRequest.mockImplementation(async (url: unknown) => {
      issued.push(String(url));
      return gates[n++]!.response as never;
    });

    const fetcher = createFetcher({ maxConcurrent: 1 });
    const all = Promise.all([
      fetcher.fetch({ url: "https://example.com/a" }),
      fetcher.fetch({ url: "https://example.com/b" }),
      fetcher.fetch({ url: "https://example.com/c" }),
    ]);

    await Promise.resolve();
    expect(issued).toEqual(["https://example.com/a"]);

    gates[0]!.release();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(issued).toEqual(["https://example.com/a", "https://example.com/b"]);

    gates[1]!.release();
    gates[2]!.release();
    await all;
    expect(issued).toEqual([
      "https://example.com/a",
      "https://example.com/b",
      "https://example.com/c",
    ]);
  });

  it("keeps the queued time out of ttfbMs", async () => {
    const first = heldResponse();
    let n = 0;
    mockRequest.mockImplementation(
      async () =>
        (n++ === 0 ? first.response : mockResponse(200, "ok")) as never,
    );

    const fetcher = createFetcher({ maxConcurrent: 1 });
    const queued = fetcher.fetch({ url: "https://example.com/second" });
    const held = fetcher.fetch({ url: "https://example.com/first" });

    // The second request waits ~30ms for the first, which is longer than the
    // request it then makes. Measured from `fetch()` it would carry that wait.
    await new Promise((resolve) => setTimeout(resolve, 30));
    first.release();

    const [a, b] = await Promise.all([queued, held]);
    expect(a.ttfbMs).toBeLessThan(20);
    expect(b.ttfbMs).toBeGreaterThanOrEqual(0);
  });

  it("releases its slot when a request throws", async () => {
    mockRequest.mockRejectedValueOnce(new Error("boom"));
    mockRequest.mockResolvedValueOnce(mockResponse(200, "ok") as never);

    const fetcher = createFetcher({ maxConcurrent: 1 });
    const failed = await fetcher.fetch({ url: "https://example.com/a" });
    expect(failed.status).toBe(0);

    const after = await fetcher.fetch({ url: "https://example.com/b" });
    expect(after.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// summary — what the scan logs about its requests at the end
// ---------------------------------------------------------------------------

describe("createFetcher — summary", () => {
  beforeEach(() => {
    mockRequest.mockReset();
  });

  // A request that never ends writes no "finished" line. The summary is the
  // only place a scan that ends with it still open can name it.
  it("names a request still waiting, without its credentials", async () => {
    let release!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    mockRequest.mockImplementation(async () => {
      await held;
      return mockResponse(200, "ok") as never;
    });

    const fetcher = createFetcher();
    const pending = fetcher.fetch({ url: "https://user:pw@example.com/slow" });
    await new Promise((resolve) => setTimeout(resolve, 5));

    const open = fetcher.summary().open;
    expect(open.map((entry) => entry.url)).toEqual([
      "https://example.com/slow",
    ]);
    expect(open[0]!.ms).toBeGreaterThanOrEqual(0);

    release();
    await pending;
    const done = fetcher.summary();
    expect(done.open).toEqual([]);
    expect(done.requests).toBe(1);
    expect(done.statuses).toEqual({ "2xx": 1 });
  });
});
