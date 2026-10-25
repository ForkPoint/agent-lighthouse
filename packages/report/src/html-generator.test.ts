import { describe, it, expect, afterEach, vi } from "vitest";
import { JSDOM } from "jsdom";
import type {
  CategoryResult,
  CheckResult,
  ScanReport,
} from "@forkpoint/agent-lighthouse-core";
import { generateHtmlReport } from "./html-generator";
import {
  AuditTier,
  NoticeKind,
  CheckPriority,
  CheckStatus,
  PageType,
  PageTypeSource,
  ScoreDisplayMode,
  ScoreTier,
  TAG_SCAN_ERROR,
} from "@forkpoint/agent-lighthouse-core";

// ── Fixtures ────────────────────────────────────────────────────

function check(over: Partial<CheckResult> = {}): CheckResult {
  return {
    id: "c",
    category: "agent-interfaces",
    title: "title",
    description: "desc",
    status: CheckStatus.Pass,
    score: 1,
    scoreDisplayMode: ScoreDisplayMode.Binary,
    priority: CheckPriority.Medium,
    impact: "",
    fix: "",
    ...over,
  };
}

function cat(over: Partial<CategoryResult> & { id: string }): CategoryResult {
  const checks = over.checks ?? [];
  return {
    name: over.id,
    weight: 0.1,
    score: 0,
    passCount: 0,
    warnCount: 0,
    failCount: 0,
    ...over,
    checks,
  };
}

function report(
  categories: CategoryResult[],
  over: Partial<ScanReport> = {},
): ScanReport {
  return {
    scanId: "s1",
    url: "https://x.test/",
    domain: "x.test",
    overallScore: 42,
    scoreTier: ScoreTier.NeedsWork,
    categories,
    topPasses: [],
    topFails: [],
    recommendations: [],
    pagesScanned: [{ url: "https://x.test/", pageType: PageType.Homepage }],
    scannedAt: "2026-01-01T00:00:00.000Z",
    durationMs: 1234,
    ...over,
  };
}

const NOT_A_FACTOR_LINK =
  "https://github.com/ForkPoint/agent-lighthouse/blob/main/docs/evidence/sunset/not-a-factor.md#accessibilityskip-nav";

// ── Tests ───────────────────────────────────────────────────────

