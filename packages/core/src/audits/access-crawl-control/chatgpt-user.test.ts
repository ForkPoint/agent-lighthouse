import { describe, it, expect } from "vitest";
import { ChatgptUserAudit } from "./chatgpt-user";
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

const robots = (body: string, status = 200) =>
  mockCheckContext([], { "/robots.txt": mockFetchResult(body, status) });

describe("ChatgptUserAudit", () => {
  const audit = new ChatgptUserAudit();

  // OpenAI says the rules "may not apply": a hedge, not a documented refusal.
  // The group is reported with that qualifier and never costs anything.
  it.each([
    ["an allowing group", "User-agent: ChatGPT-User\nAllow: /"],
    ["a blocking group", "User-agent: ChatGPT-User\nDisallow: /"],
    [
      "a group shared with other tokens",
      "User-agent: Googlebot\nUser-agent: ChatGPT-User\nDisallow: /private",
    ],
    ["a lowercase token", "user-agent: chatgpt-user\nDisallow: /"],
    ["a versioned token", "User-agent: ChatGPT-User/1.0\nDisallow: /"],
  ])("passes with the OpenAI qualifier for %s", (_label, body) => {
    const result = audit.audit(robots(body));
    expect(result.status).toBe(CheckStatus.Pass);
    expect(result.message).toContain("User-agent: ChatGPT-User");
    expect(result.message).toContain("may not apply");
    expect(result.message).toContain("OAI-SearchBot");
  });

  // Access through the catch-all is the business of the other per-bot
  // audits. This one speaks only about a group the owner wrote.
  it.each([
    ["an open catch-all", "User-agent: *\nAllow: /"],
    ["a blocking catch-all", "User-agent: *\nDisallow: /"],
    ["a group for another crawler", "User-agent: SomeOtherBot\nDisallow: /"],
  ])("is not applicable for %s", (_label, body) => {
    expect(audit.audit(robots(body)).status).toBe(CheckStatus.NotApplicable);
  });

  it("is not applicable without a robots.txt", () => {
    expect(audit.audit(robots("Not found", 404)).status).toBe(
      CheckStatus.NotApplicable,
    );
    expect(audit.audit(mockCheckContext([], {})).status).toBe(
      CheckStatus.NotApplicable,
    );
  });

  it("is not applicable on a scan that read nothing", async () => {
    await expectNotApplicableOnEmpty(audit);
  });

  it("is an informative grade-C audit with an unconsumed notice", () => {
    const { meta } = ChatgptUserAudit;
    expect(meta.tier).toBe(AuditTier.Informative);
    expect(meta.evidenceGrade).toBe(EvidenceGrade.C);
    expect(meta.weight).toBe(
      weightForGrade(EvidenceGrade.C, AuditTier.Informative),
    );
    expect(meta.scoreDisplayMode).toBe(ScoreDisplayMode.Informative);
    expect(meta.deprecated?.kind).toBe(NoticeKind.Unconsumed);
    expect(meta.deprecated?.link).toBe(
      "https://developers.openai.com/api/docs/bots",
    );
    expect(AuditMetaSchema.safeParse(meta).success).toBe(true);
  });
});
