import { describe, it, expect } from "vitest";
import { defaultConfig } from "../../audit-config";
import { planAudits } from "../../audit-runner";
import { UniqueMetaAudit } from "./unique-meta";
import {
  attributableFixture,
  mockCheckContext,
  mockPageContext,
  unreachedSiteContext,
} from "../../__tests__/test-utils";

const doc = (title: string, desc: string) =>
  `<html lang="en"><head><title>${title}</title><meta name="description" content="${desc}"></head><body></body></html>`;

describe("UniqueMetaAudit", () => {
  const audit = new UniqueMetaAudit();

  it("passes when all pages have unique title + description", () => {
    const ctx = mockCheckContext([
      mockPageContext(
        "https://example.com/a",
        doc("Page A", "Description A"),
        0,
      ),
      mockPageContext(
        "https://example.com/b",
        doc("Page B", "Description B"),
        1,
      ),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe("pass");
    expect(result.message).toContain("unique");
  });

  it("fails when two pages share title + description", () => {
    const ctx = mockCheckContext([
      mockPageContext(
        "https://example.com/a",
        doc("Same Title", "Same desc"),
        0,
      ),
      mockPageContext(
        "https://example.com/b",
        doc("Same Title", "Same desc"),
        1,
      ),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe("fail");
    expect(result.message).toContain("Duplicate");
  });

  // Uniqueness needs two pages to compare. With one there is no verdict, which
  // is what this branch always said in words while scoring a pass — and a scan
  // of a JS shell, whose links never render, routinely lands here.
  it("is not applicable when fewer than 2 pages are scanned", () => {
    const ctx = mockCheckContext([
      mockPageContext("https://example.com/a", doc("A", "a")),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe("na");
    expect(result.message).toContain("not applicable");
  });

  it("is not applicable when there are no pages", () => {
    const result = audit.audit(mockCheckContext([]));
    expect(result.status).toBe("na");
  });

  it('uses meta[name="title"] as the title source when no <title> element exists', () => {
    const pageA = `<html lang="en"><head><meta name="title" content="Meta Title A"><meta name="description" content="Desc A"></head><body></body></html>`;
    const pageB = `<html lang="en"><head><meta name="title" content="Meta Title B"><meta name="description" content="Desc B"></head><body></body></html>`;
    const ctx = mockCheckContext([
      mockPageContext("https://example.com/a", pageA, 0),
      mockPageContext("https://example.com/b", pageB, 1),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe("pass");
    expect(result.message).toContain("unique");
  });

  it("passes when pages have unique titles but no descriptions", () => {
    const pageA = `<html lang="en"><head><title>Page A</title></head><body></body></html>`;
    const pageB = `<html lang="en"><head><title>Page B</title></head><body></body></html>`;
    const ctx = mockCheckContext([
      mockPageContext("https://example.com/a", pageA, 0),
      mockPageContext("https://example.com/b", pageB, 1),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe("pass");
  });

  it("fails when pages share the same title and both lack descriptions", () => {
    const page = `<html lang="en"><head><title>Same Title</title></head><body></body></html>`;
    const ctx = mockCheckContext([
      mockPageContext("https://example.com/a", page, 0),
      mockPageContext("https://example.com/b", page, 1),
    ]);
    const result = audit.audit(ctx);
    expect(result.status).toBe("fail");
    expect(result.message).toContain("Duplicate");
  });

  // The scan may hold a readable page that is not this site's — a broker's
  // parking page, a foreign interstitial. Attribution is the gate's decision,
  // and the runner has to honour it rather than run this audit anyway.
  it("declines when no response can be attributed to this site", async () => {
    const { pages, rootFiles } = attributableFixture();
    // Two distinct pages, or the single-page branch answers `na` for its own
    // reason and the control below proves nothing.
    const second = mockPageContext(
      "https://example.com/widgets/other",
      doc("Other", "Other."),
      1,
    );
    const instance = new UniqueMetaAudit();
    const reached = await instance.audit(
      mockCheckContext([...pages, second], rootFiles),
    );
    expect(reached.status, "the same input reached is judged").not.toBe("na");

    const plan = planAudits(
      unreachedSiteContext([...pages, second], rootFiles),
      defaultConfig,
    );
    expect(plan.runnable.map((entry) => entry.reg.meta.id)).not.toContain(
      UniqueMetaAudit.meta.id,
    );
    expect(
      plan.skipped.find((stub) => stub.id === UniqueMetaAudit.meta.id)?.status,
    ).toBe("na");
  });
});