describe("generateHtmlReport", () => {
  it("embeds the approved brand in the generated report without changing scan data", () => {
    const input = report([]);
    const before = structuredClone(input);
    const html = generateHtmlReport(input);
    const favicon = html.match(
      /rel="icon" type="image\/svg\+xml" href="([^"]+)"/,
    )?.[1];
    expect(favicon).toBeDefined();
    const svg = decodeURIComponent(favicon!.split(",")[1]!);
    expect(svg).toContain('viewBox="0 0 256 256"');
    expect(svg).toContain('transform="translate(-5.5 5)"');
    expect(svg).toContain('fill="#4f46e5"');
    expect(html).toContain(
      svg.replace("<svg ", '<svg aria-hidden="true" focusable="false" '),
    );
    expect(html).toContain("Your AI readiness report</h1>");
    expect(html).toContain("Open-source website checks for AI readiness.");
    expect(html).not.toContain("fonts.googleapis.com");
    expect(html).not.toContain("🗼");
    expect(input).toEqual(before);
  });

  it("renders the deprecation notice and badge for a sunset audit", () => {
    const html = generateHtmlReport(
      report([
        cat({
          id: "agent-interfaces",
          checks: [
            check({
              id: "accessibility-skip-nav",
              status: CheckStatus.Fail,
              deprecated: {
                notice: "No consumer reads this signal.",
                link: NOT_A_FACTOR_LINK,
              },
            }),
          ],
        }),
      ]),
    );

    expect(html).toContain("Deprecated — no longer a factor");
    expect(html).toContain(
      "docs/evidence/sunset/not-a-factor.md#accessibilityskip-nav",
    );
    expect(html).toContain("No consumer reads this signal.");
  });

  // Final-review finding I2: the ai-bot-directives per-bot table lives entirely
  // in `found`, so the report must keep its newlines and must render
  // `details.found`.
  it("preserves newlines in a multi-line found value and renders details.found", () => {
    const table = "GPTBot: allowed\nClaudeBot: allowed\nPerplexityBot: blocked";
    const html = generateHtmlReport(
      report([
        cat({
          id: "access-crawl-control",
          checks: [
            check({
              id: "access-crawl-control/ai-bot-directives",
              status: CheckStatus.Warn,
              displayValue: table,
              details: { found: table },
            }),
          ],
        }),
      ]),
    );

    // The summary line keeps the newlines instead of collapsing the table.
    expect(html).toMatch(
      /class="[^"]*whitespace-pre-line[^"]*"[^>]*>GPTBot: allowed\nClaudeBot/,
    );
    // details.found equals displayValue here, so the evidence block is
    // suppressed — the table renders exactly once, not duplicated.
    expect(html).not.toContain("What we found:");
    expect(
      html.match(
        /whitespace-pre-line[^>]*>GPTBot: allowed\nClaudeBot: allowed\nPerplexityBot: blocked/g,
      ),
    ).toHaveLength(1);
  });

  it("renders details.found as its own block when it differs from displayValue", () => {
    const html = generateHtmlReport(
      report([
        cat({
          id: "access-crawl-control",
          checks: [
            check({
              id: "access-crawl-control/ai-bot-directives",
              status: CheckStatus.Warn,
              displayValue: "1 of 2 documented AI bots allowed",
              details: { found: "GPTBot: allowed\nClaudeBot: blocked" },
            }),
          ],
        }),
      ]),
    );

    expect(html).toContain("What we found:");
    expect(html).toMatch(
      /whitespace-pre-line[^>]*>GPTBot: allowed\nClaudeBot: blocked/,
    );
  });

  it("omits the deprecation block for a check without a notice", () => {
    const html = generateHtmlReport(
      report([
        cat({
          id: "agent-interfaces",
          checks: [check({ id: "live", status: CheckStatus.Pass })],
        }),
      ]),
    );

    expect(html).not.toContain("Deprecated — no longer a factor");
    expect(html).not.toContain("not-a-factor.md");
  });
});

describe("tier badges", () => {
  it("badges an advisory check and leaves a scored one unbadged", () => {
    const html = generateHtmlReport(
      report([
        cat({
          id: "agent-interfaces",
          checks: [
            check({
              id: "structured-data/claimreview-advisory",
              title: "Advisory check",
              tier: AuditTier.Informative,
              scoreDisplayMode: ScoreDisplayMode.Informative,
              status: CheckStatus.Fail,
              score: 0,
            }),
            check({
              id: "agent-interfaces/scored",
              title: "Scored check",
              tier: AuditTier.Scored,
            }),
          ],
        }),
      ]),
    );
    expect(html).toContain("Advisory — not scored");
    expect(html.match(/Advisory — not scored/g)).toHaveLength(1);
    expect(html).toContain("1 Advisory");
  });

  it("badges an experimental check with its own label", () => {
    const html = generateHtmlReport(
      report([
        cat({
          id: "agent-interfaces",
          checks: [
            check({ title: "Trial check", tier: AuditTier.Experimental }),
          ],
        }),
      ]),
    );
    expect(html).toContain("Experimental — not scored");
  });
});

