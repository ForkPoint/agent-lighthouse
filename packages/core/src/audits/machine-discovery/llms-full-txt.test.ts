import { describe, it, expect } from "vitest";
import { defaultConfig } from "#core/audit-config";
import { planAudits } from "#core/audit-runner";
import { LlmsFullTxtAudit } from "./llms-full-txt";
import {
  attributableFixture,
  mockCheckContext,
  mockFetchResult,
  unreachedSiteContext,
} from "#core/__tests__/test-utils";
import { CheckStatus } from "#core/types";

describe("LlmsFullTxtAudit", () => {
  const audit = new LlmsFullTxtAudit();

  it("passes when llms-full.txt returns 200", () => {
    const ctx = mockCheckContext([], {
      "/llms-full.txt": mockFetchResult("# Site\n\nFull content", 200),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.Pass);
    expect(result.message).toContain("llms-full.txt exists");
  });

  it("fails when llms-full.txt returns 404", () => {
    const ctx = mockCheckContext([], {
      "/llms-full.txt": mockFetchResult("", 404),
    });
    const result = audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.found).toContain("HTTP 404");
  });

  it("fails when llms-full.txt was not fetched at all", () => {
    const ctx = mockCheckContext([], {});
    const result = audit.audit(ctx);
    expect(result.status).toBe(CheckStatus.Fail);
    expect(result.message).toContain("No llms-full.txt file found");
  });

  // The scan may hold a readable page that is not this site's — a broker's
  // parking page, a foreign interstitial. Attribution is the gate's decision,
  // and the runner has to honour it rather than run this audit anyway.
  it("declines when no response can be attributed to this site", async () => {
    const { pages, rootFiles } = attributableFixture();
    const instance = new LlmsFullTxtAudit();
    const reached = await instance.audit(mockCheckContext(pages, rootFiles));
    expect(reached.status, "the same input reached is judged").not.toBe(
      CheckStatus.NotApplicable,
    );

    const plan = planAudits(
      unreachedSiteContext(pages, rootFiles),
      defaultConfig,
    );
    expect(plan.runnable.map((entry) => entry.reg.meta.id)).not.toContain(
      LlmsFullTxtAudit.meta.id,
    );
    expect(
      plan.skipped.find((stub) => stub.id === LlmsFullTxtAudit.meta.id)?.status,
    ).toBe(CheckStatus.NotApplicable);
  });
});
