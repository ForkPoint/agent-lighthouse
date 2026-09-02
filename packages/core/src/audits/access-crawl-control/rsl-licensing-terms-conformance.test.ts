import { describe, it, expect, vi } from "vitest";
import { RslLicensingTermsConformanceAudit } from "./rsl-licensing-terms-conformance";
import {
  mockCheckContext,
  mockPageContext,
  mockFetchResult,
} from "../../__tests__/test-utils";
import { expectNotApplicableOnEmpty } from "../../tests/na-contract";
import type { CheckContext } from "../../check-context";
import type { FetchResult } from "../../fetcher";
import type { AuditResult } from "../../types";

/** A string-array detail, defaulted so the assertion reads the value not the optionality. */
const strings = (result: AuditResult, key: string): string[] =>
  (result.details?.[key] ?? []) as string[];

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
    expect((await audit.audit(ctx)).status).toBe("na");
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
    expect(result.status).toBe("na");
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
    expect(result.status).toBe("warn");
    expect(strings(result, "notes")[0]).toContain("no crawler is obliged");
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
    expect(result.status).toBe("fail");
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
    expect(result.status).toBe("fail");
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
    expect(result.status).toBe("pass");
    expect(result.details?.["validDocuments"]).toBe(1);
  });

  it("is a scored grade B audit with an id inside the cap", () => {
    const { meta } = RslLicensingTermsConformanceAudit;
    expect(meta.evidenceGrade).toBe("B");
    expect(meta.tier).toBe("scored");
    expect(meta.weight).toBeCloseTo(0.6);
    expect(meta.id.length).toBeLessThanOrEqual(64);
  });
});