describe("evidence link", () => {
  it("links a check at its published evidence dossier", () => {
    const html = generateHtmlReport(
      report([
        cat({
          id: "agent-interfaces",
          checks: [
            check({
              details: {
                evidenceUrl:
                  "https://forkpoint.github.io/agent-lighthouse/audits/agent-interfaces/mcp-endpoint/",
              },
            }),
          ],
        }),
      ]),
    );
    expect(html).toContain(
      '<a href="https://forkpoint.github.io/agent-lighthouse/audits/agent-interfaces/mcp-endpoint/"',
    );
    expect(html).toContain("Why this audit exists — the evidence");
  });

  it("escapes an evidence URL rather than letting it close the attribute", () => {
    const html = generateHtmlReport(
      report([
        cat({
          id: "agent-interfaces",
          checks: [
            check({
              details: {
                evidenceUrl: 'https://x.test/"><script>alert(1)</script>',
              },
            }),
          ],
        }),
      ]),
    );
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&quot;&gt;&lt;script&gt;");
  });

  it("renders no evidence link when the check carries no evidence URL", () => {
    const html = generateHtmlReport(
      report([cat({ id: "agent-interfaces", checks: [check()] })]),
    );
    expect(html).not.toContain("Why this audit exists");
  });

  it("renders scan conditions badges when conditions are present", () => {
    const html = generateHtmlReport({
      ...report([]),
      conditions: {
        url: "https://x.test/",
        pageType: { type: PageType.Homepage, source: PageTypeSource.Detected },
        origin: {
          origin: "https://x.test",
          version: "v1",
          readAt: "2026-09-02T08:00:00.000Z",
          cached: true,
        },
        coverage: {
          registryMass: 102.6,
          assessedMass: 94.2,
          pageMass: 70.8,
          originMass: 31.8,
          gatedMass: 0,
        },
        unscored: {
          totalCount: 15,
          informativeCount: 8,
          gatedCount: 0,
          reasons: { informative: 8, "not-applicable": 7 },
        },
      },
    });

    expect(html).toContain(
      'Page: <strong class="text-indigo-400">homepage</strong>',
    );
    expect(html).toContain("cached");
    expect(html).toContain("94.2/102.6");
  });

  it("escapes malicious HTML characters in scan conditions to prevent XSS", () => {
    const html = generateHtmlReport({
      ...report([]),
      conditions: {
        url: "https://x.test/",
        pageType: {
          type: '<script>alert("xss")</script>',
          source: '"><img src=x onerror=alert(1)>',
        } as any,
        origin: {
          origin: "https://x.test",
          version: "v1",
          readAt: '"><script>alert(2)</script>',
          cached: false,
        },
        coverage: {
          registryMass: 100,
          assessedMass: 80,
          pageMass: 50,
          originMass: 50,
          gatedMass: 0,
        },
        unscored: {
          totalCount: 0,
          informativeCount: 0,
          gatedCount: 0,
          reasons: {},
        },
      },
    });

    expect(html).not.toContain('<script>alert("xss")</script>');
    expect(html).not.toContain("<img src=x");
    expect(html).toContain(
      "&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;",
    );
    expect(html).toContain("text-emerald-400"); // Fresh origin color
    expect(html).toContain("fresh");
  });

  it("handles zero registryMass cleanly without producing NaN%", () => {
    const html = generateHtmlReport({
      ...report([]),
      conditions: {
        url: "https://x.test/",
        pageType: { type: PageType.Homepage, source: PageTypeSource.Detected },
        origin: {
          origin: "https://x.test",
          version: "v1",
          readAt: "2026-09-02T08:00:00.000Z",
          cached: false,
        },
        coverage: {
          registryMass: 0,
          assessedMass: 0,
          pageMass: 0,
          originMass: 0,
          gatedMass: 0,
        },
        unscored: {
          totalCount: 0,
          informativeCount: 0,
          gatedCount: 0,
          reasons: {},
        },
      },
    });

    expect(html).not.toContain("NaN%");
    expect(html).toContain("0/0</strong> mass (0%)");
  });
});

