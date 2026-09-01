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
import { createFetcher, isSafeUrl, splitCredentials } from "./fetcher";

const mockRequest = vi.mocked(request);
const mockLookup = vi.mocked(dns.lookup);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockResponse(
  statusCode: number,
  body: string,
  headers: Record<string, string> = {},
) {
  return {
    statusCode,
    headers,
    body: {
      text: vi.fn().mockResolvedValue(body),
      arrayBuffer: vi
        .fn()
        .mockResolvedValue(Buffer.from(body, "binary").buffer),
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
      text: vi.fn().mockResolvedValue(""),
      arrayBuffer: vi
        .fn()
        .mockResolvedValue(
          bytes.buffer.slice(
            bytes.byteOffset,
            bytes.byteOffset + bytes.byteLength,
          ),
        ),
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

    const headers = mockRequest.mock.calls[0][1]?.headers as Record<
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
      method: "POST",
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
      method: "OPTIONS",
    });

    expect(resp.body.dump).toHaveBeenCalled();
    expect(resp.body.text).not.toHaveBeenCalled();
    expect(result.body).toBe("");
  });

  it("reads body for GET requests", async () => {
    const resp = mockResponse(200, "response body");
    mockRequest.mockResolvedValue(resp as any);

    const fetcher = createFetcher();
    await fetcher.fetch({ url: "https://example.com" });

    expect(resp.body.text).toHaveBeenCalled();
    expect(resp.body.dump).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// fetcher.fetch — headers
// ---------------------------------------------------------------------------

describe("fetcher.fetch — request headers", () => {
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

    const callHeaders = mockRequest.mock.calls[0][1]?.headers as Record<
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

    const callOptions = mockRequest.mock.calls[0][1] as any;
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
      method: "POST",
      body: "raw",
    });

    const callHeaders = mockRequest.mock.calls[0][1]?.headers as Record<
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
    expect(mockRequest).toHaveBeenCalledTimes(6);
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
        text: vi.fn().mockRejectedValue(new Error("body read failed")),
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
    } as any);
    expect(await isSafeUrl("http://[::1]/")).toBe(false);
    expect(mockLookup).not.toHaveBeenCalled();
  });

  it("rejects private IP literals without a DNS lookup", async () => {
    expect(await isSafeUrl("http://10.0.0.5/")).toBe(false);
    expect(mockLookup).not.toHaveBeenCalled();
  });

  it("rejects hostnames that resolve to a private address", async () => {
    mockLookup.mockResolvedValue({ address: "10.1.2.3", family: 4 } as any);
    expect(await isSafeUrl("https://internal.example.com/")).toBe(false);
  });

  it("accepts hostnames that resolve to a public address", async () => {
    mockLookup.mockResolvedValue({
      address: "93.184.216.34",
      family: 4,
    } as any);
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
    } as never);

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
    } as never);

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
    } as never);

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

  it("stops after five hops and returns the last response", async () => {
    for (let i = 0; i < 6; i += 1) {
      mockRequest.mockResolvedValueOnce(
        mockResponse(302, "", { location: `/hop-${i + 1}` }) as never,
      );
    }
    mockLookup.mockResolvedValue({
      address: "93.184.216.34",
      family: 4,
    } as never);

    const result = await createFetcher().fetch({
      url: "https://example.com/hop-0",
    });

    expect(mockRequest).toHaveBeenCalledTimes(6);
    expect(result.status).toBe(302);
    expect(result.finalUrl).toBe("https://example.com/hop-5");
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
    } as never);

    await createFetcher().fetch({
      url: "https://example.com/submit",
      method: "POST",
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
    response.body.text = vi.fn().mockImplementation(async () => {
      await held;
      return "ok";
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
