import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
// The script under test lives outside core, so it has no #core path.
// oxlint-disable-next-line no-restricted-imports
import {
  sweepAudits,
  formatMarkdownReport,
  reviewWindowDays,
  // The directive must sit on the line before the module specifier, which is
  // where TypeScript reports the missing declaration for the .mjs script.
  // @ts-expect-error - testing the .mjs script exports
} from "../../../../scripts/evidence/sweep-audit-reviews.mjs";
import { EvidenceGrade } from "#core/types";

describe("Phase 6: Audit Review Sweep (Law 10: Warrant Expires)", () => {
  it("sweeps the live audit dossiers directory and returns structured metrics", () => {
    const result = sweepAudits();

    expect(result.totalAudits).toBeGreaterThanOrEqual(221);
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

  it("identifies all dossiers as overdue when simulated 400 days in the future", () => {
    const futureDate = new Date(Date.now() + 400 * 24 * 60 * 60 * 1000);
    const result = sweepAudits(futureDate);

    expect(result.overdueCount).toBe(result.totalAudits);
    expect(result.overdue.length).toBe(result.totalAudits);

    // Every dossier must be marked overdue
    for (const dossier of result.overdue) {
      expect(dossier.isOverdue).toBe(true);
      expect(dossier.daysOld).toBeGreaterThan(dossier.windowDays);
    }

    // Must sort oldest first
    for (let i = 1; i < result.overdue.length; i++) {
      const prev = result.overdue[i - 1]!;
      const curr = result.overdue[i]!;
      expect((prev.daysOld ?? 0) >= (curr.daysOld ?? 0)).toBe(true);
    }
  });

  it("sets the review window by grade: A 365 days, B 182, C and D 91", () => {
    expect(reviewWindowDays(EvidenceGrade.A)).toBe(365);
    expect(reviewWindowDays(EvidenceGrade.B)).toBe(182);
    expect(reviewWindowDays(EvidenceGrade.C)).toBe(91);
    expect(reviewWindowDays(EvidenceGrade.D)).toBe(91);
    // An unknown grade gets the shortest window.
    expect(reviewWindowDays("Z")).toBe(91);
  });

  it("handles edge cases in a hermetic mock directory: invalid dates, missing fields, quoted dates, and per-grade boundaries", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "al-sweep-test-"));
    const now = new Date("2026-09-02T12:00:00Z");
    const daysAgo = (n: number) =>
      new Date(now.getTime() - n * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];
    const write = (name: string, grade: string, reviewed?: string) =>
      fs.writeFileSync(
        path.join(tempDir, `${name}.md`),
        [
          "---",
          `audit: test/${name}`,
          "category: test",
          `evidence_grade: ${grade}`,
          ...(reviewed === undefined ? [] : [`reviewed: ${reviewed}`]),
          "---",
          "Content",
          "",
        ].join("\n"),
      );

    try {
      write("fresh", "A", "2026-08-23");
      // Each grade just inside and just past its window; mixed quoting.
      write("a-inside", "A", `"${daysAgo(364)}"`);
      write("a-past", "A", `'${daysAgo(366)}'`);
      write("b-inside", "B", daysAgo(181));
      write("b-past", "B", daysAgo(183));
      write("c-inside", "C", daysAgo(90));
      write("c-past", "C", daysAgo(92));
      write("d-past", "D", daysAgo(92));
      write("no-date", "C");
      write("bad-date", "D", "not-a-valid-date");

      const result = sweepAudits(now, tempDir);
      const byId = (id: string) =>
        result.dossiers.find((d: any) => d.auditId === `test/${id}`);

      expect(result.totalAudits).toBe(10);
      expect(result.overdue.map((d: any) => d.auditId.slice(5)).sort()).toEqual(
        ["a-past", "b-past", "bad-date", "c-past", "d-past", "no-date"],
      );

      expect(byId("fresh").daysOld).toBe(10);
      expect(byId("fresh").windowDays).toBe(365);
      expect(byId("a-past").daysOld).toBe(366);
      expect(byId("no-date").reviewed).toBe("never");

      // Never/invalid first, then largest daysOld.
      expect(result.dossiers[0].daysOld).toBeNull();
      expect(result.dossiers[1].daysOld).toBeNull();
      expect(result.dossiers[2].auditId).toBe("test/a-past");
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
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
          evidenceGrade: EvidenceGrade.A,
          reviewed: "2025-01-01",
          daysOld: 600,
          isOverdue: true,
        },
        {
          file: "docs/evidence/audits/machine-discovery/llms-txt-exists.md",
          auditId: "machine-discovery/llms-txt-exists",
          category: "machine-discovery",
          evidenceGrade: EvidenceGrade.A,
          reviewed: "2025-02-01",
          daysOld: 570,
          isOverdue: true,
        },
      ],
    };

    const md = formatMarkdownReport(mockSweepResult);
    expect(md).toContain("# 📜 Scheduled Audit Evidence Review Sweep");
    expect(md).toContain("Total Registered Audits:** 2");
    expect(md).toContain("Audits Overdue for Re-review:** 2");
    expect(md).toContain(
      "| `access-crawl-control/robots-txt-exists` | **A** |",
    );
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
    expect(md).toContain("Audits Overdue for Re-review:** 0");
    expect(md).toContain("✅ All audit evidence dossiers are up to date");
    expect(md).not.toContain("| Audit ID | Grade |");
  });
});
