import { describe, it, expect } from "vitest";
import { ContentSignalsAudit } from "./content-signals";
import { mockCheckContext, mockFetchResult } from "#core/__tests__/test-utils";
import { AuditResultSchema } from "#core/schemas";
import { CheckStatus, AuditTier, EvidenceGrade } from "#core/types";
const audit = new ContentSignalsAudit();
function run(body: string, status = 200) {
  const result = audit.audit(
    mockCheckContext([], {
      "/robots.txt": mockFetchResult(body, status, "text/plain"),
    }),
  );
  AuditResultSchema.parse(result);
  return result;
}
describe("Content Signals audit", () => {
  it("is grade C, informative and zero weight", () => {
    expect(ContentSignalsAudit.meta).toMatchObject({
      tier: AuditTier.Informative,
      evidenceGrade: EvidenceGrade.C,
      weight: 0,
    });
  });
  it("reports all choices with source scopes", () => {
    const result = run(
      "User-agent: Bot\nContent-Signal: /Blog/ search=yes, ai-input=no, ai-train=no",
    );
    expect(result.status).toBe(CheckStatus.Pass);
    expect(result.details?.["declarations"]).toEqual(
      expect.arrayContaining([
        expect.stringContaining("ai-input: Declined (no)"),
      ]),
    );
    expect(JSON.stringify(result.details)).toContain("path /Blog/");
    expect(result.details?.["conditionalEdits"]).toEqual([]);
  });
  it.each([200, 404, 410])(
    "offers optional advice only after checked absence (%i)",
    (status) => {
      const result = run("# search=yes is a policy comment", status);
      expect(result.status).toBe(CheckStatus.NotApplicable);
      expect(result.details?.["optionalGuidance"]).toBe(true);
      expect(result.remediation).toContain("Optional examples, not defaults");
      expect(result.remediation).not.toContain("Allow: /");
    },
  );
  it.each([0, 403, 429, 500])(
    "does not claim missing preferences from unavailable evidence (%i)",
    (status) => {
      const result = run("", status);
      expect(result.message).toContain("Could not check");
      expect(result.details?.["optionalGuidance"]).toBeUndefined();
      expect(result.remediation).toBeUndefined();
    },
  );
  it("rejects an HTML response as unavailable evidence", () => {
    expect(run("<!doctype html><html>blocked</html>").message).toContain(
      "Could not check",
    );
  });
  it("preserves comments and scoped restrictive choices in conditional edits", () => {
    const result = run(
      "User-agent: Bot\nContent-Signal: /blog/ search=yes, ai-train=no, custom=foo # retain me\nDisallow: /private/",
    );
    expect(result.status).toBe(CheckStatus.Pass);
    expect(result.details?.["conditionalEdits"]).toEqual([
      expect.stringContaining(
        "Replacement: Content-Signal: /blog/ search=yes, ai-train=no, custom=foo, ai-input=yes # retain me",
      ),
    ]);
    expect(JSON.stringify(result.details)).toContain("ai-input: Not declared");
  });
  it("retains good entries beside faults and explains extensions", () => {
    const result = run(
      "Content-Signal: search=yes, ai-input=maybe, use=reference, custom=x",
    );
    expect(result.status).toBe(CheckStatus.Warn);
    expect(JSON.stringify(result.details)).toContain("search: Allowed");
    expect(JSON.stringify(result.details)).toContain("optional test extension");
    expect(JSON.stringify(result.details)).toContain("unrecognized extension");
  });
  it("requires managed markers for an editing-location note", () => {
    const result = run(
      "# BEGIN Cloudflare Managed content\nUser-agent: *\nContent-Signal: use=reference\n# END Cloudflare Managed content",
    );
    expect(JSON.stringify(result.details)).toContain("Bot Preference Sync");
  });
  it("keeps managed editing advice when a marked block declares no preference", () => {
    const result = run(
      "# BEGIN Cloudflare Managed content\nUser-agent: *\n# policy only\n# END Cloudflare Managed content",
    );
    expect(result.status).toBe(CheckStatus.NotApplicable);
    expect(JSON.stringify(result.details)).toContain("Bot Preference Sync");
  });
  it("reports opposite overlapping declarations for review without invented precedence", () => {
    const result = run(
      "User-agent: *\nContent-Signal: ai-train=no\nContent-Signal: /blog/ ai-train=yes",
    );
    expect(result.status).toBe(CheckStatus.Pass);
    expect(JSON.stringify(result.details)).toContain(
      "Overlapping declarations for review",
    );
    expect(result.details?.["repeatedDeclarations"]).toEqual([]);
  });
  it("keeps access distinct from use", () => {
    expect(
      run("User-agent: *\nAllow: /\nContent-Signal: ai-train=no").status,
    ).toBe(CheckStatus.Pass);
    const blocked = run(
      "User-agent: Bot\nDisallow: /\nContent-Signal: ai-input=yes",
    );
    expect(blocked.status).toBe(CheckStatus.Pass);
    expect(JSON.stringify(blocked.details)).toContain("access obstacle");
  });
});

it.each(["search=yes, search=yes", "search=yes, search=no"])(
  "warns about exact-scope repeats: %s",
  (fields) => {
    const result = run(`User-agent: Bot\nContent-Signal: /blog/ ${fields}`);
    expect(result.status).toBe(CheckStatus.Warn);
    expect(result.details?.["repeatedDeclarations"]).toEqual([
      expect.stringContaining(
        fields.endsWith("no") ? "Conflicting" : "Duplicate",
      ),
    ]);
    expect(JSON.stringify(result.details?.["declarations"])).toContain(
      fields.endsWith("no") ? "Conflicting" : "Allowed (yes)",
    );
  },
);

it.each([
  "#" + "x".repeat(500 * 1024) + "\nContent-Signal: search=no",
  Array.from({ length: 100 }, (_, i) => `User-agent: Bot${i}`).join("\n") +
    "\n" +
    "Content-Signal: search=yes\n".repeat(100),
])("does not infer policy or edits after incomplete parsing", (body) => {
  const result = run(body);
  expect(result.status).toBe(CheckStatus.Warn);
  expect(result.details?.["analysisComplete"]).toBe(false);
  expect(result.message).toContain("incomplete");
  expect(result.details?.["conditionalEdits"]).toBeUndefined();
  expect(JSON.stringify(result)).not.toContain("Not declared");
  expect(JSON.stringify(result)).not.toContain(
    "No Content Signals preferences declared",
  );
});

it.each([
  "Content-Signal: ai-train=no, custom=" + "x".repeat(100000),
  ("Content-Signal: ai-train=no, custom=" + "x".repeat(2000) + "\n").repeat(30),
])(
  "bounds large-line evidence without presenting shortened exact edits",
  (body) => {
    const result = run(body);
    const arrays = Object.values(result.details ?? {}).filter(
      Array.isArray,
    ) as string[][];
    expect(arrays.flat().every((text) => text.length <= 1000)).toBe(true);
    expect(
      arrays.flat().reduce((sum, text) => sum + text.length, 0),
    ).toBeLessThanOrEqual(20000);
    expect(JSON.stringify(result.details)).toContain("Evidence shortened");
    expect(JSON.stringify(result.details?.["conditionalEdits"])).not.toContain(
      "Replacement:",
    );
  },
);