describe("obsolete tier", () => {
  const retired = check({
    id: "agent-interfaces/retired-file",
    title: "Retired file still published",
    status: CheckStatus.Warn,
    score: 0.5,
    tier: AuditTier.Obsolete,
    scoreDisplayMode: ScoreDisplayMode.Informative,
    weight: 0,
    deprecated: {
      kind: NoticeKind.Obsolete,
      notice: "The vendor retired this file in 2024.",
      link: "https://example.com/retired",
      replacement: "Publish the successor file.",
    },
  });

  it("renders found obsolete checks in their own section, outside categories", () => {
    const html = generateHtmlReport(
      report([cat({ id: "agent-interfaces", checks: [retired] })]),
    );
    expect(html).toContain("Obsolete (not scored)");
    expect(html).toContain("The vendor retired this file in 2024.");
    expect(html).toContain("Publish the successor file.");
    // Labelled as obsolete, never as advisory or scored.
    expect(html).toContain("Obsolete — not scored");
    expect(html).not.toContain("Advisory — not scored");
    // The category card counts no warning for it.
    expect(html).toContain("0 Warnings");
  });

  it("says an obsolete check that did not run did not run", () => {
    const html = generateHtmlReport(
      report([
        cat({
          id: "agent-interfaces",
          checks: [
            retired,
            check({
              ...retired,
              id: "agent-interfaces/errored-retired",
              status: CheckStatus.NotApplicable,
              score: 0,
              tags: [TAG_SCAN_ERROR],
            }),
          ],
        }),
      ]),
    );
    expect(html).not.toContain("found nothing");
    expect(html).toContain("1 obsolete check did not run.");
  });

  it("prints no obsolete section when nothing obsolete was found", () => {
    const html = generateHtmlReport(
      report([
        cat({
          id: "agent-interfaces",
          checks: [
            check({
              ...retired,
              status: CheckStatus.NotApplicable,
              score: 0,
            }),
          ],
        }),
      ]),
    );
    expect(html).not.toContain("Obsolete (not scored)");
  });

  it("labels an unconsumed notice by its kind", () => {
    const html = generateHtmlReport(
      report([
        cat({
          id: "machine-discovery",
          checks: [
            check({
              tier: AuditTier.Informative,
              scoreDisplayMode: ScoreDisplayMode.Informative,
              deprecated: {
                kind: NoticeKind.Unconsumed,
                notice: "No AI vendor documents reading this file.",
                link: "https://example.com/evidence",
              },
            }),
          ],
        }),
      ]),
    );
    expect(html).toContain("No AI vendor reads this");
    expect(html).not.toContain("Deprecated — no longer a factor");
  });
});

it("shows evidence-backed optional advice without failed-check styling", () => {
  const advice = check({
    id: "optional-example",
    title: "Optional policy choices",
    status: CheckStatus.NotApplicable,
    tier: AuditTier.Informative,
    scoreDisplayMode: ScoreDisplayMode.Informative,
    fix: "Choose each purpose independently.",
    details: {
      optionalGuidance: true,
      declarations: ["search: Not declared"],
      verification: ["External compliance cannot be proven."],
    },
  });
  const output = generateHtmlReport(
    report([cat({ id: "agent-interfaces", checks: [advice] })]),
  );
  expect(output).toContain("Optional guidance (not scored)");
  expect(output).toContain("cat-card bg-white dark:bg-slate-900");
  expect(output).toContain(
    "dark:bg-slate-800 text-slate-600 dark:text-slate-400",
  );
  expect(output).toContain("search: Not declared");
  expect(output).toContain("Choose each purpose independently.");
  expect(output).toContain("External compliance cannot be proven.");
  const skipped = generateHtmlReport(
    report([
      cat({
        id: "agent-interfaces",
        checks: [{ ...advice, tags: [TAG_SCAN_ERROR] }],
      }),
    ]),
  );
  expect(skipped).not.toContain("Optional guidance (not scored)");
});

