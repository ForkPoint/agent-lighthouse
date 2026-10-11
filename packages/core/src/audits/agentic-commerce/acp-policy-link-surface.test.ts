import { describe, it, expect, vi } from "vitest";
import { AcpPolicyLinkSurfaceAudit } from "./acp-policy-link-surface";
import {
  mockPageContext,
  mockCheckContext,
  mockFetchResult,
} from "#core/__tests__/test-utils";
import { expectNotApplicableOnEmpty } from "#core/tests/na-contract";
import type { FetchOptions, FetchResult } from "#core/fetcher";
import { CheckStatus } from "#core/types";

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

function policyPage(title: string) {
  return `<html><head><title>${title}</title></head><body><main><h1>${title}</h1><p>${"This policy explains the terms that apply. ".repeat(
    20,
  )}</p></main></body></html>`;
}

const ALL_LINKS = `
  <a href="/terms">Terms of Service</a>
  <a href="/privacy">Privacy Policy</a>
  <a href="/returns">Returns</a>
  <a href="/shipping">Shipping</a>
  <a href="/contact">Contact us</a>
  <a href="/about">About us</a>
  <a href="/faq">FAQ</a>
  <a href="/support">Support</a>`;

function redirect(to: string): FetchResult {
  const result = mockFetchResult("", 301, "text/html");
  result.headers["location"] = to;
  return result;
}

