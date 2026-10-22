import { describe, it, expect } from "vitest";
import { CodeLanguageAudit } from "./code-language";
import { mockCheckContext, mockPageContext } from "#core/__tests__/test-utils";
import {
  CheckStatus,
  PageType,
  PageTypeSource,
  CoverageProvenance,
  ScoreDisplayMode,
} from "#core/types";
import { runAudits } from "#core/audit-runner";
import { buildScanEvidence } from "#core/scan-evidence";
import type { PageContext } from "#core/check-context";
import type { ScanConfig } from "#core/audit-config";
import { CheckResultSchema } from "#core/schemas";

describe("CodeLanguageAudit", () => {
  const audit = new CodeLanguageAudit();

  it("is not applicable when there are no <pre><code> blocks", () => {
    const page = mockPageContext(
      "https://example.com",
      "<html><body><p>No code</p></body></html>",
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe(CheckStatus.NotApplicable);
    expect(result.message).toContain("No code blocks found");
  });

  it("passes when all code blocks have language annotations", () => {
    const page = mockPageContext(
      "https://example.com",
      '<html><body><pre><code class="language-javascript">const x = 1;</code></pre></body></html>',
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe(CheckStatus.Pass);
    expect(result.found).toContain("1/1");
  });

  it("warns when a majority but not all code blocks are annotated", () => {
    const page = mockPageContext(
      "https://example.com",
      `<html><body>
        <pre><code class="language-js">a</code></pre>
        <pre><code class="language-py">b</code></pre>
        <pre><code>c</code></pre>
      </body></html>`,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe(CheckStatus.Warn);
    expect(result.found).toContain("2/3");
  });

  it("fails when no code block has a language annotation", () => {
    const page = mockPageContext(
      "https://example.com",
      "<html><body><pre><code>plain code</code></pre></body></html>",
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.found).toContain("0/1");
  });
});

const contentPage = (body: string, slug = "page") =>
  mockPageContext(
    `https://example.com/${slug}`,
    `<html><body>${body}</body></html>`,
  );

describe("language annotation convention", () => {
  it.each(["language-", "not-language-python", "language- other"])(
    "rejects an empty or embedded prefix: %s",
    (classes) => {
      const page = contentPage(`<pre><code class="${classes}">x</code></pre>`);
      expect(
        new CodeLanguageAudit().audit(mockCheckContext([page])).status,
      ).toBe(CheckStatus.Fail);
    },
  );
  it.each([
    "language-c++",
    "highlight language-python line-numbers",
    "language-plaintext",
  ])("accepts a complete class token: %s", (classes) => {
    const page = contentPage(`<pre><code class="${classes}">x</code></pre>`);
    expect(new CodeLanguageAudit().audit(mockCheckContext([page])).status).toBe(
      CheckStatus.Pass,
    );
  });
  it.each([
    '<pre class="language-js"><code>x</code></pre>',
    '<pre data-language="js"><code>x</code></pre>',
    '<pre><code class="lang-js">x</code></pre>',
  ])("does not claim the code-element language convention for %s", (html) => {
    expect(
      new CodeLanguageAudit().audit(mockCheckContext([contentPage(html)]))
        .status,
    ).toBe(CheckStatus.Fail);
  });
  it("ignores inline code and plain preformatted text", () => {
    expect(
      new CodeLanguageAudit().audit(
        mockCheckContext([contentPage("<code>x</code><pre>Plain text</pre>")]),
      ).status,
    ).toBe(CheckStatus.NotApplicable);
  });
});

const runnerConfig: ScanConfig = {
  categories: [{ id: "content-extraction", name: "Extraction", weight: 1 }],
  audits: {
    "content-extraction": [
      {
        meta: CodeLanguageAudit.meta,
        create: () => new CodeLanguageAudit(),
      },
    ],
  },
};
const scopedPage = (
  body: string,
  type: PageType,
  source: PageTypeSource,
  name = "page",
) => {
  const p = contentPage(
    body + "<p>" + "Readable page content. ".repeat(60) + "</p>",
    name,
  );
  p.pageType = type;
  p.pageTypeSource = source;
  return p;
};
const run = async (pages: PageContext[]) => {
  const ctx = mockCheckContext(pages);
  ctx.evidence = buildScanEvidence({
    requestedUrl: pages[0]!.url,
    homepageResult: pages[0]!.fetchResult,
    pages,
    rootFiles: {},
    wafProtection: null,
  });
  return runAudits(ctx, runnerConfig);
};

describe("code feature scope", () => {
  for (const source of Object.values(PageTypeSource)) {
    describe(source, () => {
      it.each(Object.values(PageType))(
        "assesses code on %s without score weight",
        async (type) => {
          for (const [html, status] of [
            [
              '<pre><code class="language-js">const x = 1;</code></pre>',
              CheckStatus.Pass,
            ],
            ["<pre><code>const x = 1;</code></pre>", CheckStatus.Fail],
            ["<main>Product specifications</main>", CheckStatus.NotApplicable],
          ] as const) {
            const result = await run([scopedPage(html, type, source)]);
            const check = CheckResultSchema.parse(result.checks[0]);
            expect(check.status).toBe(status);
            expect(check.weight).toBe(0);
            expect(check.scoreDisplayMode).toBe(ScoreDisplayMode.Informative);
            expect(check.coverage?.provenance).toBe(CoverageProvenance.All);
            expect(check.tags).not.toContain("skipped:page-type");
            expect(check.advisoryResults).toBeUndefined();
            expect(result.categories[0]!.assessedMass).toBe(0);
          }
        },
      );
    });
  }
  it("counts code blocks across mixed readable pages", async () => {
    const marked = scopedPage(
      '<pre><code class="language-js">x</code></pre><pre><code class="language-python">y</code></pre>',
      PageType.Product,
      PageTypeSource.Declared,
      "marked",
    );
    const gap = scopedPage(
      "<pre><code>z</code></pre>",
      PageType.Homepage,
      PageTypeSource.Detected,
      "gap",
    );
    const irrelevant = scopedPage(
      "<p>No code</p>",
      PageType.Category,
      PageTypeSource.Detected,
      "irrelevant",
    );
    const unread = scopedPage(
      "<pre><code>Unavailable</code></pre>",
      PageType.Article,
      PageTypeSource.Declared,
      "unread",
    );
    unread.$ = contentPage("").$;
    unread.fetchResult = { ...unread.fetchResult, body: "", status: 503 };
    const result = await run([marked, irrelevant, unread, gap]);
    const check = CheckResultSchema.parse(result.checks[0]);
    expect(check.status).toBe(CheckStatus.Warn);
    expect(check.displayValue).toContain("2/3");
    expect(check.coverage?.unreadUrls).toEqual([unread.url]);
    expect(check.coverage?.inputUrls).not.toContain(unread.url);
    expect(check.advisoryResults).toBeUndefined();
    expect(check.weight).toBe(0);
  });
});

describe("review regressions", () => {
  it("ignores hidden code blocks", () => {
    const page = mockPageContext(
      "https://example.com/page",
      "<html><body><pre hidden><code>secret()</code></pre></body></html>",
    );
    expect(new CodeLanguageAudit().audit(mockCheckContext([page])).status).toBe(
      CheckStatus.NotApplicable,
    );
  });
});

describe("CodeLanguageAudit one block per pre", () => {
  const audit = new CodeLanguageAudit();
  it("assesses one code element per <pre>", () => {
    const page = mockPageContext(
      "https://example.com/docs",
      '<html><body><main><pre><code class="language-js">a</code><code>b</code><code>c</code></pre></main></body></html>',
      1,
    );
    const result = audit.audit(mockCheckContext([page]));
    expect(result.status).toBe(CheckStatus.Pass);
    expect(result.found).toBe("1/1 annotated code blocks");
  });
});
