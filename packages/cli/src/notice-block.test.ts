import { describe, it, expect } from "vitest";
import type { CheckResult, ScanReport } from "@forkpoint/agent-lighthouse-core";
import {
  AuditTier,
  CheckPriority,
  CheckStatus,
  NoticeKind,
  PageType,
  ScoreDisplayMode,
  ScoreTier,
} from "@forkpoint/agent-lighthouse-core";
import { buildReportView } from "@forkpoint/agent-lighthouse-report";
import { noticeLines, obsoleteLines } from "./notice-block";

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

function viewOf(checks: CheckResult[]) {
  const report: ScanReport = {
    scanId: "s1",
    url: "https://x.test/",
    domain: "x.test",
    overallScore: 42,
    scoreTier: ScoreTier.NeedsWork,
    categories: [
      {
        id: "agent-interfaces",
        name: "Agent interfaces",
        weight: 0.1,
        score: 0,
        passCount: 0,
        warnCount: 0,
        failCount: 0,
        checks,
      },
    ],
    topPasses: [],
    topFails: [],
    recommendations: [],
    pagesScanned: [{ url: "https://x.test/", pageType: PageType.Homepage }],
    scannedAt: "2026-01-01T00:00:00.000Z",
    durationMs: 1,
  };
  return buildReportView(report);
}

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

describe("obsoleteLines", () => {
  it("prints the section with notice, replacement and source", () => {
    const text = obsoleteLines(viewOf([retired])).join("\n");
    expect(text).toContain("OBSOLETE (not scored)");
    expect(text).toContain("Retired file still published");
    expect(text).toContain("The vendor retired this file in 2024.");
    expect(text).toContain("Publish the successor file.");
    expect(text).toContain("https://example.com/retired");
  });

  it("prints nothing when nothing obsolete was found", () => {
    expect(
      obsoleteLines(
        viewOf([{ ...retired, status: CheckStatus.NotApplicable, score: 0 }]),
      ),
    ).toEqual([]);
  });
});

describe("noticeLines", () => {
  it("prints an unconsumed notice under its label", () => {
    const text = noticeLines(
      viewOf([
        check({
          title: "Unread file is well formed",
          tier: AuditTier.Informative,
          scoreDisplayMode: ScoreDisplayMode.Informative,
          deprecated: {
            kind: NoticeKind.Unconsumed,
            notice: "No AI vendor documents reading this file.",
            link: "https://example.com/evidence",
          },
        }),
      ]),
    ).join("\n");
    expect(text).toContain("No AI vendor reads this");
    expect(text).toContain("Unread file is well formed");
    expect(text).toContain("No AI vendor documents reading this file.");
  });

  it("prints nothing without notices", () => {
    expect(noticeLines(viewOf([check()]))).toEqual([]);
  });
});