describe("report UX enhancements", () => {
  it("renders filter count badges matching check statuses", () => {
    const r = report([
      cat({
        id: "agent-interfaces",
        checks: [
          check({ id: "c1", status: CheckStatus.Pass }),
          check({ id: "c2", status: CheckStatus.Warn }),
          check({ id: "c3", status: CheckStatus.Fail }),
        ],
      }),
    ]);
    const html = generateHtmlReport(r);

    expect(html).toContain("filterStatus('all', this)");
    expect(html).toContain("filterStatus('fail', this)");
    expect(html).toContain("filterStatus('warn', this)");
    expect(html).toContain("filterStatus('pass', this)");
    // Total: 3, Fail: 1, Warn: 1, Pass: 1
    expect(html).toContain(
      '<span class="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-700 text-slate-300 font-mono">3</span>',
    );
    expect(html).toContain(
      '<span class="text-[10px] px-1.5 py-0.5 rounded-full bg-red-950/80 text-red-400 border border-red-800/60 font-mono">1</span>',
    );
    expect(html).toContain(
      '<span class="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-950/80 text-amber-400 border border-amber-800/60 font-mono">1</span>',
    );
    expect(html).toContain(
      '<span class="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-950/80 text-emerald-400 border border-emerald-800/60 font-mono">1</span>',
    );
  });

  it("renders expand/collapse all toggle and empty state container", () => {
    const html = generateHtmlReport(report([]));
    expect(html).toContain('id="toggle-all-btn"');
    expect(html).toContain('onclick="toggleAllChecks()"');
    expect(html).toContain('id="filter-empty-state"');
    expect(html).toContain("No checks match this filter");
  });

  it("renders keyboard focus-visible styling on check summary", () => {
    const html = generateHtmlReport(
      report([cat({ id: "agent-interfaces", checks: [check({ id: "c1" })] })]),
    );
    expect(html).toContain(
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
    );
  });

  it("includes clipboard copy fallback with execCommand", () => {
    const html = generateHtmlReport(report([]));
    expect(html).toContain("navigator.clipboard && window.isSecureContext");
    expect(html).toContain("document.execCommand('copy')");
  });
});

