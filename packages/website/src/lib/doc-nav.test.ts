import { describe, it, expect } from "vitest";
import { DOC_SECTIONS } from "./markdown-slice";
import { documentationNav } from "./doc-nav";

/**
 * The documentation sidebar.
 *
 * Both the docs route and the policy route render it, so an entry lost here
 * silently strands a published page with no link pointing at it.
 */

describe("documentationNav", () => {
  it("keeps every docs section reachable", () => {
    const nav = documentationNav();
    expect(
      nav
        .filter((e) => e.href.includes("/docs/"))
        .map((e) => e.label)
        .sort(),
    ).toEqual(DOC_SECTIONS.map((s) => s.title).sort());
  });

  it("puts first scans and results before sharing and developer references", () => {
    const nav = documentationNav();
    expect(nav.map((e) => e.href.replace("/agent-lighthouse/", ""))).toEqual([
      "docs/quickstart/",
      "docs/audit-architecture/",
      "docs/scoring/",
      "policy/",
      "sources/",
      "docs/share/",
      "docs/badge/",
      "docs/cli/",
      "docs/config/",
      "docs/sdk/",
      "docs/mcp/",
      "docs/ci/",
      "docs/benchmark/",
      "docs/architecture/",
    ]);
    expect([...new Set(nav.map((e) => e.group))]).toEqual([
      "Get started",
      "Understand your results",
      "Share your result",
      "Developer reference",
    ]);
  });

  it("prefixes every href with the site base path exactly once", () => {
    for (const entry of documentationNav()) {
      expect(entry.href, entry.label).toMatch(/^\/agent-lighthouse\/[^/].*\/$/);
      expect(
        entry.href.startsWith("/agent-lighthouse/agent-lighthouse/"),
        entry.label,
      ).toBe(false);
    }
  });

  it("labels every entry", () => {
    for (const entry of documentationNav()) {
      expect(entry.label).toBeTruthy();
    }
  });

  it("produces no duplicate destinations", () => {
    const hrefs = documentationNav().map((e) => e.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });
});
