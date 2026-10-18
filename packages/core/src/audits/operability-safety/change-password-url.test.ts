import { describe, it, expect, vi } from "vitest";
import { ChangePasswordUrlAudit } from "./change-password-url";
import {
  mockCheckContext,
  mockFetchResult,
  mockPageContext,
} from "#core/__tests__/test-utils";
import type { CheckContext } from "#core/check-context";
import type { FetchResult } from "#core/fetcher";
import { AuditResultSchema } from "#core/schemas";
import { CheckStatus } from "#core/types";

vi.mock("#core/fetcher", async (importOriginal) => {
  const actual = await importOriginal<typeof import("#core/fetcher")>();
  return {
    ...actual,
    isSafeUrl: async (url: string) => {
      try {
        const { protocol } = new URL(url);
        return protocol === "http:" || protocol === "https:";
      } catch {
        return false;
      }
    },
  };
});

const WELL_KNOWN = "https://example.com/.well-known/change-password";

const LOGIN_PAGE = mockPageContext(
  "https://example.com/login",
  '<html><body><form><input type="email"><input type="password" autocomplete="current-password"></form></body></html>',
);

const PLAIN_PAGE = mockPageContext(
  "https://example.com/",
  "<html><body><h1>Bakery</h1></body></html>",
);

function redirect(status: number, location: string): FetchResult {
  const result = mockFetchResult("", status, "text/html");
  return { ...result, headers: { ...result.headers, location } };
}

/** A site whose fetch answers by absolute URL. */
function site(
  responses: Record<string, FetchResult>,
  pages = [LOGIN_PAGE],
): CheckContext {
  const ctx = mockCheckContext(pages, {});
  return {
    ...ctx,
    fetch: async ({ url }) => responses[url] ?? mockFetchResult("", 404),
  };
}

describe("ChangePasswordUrlAudit", () => {
  const audit = new ChangePasswordUrlAudit();

  it("is not applicable when no sampled page has a password field", async () => {
    const result = await audit.audit(site({}, [PLAIN_PAGE]));
    expect(result.status).toBe(CheckStatus.NotApplicable);
  });

  it("passes a 302 to a change-password page that answers 200", async () => {
    const result = await audit.audit(
      site({
        [WELL_KNOWN]: redirect(302, "/account/password"),
        "https://example.com/account/password": mockFetchResult(
          "<html></html>",
          200,
          "text/html",
        ),
      }),
    );
    expect(result.status).toBe(CheckStatus.Pass);
    expect(AuditResultSchema.safeParse(result).success).toBe(true);
  });

  it("warns when an account site has no change-password URL", async () => {
    const result = await audit.audit(site({}));
    expect(result.status).toBe(CheckStatus.Warn);
  });

  it("fails a redirect to a page that answers 404", async () => {
    const result = await audit.audit(
      site({ [WELL_KNOWN]: redirect(302, "/gone") }),
    );
    expect(result.status).toBe(CheckStatus.Fail);
  });

  // A change-password page refuses an anonymous visitor by design; the
  // redirect still reaches the right page.
  it.each([401, 403])(
    "passes a redirect to a page that answers %i to an anonymous request",
    async (status) => {
      const result = await audit.audit(
        site({
          [WELL_KNOWN]: redirect(302, "/account/password"),
          "https://example.com/account/password": mockFetchResult(
            "",
            status,
            "text/html",
          ),
        }),
      );
      expect(result.status).toBe(CheckStatus.Pass);
      expect(result.message).toContain(`HTTP ${status}`);
    },
  );

  it("warns on a permanent redirect, which the spec does not list", async () => {
    const result = await audit.audit(
      site({
        [WELL_KNOWN]: redirect(301, "https://example.com/account/password"),
        "https://example.com/account/password": mockFetchResult(
          "<html></html>",
          200,
          "text/html",
        ),
      }),
    );
    expect(result.status).toBe(CheckStatus.Warn);
    expect(result.message).toContain("301");
  });

  it("passes a 200 page that redirects with meta refresh", async () => {
    const result = await audit.audit(
      site({
        [WELL_KNOWN]: mockFetchResult(
          '<html><head><meta http-equiv="refresh" content="0;url=/account/password"></head></html>',
          200,
          "text/html",
        ),
      }),
    );
    expect(result.status).toBe(CheckStatus.Pass);
  });

  it("warns when the form is hosted at the well-known URL itself", async () => {
    const result = await audit.audit(
      site({
        [WELL_KNOWN]: mockFetchResult(
          '<html><body><form><input type="password" autocomplete="new-password"></form></body></html>',
          200,
          "text/html",
        ),
      }),
    );
    expect(result.status).toBe(CheckStatus.Warn);
    expect(result.message).toContain("MUST NOT");
  });

  it("is not applicable on a 200 catch-all with no redirect and no form", async () => {
    const result = await audit.audit(
      site({
        [WELL_KNOWN]: mockFetchResult(
          "<html><body>Home</body></html>",
          200,
          "text/html",
        ),
      }),
    );
    expect(result.status).toBe(CheckStatus.NotApplicable);
  });

  it("is not applicable when the probe is refused", async () => {
    const result = await audit.audit(
      site({ [WELL_KNOWN]: mockFetchResult("", 403) }),
    );
    expect(result.status).toBe(CheckStatus.NotApplicable);
  });
});
