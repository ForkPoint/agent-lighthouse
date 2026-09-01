import { describe, it, expect } from "vitest";
import { LandmarkUniqueAudit } from "./landmark-unique";
import { mockCheckContext } from "../../__tests__/test-utils";
import { pageWithA11y, runA11yAudit } from "./_test-utils";
import { runA11yForHtml } from "./runner";

const doc = (body: string) =>
  `<!doctype html><html lang="en"><head><title>t</title></head><body>${body}</body></html>`;

/** Run the real rule engine for the one rule this audit wires. */
const landmarkRule = async (body: string) =>
  (
    await runA11yForHtml(doc(body), "https://example.com/", ["landmark-unique"])
  )["landmark-unique"];

describe("LandmarkUniqueAudit", () => {
  it("registers under the landmark-unique id with its dossier and grade", () => {
    expect(LandmarkUniqueAudit.meta.id).toBe(
      "operability-safety/landmark-unique",
    );
    expect(LandmarkUniqueAudit.meta.dossier).toBe(
      "docs/evidence/audits/operability-safety/landmark-unique.md",
    );
    expect(LandmarkUniqueAudit.meta.evidenceGrade).toBe("A");
    expect(LandmarkUniqueAudit.meta.tier).toBe("scored");
  });

  it("wires exactly its a11y rule(s)", () => {
    const ctx = mockCheckContext([
      pageWithA11y("https://example.com/", {
        "landmark-unique": { status: "pass", nodes: [] },
      }),
    ]);
    const result = runA11yAudit(LandmarkUniqueAudit, ctx);
    expect(result.expected).toBe("accessibility rules pass: landmark-unique");
  });

  it("fails when the `landmark-unique` rule reports a violation", () => {
    const ctx = mockCheckContext([
      pageWithA11y("https://example.com/", {
        "landmark-unique": {
          status: "fail",
          nodes: [{ target: "#offender", summary: "violation" }],
        },
      }),
    ]);
    const result = runA11yAudit(LandmarkUniqueAudit, ctx);
    expect(result.status).toBe("fail");
    expect(result.found).toContain("#offender");
  });

  it("passes when every constituent rule passes", () => {
    const ctx = mockCheckContext([
      pageWithA11y("https://example.com/", {
        "landmark-unique": { status: "pass", nodes: [] },
      }),
    ]);
    expect(runA11yAudit(LandmarkUniqueAudit, ctx).status).toBe("pass");
  });

  it("is na when no constituent rule applies", () => {
    const ctx = mockCheckContext([
      pageWithA11y("https://example.com/", {
        "landmark-unique": { status: "inapplicable", nodes: [] },
      }),
    ]);
    expect(runA11yAudit(LandmarkUniqueAudit, ctx).status).toBe("na");
  });

  // Absorbed from 7.3 (nav-aria-label): the nav-labelling signal is measured
  // here, by role + accessible name, over the real rule engine. These lock the
  // three behaviours 7.3's required fix asked for.
  describe("the absorbed <nav> signal (7.3)", () => {
    it("fails two <nav> landmarks that share the empty accessible name", async () => {
      const rule = await landmarkRule(
        '<nav><a href="/">a</a></nav><nav><a href="/b">b</a></nav>',
      );
      expect(rule?.status).toBe("fail");
      expect(rule?.nodes[0]?.target).toContain("nav");
    });

    it("passes two <nav> landmarks with distinct labels", async () => {
      const rule = await landmarkRule(
        '<nav aria-label="Primary"><a href="/">a</a></nav><nav aria-label="Footer"><a href="/b">b</a></nav>',
      );
      expect(rule?.status).toBe("pass");
    });

    it("does not punish a single unlabeled <nav> — nothing is ambiguous", async () => {
      const rule = await landmarkRule('<nav><a href="/">a</a></nav>');
      expect(rule?.status).toBe("pass");
    });

    it("resolves a name given through aria-labelledby", async () => {
      const rule = await landmarkRule(
        '<nav aria-labelledby="nav-h"><h2 id="nav-h">Primary</h2><a href="/">a</a></nav>' +
          '<nav aria-label="Footer"><a href="/b">b</a></nav>',
      );
      expect(rule?.status).toBe("pass");
    });

    it("covers landmark types beyond <nav>", async () => {
      const rule = await landmarkRule("<aside>a</aside><aside>b</aside>");
      expect(rule?.status).toBe("fail");
    });
  });
});
