import { describe, it, expect } from "vitest";
import { defaultConfig } from "#core/audit-config";
import { planAudits } from "#core/audit-runner";
import { MetaRobotsNotBlockingAudit } from "./robots-directives";
import {
  attributableFixture,
  mockCheckContext,
  mockPageContext,
  shellSiteContext,
  unreachedSiteContext,
} from "#core/__tests__/test-utils";
import { CheckPriority, CheckStatus } from "#core/types";

const doc = (head: string) =>
  `<html lang="en"><head>${head}</head><body>Hi</body></html>`;

describe("MetaRobotsNotBlockingAudit", () => {
  const audit = new MetaRobotsNotBlockingAudit();

  it("passes when no scanned page carries a blocking directive", () => {
    const ctx = mockCheckContext([
      mockPageContext(
        "https://example.com/",
        doc('<meta name="robots" content="index, follow">'),
      ),
      mockPageContext("https://example.com/about", doc(""), 1),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.Pass);
    expect(result.found).toContain("2 page(s)");
  });

  it("fails at critical priority when the homepage is noindexed (absorbed 1.13)", () => {
    const ctx = mockCheckContext([
      mockPageContext(
        "https://example.com/",
        doc('<meta name="robots" content="noindex, follow">'),
      ),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.priority).toBe(CheckPriority.Critical);
    expect(result.found).toContain("https://example.com/");
  });

  it("fails at high priority when only an inner page is noindexed", () => {
    const ctx = mockCheckContext([
      mockPageContext("https://example.com/", doc("")),
      mockPageContext(
        "https://example.com/blog",
        doc('<meta name="robots" content="noindex">'),
        1,
      ),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.priority).toBe(CheckPriority.High);
    expect(result.found).toContain("https://example.com/blog");
  });

  // 4.20's highest-severity false pass: `content="none"` means noindex+nofollow.
  it('fails on content="none"', () => {
    const ctx = mockCheckContext([
      mockPageContext(
        "https://example.com/",
        doc('<meta name="robots" content="none">'),
      ),
    ]);
    expect(audit.audit(ctx).status).toBe(CheckStatus.Fail);
  });

  // Token matching, not substring: `noindexifembedded` is a much narrower directive.
  it("passes on noindexifembedded", () => {
    const ctx = mockCheckContext([
      mockPageContext(
        "https://example.com/",
        doc('<meta name="robots" content="noindexifembedded">'),
      ),
    ]);
    expect(audit.audit(ctx).status).toBe(CheckStatus.Pass);
  });

  it("fails when noindex arrives only via the X-Robots-Tag header (absorbed 1.13)", () => {
    const page = mockPageContext("https://example.com/", doc(""));
    page.fetchResult.headers["x-robots-tag"] = "noindex";
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.found).toContain("X-Robots-Tag");
  });

  it("reads per-bot X-Robots-Tag syntax", () => {
    const page = mockPageContext("https://example.com/", doc(""));
    page.fetchResult.headers["x-robots-tag"] = "googlebot: noindex";
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.found).toContain("googlebot");
  });

  // 1.13's review: a per-bot header was read as a blanket noindex. A crawler
  // outside the allowlist binds nobody this audit reports on.
  it("ignores an X-Robots-Tag scoped to a bot outside the allowlist", () => {
    const page = mockPageContext("https://example.com/", doc(""));
    page.fetchResult.headers["x-robots-tag"] = "yandexbot: noindex";
    expect(audit.audit(mockCheckContext([page])).status).toBe(CheckStatus.Pass);
  });

  // No AI crawler operator documents reading a robots directive addressed to
  // its own name, so the header form is named in the message and never scored.
  it("names but does not score an X-Robots-Tag scoped to an AI crawler", () => {
    const page = mockPageContext("https://example.com/", doc(""));
    page.fetchResult.headers["x-robots-tag"] = "gptbot: noindex";
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe(CheckStatus.Pass);
    expect(result.message).toBe(
      "No scanned non-utility page carries a blocking or snippet-suppressing robots directive. 1 non-utility page(s) carry a blocking or snippet-suppressing directive under a name no crawler operator documents reading (X-Robots-Tag (gptbot)); those directives are not scored.",
    );
  });

  // A bot prefix scopes every directive after it until the next prefix
  // (Google's example: `otherbot: noindex, nofollow`), so neither header
  // reaches the generic rule.
  it.each(["gptbot: noindex, nosnippet", "claudebot: nosnippet, noindex"])(
    "carries the bot prefix across every directive in %s",
    (header) => {
      const page = mockPageContext("https://example.com/", doc(""));
      page.fetchResult.headers["x-robots-tag"] = header;
      const result = audit.audit(mockCheckContext([page]));
      expect(result.status).toBe(CheckStatus.Pass);
      expect(result.message).toContain("those directives are not scored.");
    },
  );

  it("scopes a later directive to a documented prefix, not the generic rule", () => {
    const page = mockPageContext("https://example.com/", doc(""));
    page.fetchResult.headers["x-robots-tag"] = "googlebot: nosnippet, noindex";
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.found).toBe(
      "https://example.com/ — noindex via X-Robots-Tag (googlebot)",
    );
  });

  it("does not read the time half of a comma-split unavailable_after as a bot", () => {
    const page = mockPageContext("https://example.com/", doc(""));
    page.fetchResult.headers["x-robots-tag"] =
      "unavailable_after: 25 Jun 2010, 15:00:00 PST, noindex";
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.found).toBe(
      "https://example.com/ — noindex via X-Robots-Tag",
    );
  });

  it("ignores every directive after an unknown prefix", () => {
    const page = mockPageContext("https://example.com/", doc(""));
    page.fetchResult.headers["x-robots-tag"] = "yandexbot: nosnippet, noindex";
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe(CheckStatus.Pass);
    expect(result.message).toBe(
      "No scanned non-utility page carries a blocking or snippet-suppressing robots directive.",
    );
  });

  it("does not name a permissive directive under an undocumented name", () => {
    const ctx = mockCheckContext([
      mockPageContext(
        "https://example.com/",
        doc('<meta name="GPTBot" content="index, follow">'),
      ),
    ]);
    expect(audit.audit(ctx).message).toBe(
      "No scanned non-utility page carries a blocking or snippet-suppressing robots directive.",
    );
  });

  // OpenAI, Anthropic, Perplexity and Common Crawl document robots.txt only.
  it.each([
    "GPTBot",
    "OAI-SearchBot",
    "ChatGPT-User",
    "ClaudeBot",
    "Claude-SearchBot",
    "Claude-User",
    "PerplexityBot",
    "CCBot",
    "Google-Extended",
    "Applebot-Extended",
    "msnbot",
  ])("names but does not score a noindex meta tag addressed to %s", (name) => {
    const ctx = mockCheckContext([
      mockPageContext(
        "https://example.com/",
        doc(`<meta name="${name}" content="noindex, nosnippet">`),
      ),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.Pass);
    expect(result.message).toBe(
      `No scanned non-utility page carries a blocking or snippet-suppressing robots directive. 1 non-utility page(s) carry a blocking or snippet-suppressing directive under a name no crawler operator documents reading (meta name="${name.toLowerCase()}"); those directives are not scored.`,
    );
  });

  // Google: "Google supports two user agent tokens in the robots meta tag";
  // Bing: name="bingbot"; Apple: name="applebot".
  it.each(["googlebot", "googlebot-news", "bingbot", "applebot"])(
    "fails on a noindex meta tag addressed to the documented name %s",
    (name) => {
      const ctx = mockCheckContext([
        mockPageContext(
          "https://example.com/",
          doc(`<meta name="${name}" content="noindex">`),
        ),
      ]);
      const result = audit.audit(ctx);
      expect(result.status).toBe(CheckStatus.Fail);
      expect(result.found).toContain(`meta name="${name}"`);
    },
  );

  it("still scores a documented directive beside an undocumented one", () => {
    const ctx = mockCheckContext([
      mockPageContext(
        "https://example.com/",
        doc(
          '<meta name="GPTBot" content="noindex"><meta name="robots" content="nosnippet">',
        ),
      ),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.Warn);
    expect(result.found).toBe(
      'https://example.com/ — nosnippet via meta name="robots"',
    );
    // The set-aside tag is named on a warn too, where the reader needs it most.
    expect(result.message).toBe(
      '1 non-utility page(s) allow indexing but forbid quoting (nosnippet / noarchive / max-snippet:0). 1 non-utility page(s) carry a blocking or snippet-suppressing directive under a name no crawler operator documents reading (meta name="gptbot"); those directives are not scored.',
    );
  });

  // Anthropic's crawler page names ClaudeBot, Claude-User and Claude-SearchBot
  // only, so the bot registry has no anthropic-ai row and the name binds nothing.
  it("ignores a noindex addressed to the undocumented anthropic-ai name", () => {
    const ctx = mockCheckContext([
      mockPageContext(
        "https://example.com/",
        doc('<meta name="anthropic-ai" content="noindex">'),
      ),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.Pass);
    expect(result.message).not.toContain("anthropic-ai");
  });

  // extractMetaTags is last-wins; real crawlers apply the most restrictive tag.
  it("fails when a restrictive robots tag is followed by a permissive one", () => {
    const ctx = mockCheckContext([
      mockPageContext(
        "https://example.com/",
        doc(
          '<meta name="robots" content="noindex"><meta name="robots" content="index, follow">',
        ),
      ),
    ]);
    expect(audit.audit(ctx).status).toBe(CheckStatus.Fail);
  });

  it("handles whitespace and case variants", () => {
    const ctx = mockCheckContext([
      mockPageContext(
        "https://example.com/",
        doc('<meta name="robots" content=" NoIndex , NoFollow ">'),
      ),
    ]);
    expect(audit.audit(ctx).status).toBe(CheckStatus.Fail);
  });

  // 2.25 failed the whole site at high priority when a cart or login page was
  // scanned — noindex there is correct, not a defect.
  it("passes when only utility routes are noindexed, naming them", () => {
    const ctx = mockCheckContext([
      mockPageContext("https://example.com/", doc("")),
      mockPageContext(
        "https://example.com/cart",
        doc('<meta name="robots" content="noindex">'),
        1,
      ),
      mockPageContext(
        "https://example.com/login",
        doc('<meta name="robots" content="noindex">'),
        2,
      ),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.Pass);
    expect(result.message).toContain("utility");
  });

  it("warns when a non-utility page permits indexing but forbids quoting", () => {
    const ctx = mockCheckContext([
      mockPageContext(
        "https://example.com/",
        doc('<meta name="robots" content="nosnippet">'),
      ),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.Warn);
    expect(result.message).toContain("nosnippet");
  });

  it("warns on max-snippet:0", () => {
    const ctx = mockCheckContext([
      mockPageContext(
        "https://example.com/",
        doc('<meta name="robots" content="max-snippet:0">'),
      ),
    ]);
    expect(audit.audit(ctx).status).toBe(CheckStatus.Warn);
  });

  // Bing: noarchive means "Do not link in Chat and Copilot".
  it("warns on noarchive alone", () => {
    const ctx = mockCheckContext([
      mockPageContext(
        "https://example.com/",
        doc('<meta name="robots" content="noarchive">'),
      ),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.Warn);
    expect(result.found).toContain("noarchive");
  });

  // Bing: nocache means "Display only URL/Snippet/Title in Chat or Copilot".
  // The page is still linked and quoted by its snippet, so nothing forbids
  // quoting; the pass message names it.
  it("passes on nocache and names it", () => {
    const ctx = mockCheckContext([
      mockPageContext(
        "https://example.com/",
        doc('<meta name="robots" content="nocache">'),
      ),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.Pass);
    expect(result.message).toContain("nocache");
  });

  // Bing: "If content has both NOCACHE and NOARCHIVE tags, we will treat it as
  // NOCACHE." Holds across transports too.
  it("treats noarchive together with nocache as nocache", () => {
    const both = mockPageContext(
      "https://example.com/",
      doc('<meta name="robots" content="noarchive, nocache">'),
    );
    const split = mockPageContext(
      "https://example.com/news",
      doc('<meta name="bingbot" content="noarchive">'),
      1,
    );
    split.fetchResult.headers["x-robots-tag"] = "nocache";
    const result = audit.audit(mockCheckContext([both, split]));
    expect(result.status).toBe(CheckStatus.Pass);
    expect(result.message).toContain("2 non-utility page(s) carry nocache");
  });

  // nocache does not cancel the directives Google documents.
  it("still warns on nosnippet beside nocache", () => {
    const ctx = mockCheckContext([
      mockPageContext(
        "https://example.com/",
        doc('<meta name="robots" content="nocache, nosnippet">'),
      ),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.Warn);
    expect(result.found).toContain("nosnippet");
    expect(result.found).not.toContain("nocache");
  });

  it("does not warn on a permissive max-snippet", () => {
    const ctx = mockCheckContext([
      mockPageContext(
        "https://example.com/",
        doc('<meta name="robots" content="max-snippet:-1">'),
      ),
    ]);
    expect(audit.audit(ctx).status).toBe(CheckStatus.Pass);
  });

  // 4.20 reported a critical-priority PASS when every fetch had failed.
  it("is not-applicable when no pages were scanned", () => {
    const result = audit.audit(mockCheckContext([]));
    expect(result.status).toBe(CheckStatus.NotApplicable);
  });

  // The scan may hold a readable page that is not this site's — a broker's
  // parking page, a foreign interstitial. Attribution is the gate's decision,
  // and the runner has to honour it rather than run this audit anyway.
  it("declines when no response can be attributed to this site", async () => {
    const { pages, rootFiles } = attributableFixture();
    const instance = new MetaRobotsNotBlockingAudit();
    const reached = instance.audit(mockCheckContext(pages, rootFiles));
    expect(reached.status, "the same input reached is judged").not.toBe(
      CheckStatus.NotApplicable,
    );

    const plan = planAudits(
      unreachedSiteContext(pages, rootFiles),
      defaultConfig,
    );
    expect(plan.runnable.map((entry) => entry.reg.meta.id)).not.toContain(
      MetaRobotsNotBlockingAudit.meta.id,
    );
    expect(
      plan.skipped.find(
        (stub) => stub.id === MetaRobotsNotBlockingAudit.meta.id,
      )?.status,
    ).toBe(CheckStatus.NotApplicable);
  });

  // `requires` deliberately omits `rendered-body`: robots directives live in the
  // head and the headers, which arrive whether or not the body renders.
  it("still judges a page that served no readable text", async () => {
    const result = new MetaRobotsNotBlockingAudit().audit(shellSiteContext());
    expect(result.status).not.toBe(CheckStatus.NotApplicable);
  });
});
