import { describe, it, expect } from "vitest";
import { AgentsJsonAudit } from "./agents-json";
import { weightForGrade } from "#core/scorer";
import { AuditMetaSchema } from "#core/schemas";
import { mockCheckContext, mockFetchResult } from "#core/__tests__/test-utils";
import { expectNotApplicableOnEmpty } from "#core/tests/na-contract";
import {
  AuditTier,
  CheckPriority,
  CheckStatus,
  EvidenceGrade,
  NoticeKind,
  ScoreDisplayMode,
} from "#core/types";

const PATH = "/.well-known/agents.json";

function runWith(body: string, status = 200, contentType = "application/json") {
  const audit = new AgentsJsonAudit();
  const ctx = mockCheckContext([], {
    [PATH]: mockFetchResult(body, status, contentType),
  });
  return audit.audit(ctx);
}

const VALID_DOCUMENT = JSON.stringify({
  $schema:
    "https://raw.githubusercontent.com/wild-card-ai/agents-json/main/schema/agents.schema.json",
  info: { title: "Site", version: "0.1.0" },
  sources: [{ id: "api", path: "/openapi.json" }],
});

const HTML_SHELL = "<!doctype html><html><body>App</body></html>";

describe("AgentsJsonAudit", () => {
  const audit = new AgentsJsonAudit();

  describe("a published document", () => {
    it("warns that the format is obsolete when a real agents.json document is served", () => {
      const result = runWith(VALID_DOCUMENT);
      expect(result.status).toBe(CheckStatus.Warn);
      expect(result.priority).toBe(CheckPriority.Low);
      expect(result.message).toContain("no known reader");
      expect(result.message).toContain("agent-card.json");
      expect(result.found).toContain("1 source(s)");
    });

    it("recognises a flows-only document", () => {
      const body = JSON.stringify({
        info: { title: "Site", version: "0.1.0" },
        flows: [{ id: "search", name: "Search content" }],
      });
      const result = runWith(body);
      expect(result.status).toBe(CheckStatus.Warn);
      expect(result.found).toContain("1 flow(s)");
    });
  });

  describe("nothing recognisable is published", () => {
    it.each([
      ["a 404", "Not found", 404],
      ["an empty 200 body", "", 200],
      ["an HTML page standing in for the file", HTML_SHELL, 200],
      ["a body that is not JSON", "not json", 200],
      ["an empty array", "[]", 200],
      ["an empty object", "{}", 200],
      ["an unrelated JSON shape", '{"name":"Site","protocols":["rest"]}', 200],
    ])("is not applicable for %s", (_label, body, status) => {
      expect(runWith(body, status).status).toBe(CheckStatus.NotApplicable);
    });

    it("is not applicable when the path was not fetched", () => {
      expect(audit.audit(mockCheckContext([], {})).status).toBe(
        CheckStatus.NotApplicable,
      );
    });

    it("is not applicable on a scan that read nothing", async () => {
      await expectNotApplicableOnEmpty(audit);
    });
  });

  it("never returns fail for any input", () => {
    for (const body of [VALID_DOCUMENT, HTML_SHELL, "", "[]", "{}", "x"]) {
      expect(runWith(body).status).not.toBe(CheckStatus.Fail);
    }
  });

  describe("meta", () => {
    const { meta } = AgentsJsonAudit;

    it("is an obsolete-tier audit: grade D, weight 0, informative display", () => {
      expect(meta.tier).toBe(AuditTier.Obsolete);
      expect(meta.evidenceGrade).toBe(EvidenceGrade.D);
      expect(meta.weight).toBe(
        weightForGrade(EvidenceGrade.D, AuditTier.Obsolete),
      );
      expect(meta.weight).toBe(0);
      expect(meta.scoreDisplayMode).toBe(ScoreDisplayMode.Informative);
      expect(AuditMetaSchema.safeParse(meta).success).toBe(true);
    });

    it("carries an obsolete notice that names what to use instead", () => {
      expect(meta.deprecated?.kind).toBe(NoticeKind.Obsolete);
      expect(meta.deprecated?.replacement).toContain("agent-card.json");
      expect(meta.deprecated?.link).toBe(
        "https://github.com/wild-card-ai/agents-json",
      );
    });

    it("never instructs a non-publisher to create the file", () => {
      expect(meta.guidance?.fix).not.toMatch(
        /\b(add|create|publish) (an? )?agents\.json/i,
      );
    });
  });
});
