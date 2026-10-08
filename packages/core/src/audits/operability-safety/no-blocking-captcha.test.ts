import { describe, it, expect } from "vitest";
import { defaultConfig } from "../../audit-config";
import { planAudits } from "../../audit-runner";
import { NoBlockingCaptchaAudit } from "./no-blocking-captcha";
import {
  attributableFixture,
  mockCheckContext,
  shellSiteContext,
  mockPageContext,
  unreachedSiteContext,
  walledSiteContext,
} from "../../__tests__/test-utils";
import { CheckStatus } from "../../types";

describe("NoBlockingCaptchaAudit", () => {
  const audit = new NoBlockingCaptchaAudit();

  it("passes when no blocking CAPTCHA scripts are detected", () => {
    const page = mockPageContext(
      "https://example.com",
      `<html><body>
        <form action="/api/contact" method="POST"><input name="email" /></form>
      </body></html>`,
    );
    const ctx = mockCheckContext([page]);
    const result = audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.Pass);
    expect(result.message).toContain("No blocking CAPTCHA");
  });

  it("warns when reCAPTCHA is detected", () => {
    const page = mockPageContext(
      "https://example.com",
      `<html><body>
        <script src="https://www.google.com/recaptcha/api.js"></script>
        <form action="/contact" method="POST"><input name="email" /></form>
      </body></html>`,
    );
    const ctx = mockCheckContext([page]);
    const result = audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.Warn);
    expect(result.message).toContain("recaptcha");
  });

  it("warns when Cloudflare Turnstile is detected", () => {
    const page = mockPageContext(
      "https://example.com",
      `<html><body>
        <script src="https://challenges.cloudflare.com/turnstile/v0/api.js"></script>
      </body></html>`,
    );
    const ctx = mockCheckContext([page]);
    const result = audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.Warn);
    expect(result.message).toContain("turnstile");
  });

  // Inline config naming the vendor is not a widget.
  it("passes a page whose only Turnstile mention is inline config", () => {
    const page = mockPageContext(
      "https://example.com",
      `<html><body>
        <script>app.captcha.provider = "CloudflareTurnstile"; app.captcha.tokenParam = "cf-turnstile-response";</script>
        <p>This site is protected by reCAPTCHA and hCaptcha policies.</p>
        <form action="/contact" method="POST"><input name="email" /></form>
      </body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe(CheckStatus.Pass);
  });

  // True positive: a Turnstile widget mounted on a form, with no script tag in
  // the served HTML (the loader comes from a bundle).
  it("warns on a Turnstile widget mounted on a form", () => {
    const page = mockPageContext(
      "https://example.com",
      `<html><body>
        <form action="/contact" method="POST">
          <input name="email" />
          <div class="cf-turnstile" data-sitekey="0x0000"></div>
        </form>
      </body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe(CheckStatus.Warn);
    expect(result.message).toContain("turnstile");
  });
});

describe("NoBlockingCaptchaAudit — the wall the scanner met", () => {
  const audit = new NoBlockingCaptchaAudit();

  it("reports the bot wall instead of passing the site that refused the scan", () => {
    const ctx = {
      ...mockCheckContext([]),
      wafProtection: {
        isBlocked: true,
        provider: "cloudflare" as const,
        name: "Cloudflare",
        reason: "HTTP 403 with cf-ray",
        statusCode: 403,
      },
    };
    const result = audit.audit(ctx);

    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.message).toContain("bot wall");
    expect(result.message).toContain("Cloudflare");
  });

  it("stays quiet about a rate limit, which is the scan asking too fast", () => {
    const ctx = {
      ...mockCheckContext([]),
      wafProtection: {
        isBlocked: true,
        provider: "rate-limited" as const,
        name: "Rate limit (HTTP 429)",
        reason: "HTTP 429",
        statusCode: 429,
        isRateLimit: true,
      },
    };
    expect(audit.audit(ctx).status).toBe(CheckStatus.NotApplicable);
  });

  it("is notApplicable when no page was fetched", () => {
    expect(audit.audit(mockCheckContext([])).status).toBe(
      CheckStatus.NotApplicable,
    );
  });

  // The scan may hold a readable page that is not this site's — a broker's
  // parking page, a foreign interstitial. Attribution is the gate's decision,
  // and the runner has to honour it rather than run this audit anyway.
  it("declines when no response can be attributed to this site", async () => {
    const { pages, rootFiles } = attributableFixture();
    const instance = new NoBlockingCaptchaAudit();
    const reached = await instance.audit(mockCheckContext(pages, rootFiles));
    expect(reached.status, "the same input reached is judged").not.toBe(
      CheckStatus.NotApplicable,
    );

    const plan = planAudits(
      unreachedSiteContext(pages, rootFiles),
      defaultConfig,
    );
    expect(plan.runnable.map((entry) => entry.reg.meta.id)).not.toContain(
      NoBlockingCaptchaAudit.meta.id,
    );
    expect(
      plan.skipped.find((stub) => stub.id === NoBlockingCaptchaAudit.meta.id)
        ?.status,
    ).toBe(CheckStatus.NotApplicable);
  });
  // This direct call pins the audit's local WAF branch. The runner does not
  // publish this finding from an unread scan; it emits an `na` stub instead.
  it("reports the wall when its local WAF branch is called directly", () => {
    const result = new NoBlockingCaptchaAudit().audit(walledSiteContext());
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.message).toContain("bot wall");
    expect(result.message).toContain("Cloudflare");
  });

  // The weight-1.0 vacuous pass this audit shipped. The detection is a
  // substring search over the served HTML; a shell renders its forms — and
  // whatever guards them — from a bundle this search cannot read. `requires`
  // is empty so the gate does not decline this, and the audit has to.
  it("declines a page that served no readable text", () => {
    const result = new NoBlockingCaptchaAudit().audit(shellSiteContext());
    expect(result.status).toBe(CheckStatus.NotApplicable);
    expect(result.message).toContain("no readable text");
  });

  // Ordering: the guard sits below the detection branch, so a CAPTCHA a shell
  // does serve statically is still reported.
  it("still reports a CAPTCHA a shell serves statically", () => {
    const html =
      '<html lang="en"><head><title>Shop</title>' +
      '<script src="https://www.google.com/recaptcha/api.js"></script></head>' +
      '<body><div id="root"></div></body></html>';
    const result = new NoBlockingCaptchaAudit().audit(shellSiteContext(html));
    expect(result.status).toBe(CheckStatus.Warn);
    expect(result.message).toContain("recaptcha");
  });
});
