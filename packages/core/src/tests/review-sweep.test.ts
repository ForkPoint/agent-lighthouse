import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
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

  it("handles edge cases in a hermetic mock directory: invalid dates, missing fields, quoted dates, and 180-day boundary", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "al-sweep-test-"));
    const now = new Date("2026-09-02T12:00:00Z");

    try {
      // 1. Fresh dossier (10 days old -> not overdue)
      fs.writeFileSync(
        path.join(tempDir, "fresh.md"),
        `---
audit: test/fresh
category: test
evidence_grade: A
reviewed: 2026-08-23
---
Content
`,
      );

      // 2. Exact 179-day boundary (not overdue)
      const day179Ago = new Date(now.getTime() - 179 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];
      fs.writeFileSync(
        path.join(tempDir, "boundary-fresh.md"),
        `---
audit: test/boundary-fresh
category: test
evidence_grade: B
reviewed: "${day179Ago}"
---
Content
`,
      );

      // 3. Exact 181-day boundary (overdue)
      const day181Ago = new Date(now.getTime() - 181 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];
      fs.writeFileSync(
        path.join(tempDir, "boundary-overdue.md"),
        `---
audit: test/boundary-overdue
category: test
evidence_grade: A
reviewed: '${day181Ago}'
---
Content
`,
      );

      // 4. Missing reviewed field (overdue / never)
      fs.writeFileSync(
        path.join(tempDir, "no-date.md"),
        `---
audit: test/no-date
category: test
evidence_grade: C
---
Content
`,
      );

      // 5. Invalid date string (overdue)
      fs.writeFileSync(
        path.join(tempDir, "bad-date.md"),
        `---
audit: test/bad-date
category: test
evidence_grade: D
reviewed: not-a-valid-date
---
Content
`,
      );

      const result = sweepAudits(now, tempDir);

      expect(result.totalAudits).toBe(5);
      expect(result.overdueCount).toBe(3); // boundary-overdue, no-date, bad-date

      const fresh = result.dossiers.find(
        (d: any) => d.auditId === "test/fresh",
      );
      expect(fresh.isOverdue).toBe(false);
      expect(fresh.daysOld).toBe(10);

      const boundaryFresh = result.dossiers.find(
        (d: any) => d.auditId === "test/boundary-fresh",
      );
      expect(boundaryFresh.isOverdue).toBe(false);

      const boundaryOverdue = result.dossiers.find(
        (d: any) => d.auditId === "test/boundary-overdue",
      );
      expect(boundaryOverdue.isOverdue).toBe(true);
      expect(boundaryOverdue.daysOld).toBe(181);

      const noDate = result.dossiers.find(
        (d: any) => d.auditId === "test/no-date",
      );
      expect(noDate.isOverdue).toBe(true);
      expect(noDate.reviewed).toBe("never");

      const badDate = result.dossiers.find(
        (d: any) => d.auditId === "test/bad-date",
      );
      expect(badDate.isOverdue).toBe(true);

      // Verify sorting: never/invalid first, then largest daysOld
      expect(result.dossiers[0].daysOld).toBeNull();
      expect(result.dossiers[1].daysOld).toBeNull();
      expect(result.dossiers[2].auditId).toBe("test/boundary-overdue");
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
    expect(md).toContain("Audits Overdue for Re-review (>180 days):** 0");
    expect(md).toContain("✅ All audit evidence dossiers are up to date");
    expect(md).not.toContain("| Audit ID | Grade |");
  });
});
