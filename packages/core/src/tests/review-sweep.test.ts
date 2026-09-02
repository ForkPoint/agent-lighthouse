import { describe, it, expect } from "vitest";
// @ts-expect-error - testing the .mjs script exports
import { sweepAudits, formatMarkdownReport } from "../../../../scripts/sweep-audit-reviews.mjs";

describe("Phase 6: Audit Review Sweep (Law 10: Warrant Expires)", () => {
  it("sweeps the live audit dossiers directory and returns structured metrics", () => {
    const result = sweepAudits();

    expect(result.totalAudits).toBeGreaterThanOrEqual(215);
    expect(typeof result.overdueCount).toBe("number");
    expect(Array.isArray(result.dossiers)).toBe(true);
    expect(result.dossiers.length).toBe(result.totalAudits);

    // Verify properties of every inspected dossier
    for (const dossier of result.dossiers) {
      expect(dossier.auditId).toBeTruthy();
      expect(dossier.file).toContain("docs/evidence/audits/");
      expect(["A", "B", "C", "D"]).toContain(dossier.evidenceGrade);
      expect(typeof dossier.isOverdue).toBe("boolean");
    }
  });

  it("identifies all dossiers as overdue when simulated 1 year in the future", () => {
    const futureDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
    const result = sweepAudits(futureDate);

    expect(result.overdueCount).toBe(result.totalAudits);
    expect(result.overdue.length).toBe(result.totalAudits);

    // Every dossier must be marked overdue
    for (const dossier of result.overdue) {
      expect(dossier.isOverdue).toBe(true);
      expect(dossier.daysOld).toBeGreaterThan(180);
    }

    // Must sort oldest first
    for (let i = 1; i < result.overdue.length; i++) {
      const prev = result.overdue[i - 1]!;
      const curr = result.overdue[i]!;
      expect((prev.daysOld ?? 0) >= (curr.daysOld ?? 0)).toBe(true);
    }
  });

  it("formats markdown report with a warning table when dossiers are overdue", () => {
    const mockSweepResult = {
      totalAudits: 2,
      overdueCount: 2,
      dossiers: [],
      overdue: [
        {
          file: "docs/evidence/audits/access-crawl-control/robots-txt-exists.md",
          auditId: "access-crawl-control/robots-txt-exists",
          category: "access-crawl-control",
          evidenceGrade: "A",
          reviewed: "2025-01-01",
          daysOld: 600,
          isOverdue: true,
        },
        {
          file: "docs/evidence/audits/machine-discovery/llms-txt-exists.md",
          auditId: "machine-discovery/llms-txt-exists",
          category: "machine-discovery",
          evidenceGrade: "A",
          reviewed: "2025-02-01",
          daysOld: 570,
          isOverdue: true,
        },
      ],
    };

    const md = formatMarkdownReport(mockSweepResult);
    expect(md).toContain("# 📜 Scheduled Audit Evidence Review Sweep");
    expect(md).toContain("Total Registered Audits:** 2");
    expect(md).toContain("Audits Overdue for Re-review (>180 days):** 2");
    expect(md).toContain("| `access-crawl-control/robots-txt-exists` | **A** |");
    expect(md).toContain("| `machine-discovery/llms-txt-exists` | **A** |");
  });

  it("formats markdown report with a success message when no dossiers are overdue", () => {
    const mockSweepResult = {
      totalAudits: 215,
      overdueCount: 0,
      dossiers: [],
      overdue: [],
    };

    const md = formatMarkdownReport(mockSweepResult);
    expect(md).toContain("Audits Overdue for Re-review (>180 days):** 0");
    expect(md).toContain("✅ All audit evidence dossiers are up to date");
    expect(md).not.toContain("| Audit ID | Grade |");
  });
});
