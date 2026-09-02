import { describe, it, expect } from "vitest";
import { defaultConfig } from "../../audit-config";
import { planAudits } from "../../audit-runner";
import { AiprefContentUsageDeclarationValidityAudit } from "./aipref-content-usage-declaration-validity";
import {
  challengedSiteContext,
  mockCheckContext,
  mockPageContext,
  mockFetchResult,
} from "../../__tests__/test-utils";
import type { FetchResult } from "../../fetcher";
import { expectNotApplicableOnEmpty } from "../../tests/na-contract";
import type { CheckContext } from "../../check-context";

function site(
  robots?: string,
  headers: Record<string, string> = {},
): CheckContext {
  const page = mockPageContext(
    "https://example.com/",
    "<html><body><p>Hi.</p></body></html>",
  );
  Object.assign(page.fetchResult.headers, headers);
  const rootFiles: Record<string, FetchResult> = {};
  if (robots !== undefined)
    rootFiles["/robots.txt"] = mockFetchResult(robots, 200, "text/plain");
  return mockCheckContext([page], rootFiles);
}

describe("AiprefContentUsageDeclarationValidityAudit", () => {
  const audit = new AiprefContentUsageDeclarationValidityAudit();

  it("is notApplicable on an empty site", async () => {
    await expectNotApplicableOnEmpty(audit);
  });

  it("is notApplicable when nothing declares a preference", async () => {
    expect((await audit.audit(site("User-agent: *\nAllow: /\n"))).status).toBe(
      "na",
    );
  });

  it("collects declarations at file scope and inside a group", async () => {
    const result = await audit.audit(
      site(
        "Content-Usage: search=y\n\nUser-agent: GPTBot\nContent-Usage: train-ai=n\nAllow: /\n",
      ),
    );
    expect(result.status).toBe("pass");
    expect(result.details?.["declarations"]).toBe(2);
  });

  it("splits the leading path token before parsing the dictionary", async () => {
    const result = await audit.audit(
      site("User-agent: *\nAllow: /\nContent-Usage: /ai-ok/ train-ai=y\n"),
    );
    expect(result.status).toBe("pass");
    expect(result.details?.["declarations"]).toBe(1);
  });

  it("fails an unknown category token", async () => {
    const result = await audit.audit(
      site("User-agent: *\nAllow: /\nContent-Usage: ai-input=n\n"),
    );
    expect(result.status).toBe("fail");
    expect((result.details!["syntaxErrors"] as string[])[0]).toContain(
      "not an AIPREF category",
    );
  });

  // `yes` parses as a token, so only the vocabulary can catch it — and the
  // message has to say which directive it belongs to.
  it("fails a legacy Content-Signal value and names the syntax", async () => {
    const result = await audit.audit(
      site("User-agent: *\nAllow: /\nContent-Usage: train-ai=yes\n"),
    );
    expect(result.status).toBe("fail");
    expect((result.details!["syntaxErrors"] as string[])[0]).toContain(
      "legacy Content-Signal syntax",
    );
  });

  it("fails a declaration attached only to a disallowed path, naming the deciding rule", async () => {
    const result = await audit.audit(
      site(
        "User-agent: *\nDisallow: /private/\nContent-Usage: /private/ train-ai=y\n",
      ),
    );
    expect(result.status).toBe("fail");
    expect((result.details!["inertDeclarations"] as string[])[0]).toContain(
      '"disallow: /private/"',
    );
  });

  it("warns when a valid declaration sits beside an inert one", async () => {
    const result = await audit.audit(
      site(
        "User-agent: *\nDisallow: /private/\nContent-Usage: train-ai=n\nContent-Usage: /private/ search=y\n",
      ),
    );
    expect(result.status).toBe("warn");
    expect(result.details?.["inertDeclarations"]).toHaveLength(1);
  });

  it("fails when robots.txt and the response header disagree for the same path", async () => {
    const result = await audit.audit(
      site("User-agent: *\nAllow: /\nContent-Usage: train-ai=n\n", {
        "content-usage": "train-ai=y",
      }),
    );
    expect(result.status).toBe("fail");
    expect((result.details!["channelDisagreements"] as string[])[0]).toContain(
      "train-ai over /",
    );
  });

  it("warns when only the legacy Content-Signal directive is present", async () => {
    const result = await audit.audit(
      site("User-agent: *\nContent-Signal: ai-train=no\nAllow: /\n"),
    );
    expect(result.status).toBe("warn");
    expect(result.details?.["legacyContentSignalLines"]).toHaveLength(1);
    expect(result.remediation).toContain("Content-Usage: train-ai=n");
  });

  it("passes a valid, crawlable, consistent declaration", async () => {
    const result = await audit.audit(
      site("User-agent: *\nAllow: /\nContent-Usage: train-ai=n\n", {
        "content-usage": "train-ai=n",
      }),
    );
    expect(result.status).toBe("pass");
    expect(result.details?.["effectiveDeclarations"]).toBe(2);
  });

  // Finding 1 of the pre-merge review: a bot wall served at HTTP 200 through the
  // site's own edge carries the site's head fragment and its site-wide response
  // headers on a body the site did not write. `origin-reachable` is met there,
  // so the runner must not run this audit against the wall's declaration.
  it("declines a Content-Usage header a bot wall answering 200 attached", async () => {
    const reached = site(undefined, { "content-usage": "train-ai=n" });
    expect(
      (await audit.audit(reached)).status,
      "the same header reached is judged",
    ).toBe("pass");

    const challenged = challengedSiteContext(reached.pages, reached.rootFiles);
    const plan = planAudits(challenged, defaultConfig);
    expect(plan.runnable.map((entry) => entry.reg.meta.id)).not.toContain(
      AiprefContentUsageDeclarationValidityAudit.meta.id,
    );
    expect(
      plan.skipped.find(
        (stub) =>
          stub.id === AiprefContentUsageDeclarationValidityAudit.meta.id,
      )?.status,
    ).toBe("na");
  });

  it("is a scored grade B audit with an id inside the cap", () => {
    const { meta } = AiprefContentUsageDeclarationValidityAudit;
    expect(meta.evidenceGrade).toBe("B");
    expect(meta.tier).toBe("scored");
    expect(meta.weight).toBeCloseTo(0.6);
    expect(meta.id.length).toBeLessThanOrEqual(64);
  });
});