describe("report controls in the DOM", () => {
  let dom: JSDOM;
  afterEach(() => dom?.window.close());

  function openReport(checks: CheckResult[]) {
    dom = new JSDOM(
      generateHtmlReport(report([cat({ id: "agent-interfaces", checks })])),
      {
        runScripts: "outside-only",
        url: "https://report.test/",
      },
    );
    const scripts = dom.window.document.querySelectorAll("script");
    dom.window.eval(scripts[scripts.length - 1]!.textContent ?? "");
    return dom.window.document;
  }

  it("tracks visible expansion after filter changes and manual toggles", () => {
    const doc = openReport([
      check({ id: "passed" }),
      check({ id: "failed", status: CheckStatus.Fail }),
    ]);
    // outside-only deliberately does not execute inline onclick attributes.
    dom.window.eval(
      "filterStatus('fail'); toggleAllChecks(); filterStatus('pass');",
    );
    expect(doc.getElementById("toggle-all-text")!.textContent).toBe(
      "Expand all",
    );
    dom.window.eval("toggleAllChecks();");
    expect(
      doc.querySelector<HTMLDetailsElement>('[data-status="pass"]')!.open,
    ).toBe(true);
    expect(doc.getElementById("toggle-all-text")!.textContent).toBe(
      "Collapse all",
    );
    const item = doc.querySelector<HTMLDetailsElement>('[data-status="pass"]')!;
    item.open = false;
    item.dispatchEvent(new dom.window.Event("toggle"));
    expect(doc.getElementById("toggle-all-text")!.textContent).toBe(
      "Expand all",
    );
    expect(
      doc.querySelector('[data-filter="pass"]')!.getAttribute("aria-pressed"),
    ).toBe("true");
  });

  it("hides empty groups and optional advice, then restores them", () => {
    const doc = openReport([
      check(),
      check({
        id: "optional",
        status: CheckStatus.NotApplicable,
        tier: AuditTier.Informative,
        scoreDisplayMode: ScoreDisplayMode.Informative,
        details: { optionalGuidance: true },
      }),
    ]);
    dom.window.eval("filterStatus('fail');");
    expect(
      doc.getElementById("filter-empty-state")!.classList.contains("hidden"),
    ).toBe(false);
    expect(
      doc.querySelector<HTMLElement>(".group-section")!.style.display,
    ).toBe("none");
    expect(
      doc.querySelector<HTMLElement>('[aria-label="Optional guidance"]')!.style
        .display,
    ).toBe("none");
    expect(
      doc.querySelector<HTMLButtonElement>("#toggle-all-btn")!.disabled,
    ).toBe(true);
    dom.window.eval("filterStatus('all');");
    expect(
      doc.querySelector<HTMLElement>('[aria-label="Optional guidance"]')!.style
        .display,
    ).toBe("");
    expect(
      doc.getElementById("filter-empty-state")!.classList.contains("hidden"),
    ).toBe(true);
  });

  it("shows the empty state on initial load with no rendered checks", () => {
    const doc = openReport([]);
    expect(
      doc.getElementById("filter-empty-state")!.classList.contains("hidden"),
    ).toBe(false);
    expect(
      doc.querySelector<HTMLButtonElement>("#toggle-all-btn")!.disabled,
    ).toBe(true);
  });

  it("hides categories with no rendered checks under a status filter", () => {
    const doc = openReport([]);
    dom.window.eval("filterStatus('fail');");
    expect(doc.querySelector<HTMLElement>(".cat-card")!.style.display).toBe(
      "none",
    );
    dom.window.eval("filterStatus('all');");
    expect(doc.querySelector<HTMLElement>(".cat-card")!.style.display).toBe("");
  });

  it("waits for clipboard success and preserves literal code", async () => {
    const code = '<tag> & "quoted"\n  next line';
    const doc = openReport([check({ details: { code } })]);
    let resolve!: () => void;
    const writeText = vi.fn(
      () =>
        new Promise<void>((r) => {
          resolve = r;
        }),
    );
    Object.defineProperty(dom.window.navigator, "clipboard", {
      value: { writeText },
    });
    Object.defineProperty(dom.window, "isSecureContext", { value: true });
    const btn = doc.querySelector<HTMLButtonElement>(
      '[onclick="copySnippet(this)"]',
    )!;
    const pending = dom.window.eval(
      "copySnippet(document.querySelector('[onclick=\"copySnippet(this)\"]'))",
    ) as Promise<void>;
    expect(btn.textContent).toBe("Copy Code");
    expect(btn.disabled).toBe(true);
    expect(writeText).toHaveBeenCalledWith(code);
    resolve();
    await pending;
    expect(btn.textContent).toBe("Copied! ✓");
    expect(btn.disabled).toBe(false);
  });

  it.each([false, "throws", true])(
    "cleans up clipboard fallback with result %s",
    async (result) => {
      const doc = openReport([check({ details: { code: "literal code" } })]);
      Object.defineProperty(doc, "execCommand", {
        value: vi.fn(() => {
          expect(doc.querySelector("textarea")!.value).toBe("literal code");
          if (result === "throws") throw new Error("Copy denied");
          return result;
        }),
      });
      const btn = doc.querySelector<HTMLButtonElement>(
        '[onclick="copySnippet(this)"]',
      )!;
      const filter = doc.querySelector<HTMLButtonElement>(
        '[data-filter="all"]',
      )!;
      filter.focus();
      await dom.window.eval(
        "copySnippet(document.querySelector('[onclick=\"copySnippet(this)\"]'))",
      );
      expect(doc.querySelector("textarea")).toBeNull();
      expect(doc.activeElement).toBe(filter);
      expect(btn.disabled).toBe(false);
      expect(btn.textContent).toBe(
        result === true
          ? "Copied! ✓"
          : "Copy failed — select the code and copy it",
      );
    },
  );
});
