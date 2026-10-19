import { describe, it, expect, vi } from "vitest";
import { RslLicensingTermsConformanceAudit } from "./rsl-licensing-terms-conformance";
import {
  mockCheckContext,
  mockPageContext,
  mockFetchResult,
} from "#core/__tests__/test-utils";
import { expectNotApplicableOnEmpty } from "#core/tests/na-contract";
import type { CheckContext } from "#core/check-context";
import type { FetchResult } from "#core/fetcher";
import type { AuditResult } from "#core/types";
import { AuditTier, CheckStatus, EvidenceGrade } from "#core/types";

/** A string-array detail, defaulted so the assertion reads the value not the optionality. */
const strings = (result: AuditResult, key: string): string[] =>
  (result.details?.[key] ?? []) as string[];

vi.mock("#core/fetcher", async (importOriginal) => {
  const actual = await importOriginal<typeof import("#core/fetcher")>();
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

const RSL = `<rsl xmlns="https://rslstandard.org/rsl">
  <content url="/">
    <license>
      <permits type="usage">search</permits>
      <prohibits type="usage">train-ai</prohibits>
      <payment type="crawl"><amount currency="USD">0.01</amount></payment>
    </license>
    <copyright type="holder" contactEmail="legal@example.com"/>
  </content>
</rsl>`;

interface SiteSpec {
  robots?: string;
  headers?: Record<string, string>;
  head?: string;
  body?: string;
  files?: Record<string, FetchResult>;
  pageUrl?: string;
}

function site(spec: SiteSpec): { ctx: CheckContext; fetched: string[] } {
  const page = mockPageContext(
    spec.pageUrl ?? "https://example.com/",
    `<html><head>${spec.head ?? ""}</head><body>${spec.body ?? "<p>Hi.</p>"}</body></html>`,
  );
  Object.assign(page.fetchResult.headers, spec.headers ?? {});
  const rootFiles: Record<string, FetchResult> = {};
  if (spec.robots !== undefined)
    rootFiles["/robots.txt"] = mockFetchResult(spec.robots, 200, "text/plain");
  const ctx = mockCheckContext([page], rootFiles);
  const fetched: string[] = [];
  ctx.fetch = async ({ url }) => {
    fetched.push(url);
    return spec.files?.[url] ?? mockFetchResult("", 404, "text/plain");
  };
  return { ctx, fetched };
}

const rslFile = (xml = RSL, type = "application/rsl+xml", status = 200) =>
  mockFetchResult(xml, status, type);

describe("RslLicensingTermsConformanceAudit", () => {
  const audit = new RslLicensingTermsConformanceAudit();

  it("is notApplicable on an empty site", async () => {
    await expectNotApplicableOnEmpty(audit);
  });

  it("is notApplicable when no channel advertises a licence and no path carries one", async () => {
    const { ctx } = site({ robots: "User-agent: *\nAllow: /\n" });
    expect((await audit.audit(ctx)).status).toBe(CheckStatus.NotApplicable);
  });

  it("collects candidates from all four channels", async () => {
    const { ctx } = site({
      robots: "License: https://example.com/a.xml\n",
      headers: {
        link: '<https://example.com/b.xml>; rel="license"; type="application/rsl+xml"',
      },
      head: '<link rel="license" type="application/rsl+xml" href="/c.xml">',
      body: `<script type="application/rsl+xml">${RSL}</script>`,
      files: {
        "https://example.com/a.xml": rslFile(),
        "https://example.com/b.xml": rslFile(),
        "https://example.com/c.xml": rslFile(),
      },
    });
    const result = await audit.audit(ctx);
    const channels = strings(result, "channels");
    expect(channels.some((c) => c.includes("robots.txt License:"))).toBe(true);
    expect(channels.some((c) => c.includes("Link: rel=license"))).toBe(true);
    expect(channels.some((c) => c.includes('<link rel="license">'))).toBe(true);
    expect(channels.some((c) => c.includes("inline <script"))).toBe(true);
  });

  it("reports a relative License: value rather than resolving it", async () => {
    const { ctx, fetched } = site({ robots: "License: /license.xml\n" });
    const result = await audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.NotApplicable);
    expect(result.found).toContain("not an absolute URI");
    // The only requests are the conventional-path probes, which run because
    // nothing valid was advertised. The relative value itself is never resolved.
    expect(fetched).toEqual([
      "https://example.com/license.xml",
      "https://example.com/rsl.xml",
    ]);
  });

  it("reports a document found only by probing a conventional path", async () => {
    const { ctx } = site({
      robots: "User-agent: *\nAllow: /\n",
      files: { "https://example.com/license.xml": rslFile() },
    });
    const result = await audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.Warn);
    expect(strings(result, "notes")[0]).toContain("no crawler is obliged");
  });

  // A guessed path that redirects to the homepage carries no licence. The
  // fetcher follows the redirect, so the body is the storefront's HTML.
  const homepageVia = (finalUrl: string): FetchResult => {
    const result = mockFetchResult(
      "<!doctype html><html><head><title>Shop</title></head><body><h1>New arrivals</h1></body></html>",
      200,
      "text/html",
    );
    result.finalUrl = finalUrl;
    result.redirectChain = [
      { status: 301, from: "https://example.com/license.xml", to: finalUrl },
    ];
    return result;
  };

  it("is notApplicable when the conventional paths redirect to the homepage", async () => {
    const { ctx } = site({
      robots: "User-agent: *\nAllow: /\n",
      files: {
        "https://example.com/license.xml": homepageVia("https://example.com/"),
        "https://example.com/rsl.xml": homepageVia("https://example.com/"),
      },
    });
    const result = await audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.NotApplicable);
    expect(result.details?.["conformanceErrors"]).toBeUndefined();
  });

  it("is notApplicable when a conventional path answers 200 with HTML", async () => {
    const { ctx } = site({
      robots: "User-agent: *\nAllow: /\n",
      files: {
        "https://example.com/rsl.xml": mockFetchResult(
          "<html><body><p>Page not found</p></body></html>",
          200,
          "text/html",
        ),
      },
    });
    expect((await audit.audit(ctx)).status).toBe(CheckStatus.NotApplicable);
  });

  // True positive: a guessed path that redirects to a real RSL document is
  // still found, and still reported as not discoverable.
  it("still reports an RSL document a conventional path redirects to", async () => {
    const moved = rslFile();
    moved.finalUrl = "https://example.com/legal/rsl.xml";
    const { ctx } = site({
      robots: "User-agent: *\nAllow: /\n",
      files: { "https://example.com/license.xml": moved },
    });
    const result = await audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.Warn);
    expect(strings(result, "notes")[0]).toContain("no crawler is obliged");
  });

  // True positive: an advertised licence is never filtered by the probe rule.
  // A robots.txt License: line that points at HTML still fails.
  it("still fails an advertised licence that is not an RSL document", async () => {
    const { ctx } = site({
      robots: "License: https://example.com/a.xml\n",
      files: {
        "https://example.com/a.xml": mockFetchResult(
          "<html><body>Terms</body></html>",
          200,
          "text/html",
        ),
      },
    });
    const result = await audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.Fail);
    const errors = strings(result, "conformanceErrors").join(" ");
    expect(errors).toContain("root element is not <rsl>");
    expect(errors).toContain("application/rsl+xml");
  });

  it("fails a wrong namespace", async () => {
    const { ctx } = site({
      robots: "License: https://example.com/a.xml\n",
      files: {
        "https://example.com/a.xml": rslFile(
          RSL.replace("https://rslstandard.org/rsl", "https://example.com/ns"),
        ),
      },
    });
    const result = await audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.Fail);
    expect(strings(result, "conformanceErrors").join(" ")).toContain("xmlns");
  });

  it("fails a content prefix that does not cover the audited pages", async () => {
    const { ctx } = site({
      pageUrl: "https://example.com/articles/one",
      robots: "License: https://example.com/a.xml\n",
      files: {
        "https://example.com/a.xml": rslFile(
          RSL.replace('url="/"', 'url="/blog/"'),
        ),
      },
    });
    const result = await audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.Fail);
    expect(strings(result, "conformanceErrors").join(" ")).toContain(
      "/articles/one",
    );
  });

  it("validates the enumerated attributes and the amount", async () => {
    const broken = RSL.replace(
      'type="usage">search',
      'type="everything">search',
    )
      .replace('type="crawl"', 'type="donation"')
      .replace('currency="USD">0.01', 'currency="XYZ">free');
    const { ctx } = site({
      robots: "License: https://example.com/a.xml\n",
      files: { "https://example.com/a.xml": rslFile(broken) },
    });
    const errors = strings(await audit.audit(ctx), "conformanceErrors").join(
      " ",
    );
    expect(errors).toContain("usage, user, geo");
    expect(errors).toContain('<payment type="donation">');
    expect(errors).toContain("ISO 4217");
    expect(errors).toContain("does not parse as a decimal");
  });

  it("reports a copyright with no contact and a wrong content type", async () => {
    const { ctx } = site({
      robots: "License: https://example.com/a.xml\n",
      files: {
        "https://example.com/a.xml": rslFile(
          RSL.replace(' contactEmail="legal@example.com"', ""),
          "text/xml",
        ),
      },
    });
    const errors = strings(await audit.audit(ctx), "conformanceErrors").join(
      " ",
    );
    expect(errors).toContain("contactEmail");
    expect(errors).toContain("application/rsl+xml");
  });

  it("passes an advertised, conformant licence", async () => {
    const { ctx } = site({
      robots: "License: https://example.com/a.xml\n",
      files: { "https://example.com/a.xml": rslFile() },
    });
    const result = await audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.Pass);
    expect(result.details?.["validDocuments"]).toBe(1);
  });

  it("passes a conformant inline RSL document without fetching it", async () => {
    const { ctx, fetched } = site({
      body: `<script type="application/rsl+xml">   </script><script type="application/rsl+xml">${RSL}</script>`,
    });
    const result = await audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.Pass);
    expect(result.details?.["documents"]).toBe(1);
    expect(fetched).toEqual([]);
  });

  it("ignores licence links that do not name the RSL media type", async () => {
    const { ctx } = site({
      robots: "User-agent: *\nAllow: /\n",
      headers: {
        link: '<https://creativecommons.org/licenses/by/4.0/>; rel="license"',
      },
      head: '<link rel="license" href="https://creativecommons.org/licenses/by/4.0/">',
    });
    const result = await audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.NotApplicable);
  });

  it("names an unresolvable licence link and reads no licence from it", async () => {
    const { ctx } = site({
      headers: {
        link: '<http://[>; rel="license"; type="application/rsl+xml"',
      },
      head: '<link rel="license" type="application/rsl+xml" href="http://[">',
    });
    const result = await audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.NotApplicable);
    expect(result.found).toContain("unresolvable licence URL");
    expect(result.found).toContain("unresolvable href");
  });

  it("reads a URL advertised in two channels once", async () => {
    const { ctx, fetched } = site({
      robots: "License: https://example.com/a.xml\n",
      head: '<link rel="license" type="application/rsl+xml; charset=utf-8" href="/a.xml">',
      files: { "https://example.com/a.xml": rslFile() },
    });
    const result = await audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.Pass);
    expect(fetched).toEqual(["https://example.com/a.xml"]);
    expect(result.details?.["documents"]).toBe(1);
  });

  it("fails an advertised licence the scanner will not fetch", async () => {
    const { ctx, fetched } = site({
      robots: "License: http://127.0.0.1/rsl.xml\n",
    });
    const result = await audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.Fail);
    expect(fetched).toEqual([]);
    expect(strings(result, "conformanceErrors")[0]).toContain(
      "is not a URL this scanner will fetch",
    );
  });

  it("fails an advertised licence that does not answer 200", async () => {
    const { ctx } = site({ robots: "License: https://example.com/a.xml\n" });
    const result = await audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.Fail);
    expect(strings(result, "conformanceErrors")[0]).toContain(
      "answered HTTP 404",
    );
  });

  it("reads the content type from the result when the header map has none", async () => {
    const file = rslFile();
    delete file.headers["content-type"];
    const { ctx } = site({
      robots: "License: https://example.com/a.xml\n",
      files: { "https://example.com/a.xml": file },
    });
    expect((await audit.audit(ctx)).status).toBe(CheckStatus.Pass);
  });

  it("fails a document with no content element", async () => {
    const { ctx } = site({
      robots: "License: https://example.com/a.xml\n",
      files: {
        "https://example.com/a.xml": rslFile(
          '<rsl xmlns="https://rslstandard.org/rsl"><license><permits type="usage">search</permits></license></rsl>',
        ),
      },
    });
    const result = await audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.Fail);
    expect(strings(result, "conformanceErrors")[0]).toContain(
      "no <content url=…> element",
    );
    expect(result.details?.["validDocuments"]).toBe(0);
  });

  it("fails a content element with no licence, and a licence with no terms", async () => {
    const noLicence = site({
      robots: "License: https://example.com/a.xml\n",
      files: {
        "https://example.com/a.xml": rslFile(
          '<rsl xmlns="https://rslstandard.org/rsl"><content url="/"></content></rsl>',
        ),
      },
    });
    const first = await audit.audit(noLicence.ctx);
    expect(first.status).toBe(CheckStatus.Fail);
    expect(strings(first, "conformanceErrors")).toContain(
      "robots.txt License: line 1: no <license> element",
    );

    const empty = site({
      robots: "License: https://example.com/a.xml\n",
      files: {
        "https://example.com/a.xml": rslFile(
          '<rsl xmlns="https://rslstandard.org/rsl"><content url="/"><license></license></content></rsl>',
        ),
      },
    });
    const second = await audit.audit(empty.ctx);
    expect(second.status).toBe(CheckStatus.Fail);
    expect(strings(second, "conformanceErrors")[0]).toContain(
      "carries no permits, prohibits or payment",
    );
  });

  it("names missing type and currency attributes", async () => {
    const broken = RSL.replace('<prohibits type="usage">', "<prohibits>")
      .replace('<payment type="crawl">', "<payment>")
      .replace('currency="USD"', "");
    const { ctx } = site({
      robots: "License: https://example.com/a.xml\n",
      files: { "https://example.com/a.xml": rslFile(broken) },
    });
    const errors = strings(await audit.audit(ctx), "conformanceErrors").join(
      " ",
    );
    expect(errors).toContain('<prohibits type="missing">');
    expect(errors).toContain('<payment type="missing">');
    expect(errors).toContain('<amount currency="missing">');
  });

  it("compares an unparseable content url as written", async () => {
    const { ctx } = site({
      robots: "License: https://example.com/a.xml\n",
      files: {
        "https://example.com/a.xml": rslFile(
          RSL.replace('url="/"', 'url="http://["'),
        ),
      },
    });
    const result = await audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.Fail);
    expect(strings(result, "conformanceErrors")[0]).toContain(
      "<content url> covers http://[",
    );
  });

  it("is a scored grade B audit with an id inside the cap", () => {
    const { meta } = RslLicensingTermsConformanceAudit;
    expect(meta.evidenceGrade).toBe(EvidenceGrade.B);
    expect(meta.tier).toBe(AuditTier.Scored);
    expect(meta.weight).toBeCloseTo(0.6);
    expect(meta.id.length).toBeLessThanOrEqual(64);
  });
});
