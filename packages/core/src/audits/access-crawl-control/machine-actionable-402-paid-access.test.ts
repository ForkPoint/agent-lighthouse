import { describe, it, expect, vi } from "vitest";
import { MachineActionable402PaidAccessAudit } from "./machine-actionable-402-paid-access";
import {
  mockPageContext,
  mockCheckContext,
  mockFetchResult,
} from "../../__tests__/test-utils";
import { expectNotApplicableOnEmpty } from "../../tests/na-contract";
import { BASELINE_UA } from "../../gatherers/ua-parity";
import type { FetchOptions, FetchResult } from "../../fetcher";
import type { AuditResult } from "../../types";

vi.mock("../../fetcher", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../fetcher")>();
  return {
    ...actual,
    isSafeUrl: async (url: string) => {
      try {
        const { protocol, hostname } = new URL(url);
        if (protocol !== "http:" && protocol !== "https:") return false;
        return !/^(localhost$|127\.|\[?::1\]?$|10\.|192\.168\.)/.test(hostname);
      } catch {
        return false;
      }
    },
  };
});

const PAGE = `<html><body><main><p>${"the resole kit ships in three sizes ".repeat(40)}</p></main></body></html>`;

const strings = (result: AuditResult, key: string): string[] =>
  (result.details?.[key] ?? []) as string[];

const RSL_CRAWL = `<rsl xmlns="https://rslstandard.org/rsl"><content url="/">
  <license><payment type="crawl"><amount currency="USD">0.01</amount></payment></license>
</content></rsl>`;

interface RunOptions {
  /** Headers on the 402 every crawler UA receives. Omit for no 402 at all. */
  challenge?: Record<string, string>;
  challengeBody?: string;
  /** Answer the browser baseline 402 as well. */
  hitBrowsers?: boolean;
  robots?: string;
  inlineRsl?: string;
}

function run(options: RunOptions = {}) {
  const audit = new MachineActionable402PaidAccessAudit();
  const rootFiles: Record<string, FetchResult> = {};
  if (options.robots)
    rootFiles["/robots.txt"] = mockFetchResult(
      options.robots,
      200,
      "text/plain",
    );

  const body = options.inlineRsl
    ? `${PAGE}<script type="application/rsl+xml">${options.inlineRsl}</script>`
    : PAGE;
  const ctx = mockCheckContext(
    [mockPageContext("https://example.com/", body)],
    rootFiles,
  );

  const challenge = (): FetchResult => {
    const result = mockFetchResult(
      options.challengeBody ?? "<html>Pay up.</html>",
      402,
      "text/html",
    );
    Object.assign(result.headers, options.challenge ?? {});
    return result;
  };

  ctx.fetch = async (o: FetchOptions): Promise<FetchResult> => {
    if (new URL(o.url).pathname === "/sitemap.xml")
      return mockFetchResult("", 404, "text/plain");
    if (o.userAgent === BASELINE_UA) {
      return options.hitBrowsers
        ? challenge()
        : mockFetchResult(PAGE, 200, "text/html");
    }
    return options.challenge === undefined && !options.hitBrowsers
      ? mockFetchResult(PAGE, 200, "text/html")
      : challenge();
  };
  return audit.audit(ctx);
}

/** A valid x402 challenge, base64 as the header carries it. */
const x402 = (overrides: Record<string, unknown> = {}) =>
  Buffer.from(
    JSON.stringify({
      x402Version: 1,
      accepts: [
        {
          scheme: "exact",
          network: "base",
          amount: "1000",
          asset: "USDC",
          payTo: "0xabc",
        },
      ],
      ...overrides,
    }),
  ).toString("base64");

describe("MachineActionable402PaidAccessAudit", () => {
  const audit = new MachineActionable402PaidAccessAudit();

  it("is notApplicable on an empty site", async () => {
    await expectNotApplicableOnEmpty(audit);
  });

  it("is notApplicable when no 402 is observed, never a failure", async () => {
    const result = await run();
    expect(result.status).toBe("na");
    expect(result.found).toContain("none answered 402");
  });

  it("accepts a well-formed crawler-price header", async () => {
    const result = await run({
      challenge: { "crawler-price": "USD 0.01", "cache-control": "no-store" },
    });
    expect(result.status).toBe("pass");
    expect(strings(result, "mechanisms")).toContain("crawler-price header");
  });

  it("accepts an x402 PAYMENT-REQUIRED challenge", async () => {
    const result = await run({
      challenge: { "payment-required": x402(), "cache-control": "no-store" },
    });
    expect(result.status).toBe("pass");
    expect(strings(result, "mechanisms")).toContain(
      "x402 PAYMENT-REQUIRED challenge",
    );
  });

  it("accepts an RSL crawl payment covering the path", async () => {
    const result = await run({
      challenge: { "cache-control": "no-store" },
      inlineRsl: RSL_CRAWL,
      robots: "License: https://example.com/license.xml\n",
    });
    expect(result.status).toBe("pass");
    expect(strings(result, "mechanisms")).toContain(
      "RSL licence with a crawl payment",
    );
  });

  it("fails a 402 that carries only HTML", async () => {
    const result = await run({ challenge: {} });
    expect(result.status).toBe("fail");
    expect(strings(result, "findings")[0]).toContain("no crawler-price");
  });

  it("reports a malformed price and a malformed x402 challenge as their own findings", async () => {
    const price = await run({ challenge: { "crawler-price": "dollars 1" } });
    expect(strings(price, "findings").join(" ")).toContain(
      'is not "<ISO 4217 code> <decimal>"',
    );

    const currency = await run({ challenge: { "crawler-price": "XYZ 1.00" } });
    expect(strings(currency, "findings").join(" ")).toContain(
      "not an active ISO 4217 code",
    );

    const empty = await run({
      challenge: { "payment-required": x402({ accepts: [] }) },
    });
    expect(strings(empty, "findings").join(" ")).toContain(
      "no non-empty accepts array",
    );

    const missing = await run({
      challenge: {
        "payment-required": Buffer.from(
          JSON.stringify({ x402Version: 1, accepts: [{ scheme: "exact" }] }),
        ).toString("base64"),
      },
    });
    expect(strings(missing, "findings").join(" ")).toContain(
      "is missing network, amount, asset, payTo",
    );
  });

  it("reports a 402 a shared cache may store", async () => {
    const result = await run({
      challenge: {
        "crawler-price": "USD 0.01",
        "cache-control": "public, max-age=3600",
      },
    });
    expect(result.status).toBe("warn");
    expect(strings(result, "findings").join(" ")).toContain("shared cache");
  });

  it("reports a 402 that the browser baseline received too", async () => {
    const result = await run({
      challenge: { "crawler-price": "USD 0.01", "cache-control": "no-store" },
      hitBrowsers: true,
    });
    expect(result.status).toBe("warn");
    expect(result.details?.["browserFacing402s"]).toBeGreaterThan(0);
    expect(strings(result, "findings").join(" ")).toContain("hitting people");
  });

  it("is a scored grade B audit with an id inside the cap", () => {
    const { meta } = MachineActionable402PaidAccessAudit;
    expect(meta.evidenceGrade).toBe("B");
    expect(meta.tier).toBe("scored");
    expect(meta.weight).toBeCloseTo(0.6);
    expect(meta.id.length).toBeLessThanOrEqual(64);
  });
});
