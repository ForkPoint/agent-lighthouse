import { describe, it, expect } from "vitest";
import { AiPluginJsonAudit } from "./ai-plugin-json";
import { weightForGrade } from "#core/scorer";
import { AuditMetaSchema } from "#core/schemas";
import { mockCheckContext, mockFetchResult } from "#core/__tests__/test-utils";
import { expectNotApplicableOnEmpty } from "#core/tests/na-contract";
import {
  AuditTier,
  CheckStatus,
  EvidenceGrade,
  NoticeKind,
  ScoreDisplayMode,
} from "#core/types";

const PATH = "/.well-known/ai-plugin.json";

const MANIFEST = JSON.stringify({
  schema_version: "v1",
  name_for_human: "Site",
  name_for_model: "site",
  description_for_model: "Search the site.",
  api: { type: "openapi", url: "https://example.com/openapi.yaml" },
});

function runWith(body: string, status = 200, contentType = "application/json") {
  return new AiPluginJsonAudit().audit(
    mockCheckContext([], {
      [PATH]: mockFetchResult(body, status, contentType),
    }),
  );
}

describe("AiPluginJsonAudit", () => {
  it("is an obsolete-tier audit with grade D and an obsolete notice", () => {
    const { meta } = AiPluginJsonAudit;
    expect(meta.tier).toBe(AuditTier.Obsolete);
    expect(meta.evidenceGrade).toBe(EvidenceGrade.D);
    expect(meta.weight).toBe(
      weightForGrade(EvidenceGrade.D, AuditTier.Obsolete),
    );
    expect(meta.weight).toBe(0);
    expect(meta.scoreDisplayMode).toBe(ScoreDisplayMode.Informative);
    expect(meta.deprecated?.kind).toBe(NoticeKind.Obsolete);
    expect(meta.deprecated?.link).toMatch(/^https:\/\//);
    expect(AuditMetaSchema.safeParse(meta).success).toBe(true);
  });

  it("is not applicable on a scan that read nothing", async () => {
    await expectNotApplicableOnEmpty(new AiPluginJsonAudit());
  });

  it("warns when a ChatGPT plugin manifest is still published", () => {
    const result = runWith(MANIFEST);
    expect(result.status).toBe(CheckStatus.Warn);
    expect(result.message).toContain("ChatGPT plugins closed");
    expect(result.message).toContain("2024");
    expect(result.found).toContain("name_for_model");
  });

  it.each([
    ["a 404", "Not found", 404],
    [
      "an HTML page standing in for the file",
      "<!doctype html><html></html>",
      200,
    ],
    ["an empty body", "", 200],
    ["JSON that is not a plugin manifest", '{"name":"x"}', 200],
    // `schema_version` and `name_for_human` alone are too generic to name
    // the file a plugin manifest.
    ["a lone schema_version key", '{"schema_version":"v1","name":"x"}', 200],
    ["a lone name_for_human key", '{"name_for_human":"Site"}', 200],
    ["a body that is not JSON", "not json", 200],
  ])("is not applicable for %s", (_label, body, status) => {
    expect(runWith(body, status).status).toBe(CheckStatus.NotApplicable);
  });

  it.each([
    ["name_for_model alone", '{"name_for_model":"site"}'],
    ["description_for_model alone", '{"description_for_model":"Search."}'],
    [
      "two generic manifest keys",
      '{"schema_version":"v1","name_for_human":"Site"}',
    ],
  ])("recognises a manifest by %s", (_label, body) => {
    expect(runWith(body).status).toBe(CheckStatus.Warn);
  });

  it("never fails", () => {
    for (const body of [MANIFEST, "{}", "[]", "<html>", ""]) {
      expect(runWith(body).status).not.toBe(CheckStatus.Fail);
    }
  });
});