function run(body: string, responses: Record<string, FetchResult> = {}) {
  const audit = new AcpPolicyLinkSurfaceAudit();
  const html = `<html><head></head><body>${body}</body></html>`;
  const ctx = mockCheckContext([mockPageContext("https://example.com/", html)]);
  ctx.fetch = async (o: FetchOptions) => {
    const override = responses[new URL(o.url).pathname];
    if (override) return override;
    const path = new URL(o.url).pathname.replace(/^\//, "") || "home";
    return mockFetchResult(policyPage(path), 200, "text/html");
  };
  return audit.audit(ctx);
}

describe("AcpPolicyLinkSurfaceAudit", () => {
  const audit = new AcpPolicyLinkSurfaceAudit();

  it("is notApplicable on an empty site", async () => {
    await expectNotApplicableOnEmpty(audit);
  });

  it("is notApplicable when the pages carry no <a href> at all", async () => {
    const result = await run("<main><p>Copy with no links.</p></main>");
    expect(result.status).toBe(CheckStatus.NotApplicable);
  });

  it("passes when all 8 link types resolve to real policy pages", async () => {
    const result = await run(`<footer>${ALL_LINKS}</footer>`);
    expect(result.status).toBe(CheckStatus.Pass);
    expect(result.found).toContain("8/8");
  });

  // terms_of_use and privacy_policy are hard gates: without them a merchant
  // cannot set is_eligible_checkout=true at all.
  it("fails when terms_of_use is missing, whatever the other seven do", async () => {
    const links = ALL_LINKS.replace(
      '<a href="/terms">Terms of Service</a>',
      "",
    );
    const result = await run(`<footer>${links}</footer>`);
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.message).toContain("terms_of_use");
  });

  it("fails when privacy_policy resolves to a soft 404", async () => {
    const soft = mockFetchResult(
      "<html><head><title>Page not found</title></head><body><h1>Page not found</h1></body></html>",
      200,
      "text/html",
    );
    const result = await run(`<footer>${ALL_LINKS}</footer>`, {
      "/privacy": soft,
    });
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.message).toContain("privacy_policy");
  });

  it("fails a policy link that sits behind more than 3 redirects", async () => {
    const result = await run(`<footer>${ALL_LINKS}</footer>`, {
      "/terms": redirect("/t1"),
      "/t1": redirect("/t2"),
      "/t2": redirect("/t3"),
      "/t3": redirect("/t4"),
    });
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.message).toContain("redirect");
  });

  // The ACP Link schema asks only for `url: string, format: uri`. Nothing
  // documents a same-domain requirement, so a sister domain is a usable target.
  it("accepts a policy link on a different registrable domain", async () => {
    const links = ALL_LINKS.replace(
      "/terms",
      "https://legal.example-group.net/terms",
    );
    const result = await run(`<footer>${links}</footer>`);
    expect(result.status).toBe(CheckStatus.Pass);
    expect(result.found).toContain(
      "terms_of_use=https://legal.example-group.net/terms",
    );
  });

  it("accepts a cross-domain redirect to a PDF policy", async () => {
    const pdf = mockFetchResult(
      "%PDF-1.7\n1 0 obj << /Type /Catalog >> endobj",
      200,
      "application/pdf",
    );
    const result = await run(`<footer>${ALL_LINKS}</footer>`, {
      "/terms": redirect("https://cdn.example-assets.net/legal/terms.pdf"),
      "/legal/terms.pdf": pdf,
      "/privacy": redirect("https://cdn.example-assets.net/legal/privacy.pdf"),
      "/legal/privacy.pdf": pdf,
    });
    expect(result.status).toBe(CheckStatus.Pass);
    expect(result.found).toContain(
      "terms_of_use=https://cdn.example-assets.net/legal/terms.pdf",
    );
  });

  // True positives that must survive the change.
  it("still fails a PDF content type whose body is not a PDF", async () => {
    const result = await run(`<footer>${ALL_LINKS}</footer>`, {
      "/terms": mockFetchResult(
        "<html><body>Error</body></html>",
        200,
        "application/pdf",
      ),
    });
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.message).toContain("terms_of_use");
    expect(result.message).toContain("PDF");
  });

  it("still fails a policy served as a type that is neither HTML nor PDF", async () => {
    const result = await run(`<footer>${ALL_LINKS}</footer>`, {
      "/privacy": mockFetchResult("{}", 200, "application/json"),
    });
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.message).toContain("application/json");
  });

  it("still gates an off-domain policy link through the URL safety check", async () => {
    const links = ALL_LINKS.replace("/terms", "https://192.168.1.10/terms");
    const result = await run(`<footer>${links}</footer>`);
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.message).toContain("safety gate");
  });

  it("still fails an off-domain policy link that is a soft 404", async () => {
    const links = ALL_LINKS.replace(
      "/privacy",
      "https://legal.example-group.net/privacy",
    );
    const soft = mockFetchResult(
      "<html><head><title>Page not found</title></head><body><h1>Page not found</h1></body></html>",
      200,
      "text/html",
    );
    const result = await run(`<footer>${links}</footer>`, { "/privacy": soft });
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.message).toContain("soft 404");
  });

  // ACP link targets are opened by agents that may not execute JS.
  it("fails a policy page whose text is absent from the initial HTML", async () => {
    const shell = mockFetchResult(
      `<html><head><title>Terms</title></head><body><div id="root"></div><script>window.__DATA__=${JSON.stringify(
        { body: "x".repeat(4000) },
      )}</script></body></html>`,
      200,
      "text/html",
    );
    const result = await run(`<footer>${ALL_LINKS}</footer>`, {
      "/terms": shell,
    });
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.message).toContain("initial HTML");
  });

  it("warns with the ratio and the resolved URLs when 6 of 8 types resolve", async () => {
    const links = ALL_LINKS.replace('<a href="/faq">FAQ</a>', "").replace(
      '<a href="/support">Support</a>',
      "",
    );
    const result = await run(`<footer>${links}</footer>`);
    expect(result.status).toBe(CheckStatus.Warn);
    expect(result.found).toContain("6/8");
    expect(result.found).toContain("terms_of_use=https://example.com/terms");
  });

  it("reports the page the links were read from", async () => {
    const result = await run(`<footer>${ALL_LINKS}</footer>`);
    expect(result.pageUrl).toBe("https://example.com/");
  });
});
