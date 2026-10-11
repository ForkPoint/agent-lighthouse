import { describe, it, expect } from "vitest";
import { filterAudits, type SearchableAudit } from "./audit-explorer";
import { AuditTier } from "@forkpoint/agent-lighthouse-core";

/**
 * `filterAudits` takes what a card can tell the explorer about itself: its id,
 * its two facets, and the text it matches on. The haystack here is built the
 * way `mountExplorer` builds it from a card — card text plus tags, lowercased.
 */
const record = (
  over: Partial<SearchableAudit> & { id: string },
): SearchableAudit => ({
  category: over.id.split("/")[0]!,
  tier: AuditTier.Scored,
  haystack: "",
  ...over,
});

describe("filterAudits", () => {
  const audits = [
    record({
      id: "agentic-commerce/offer-truth-consistency",
      haystack:
        "agentic-commerce/offer-truth-consistency offer truth consistency agentic commerce price",
    }),
    record({
      id: "access-crawl-control/robots-directives",
      tier: AuditTier.Informative,
      haystack:
        "access-crawl-control/robots-directives robots directives access & crawl control",
    }),
  ];

  it("matches on title, id and tag", () => {
    expect(
      filterAudits(audits, { text: "offer", category: "all", tier: "all" }),
    ).toHaveLength(1);
    expect(
      filterAudits(audits, {
        text: "robots-directives",
        category: "all",
        tier: "all",
      }),
    ).toHaveLength(1);
    expect(
      filterAudits(audits, { text: "price", category: "all", tier: "all" }),
    ).toHaveLength(1);
  });

  it("ignores the case and the surrounding whitespace of a query", () => {
    expect(
      filterAudits(audits, {
        text: "  ROBOTS  ",
        category: "all",
        tier: "all",
      }),
    ).toHaveLength(1);
  });

  it("filters by category and tier independently", () => {
    expect(
      filterAudits(audits, {
        text: "",
        category: "agentic-commerce",
        tier: "all",
      }),
    ).toHaveLength(1);
    expect(
      filterAudits(audits, {
        text: "",
        category: "all",
        tier: AuditTier.Informative,
      }),
    ).toHaveLength(1);
  });

  it("returns everything for an empty query", () => {
    expect(
      filterAudits(audits, { text: "", category: "all", tier: "all" }),
    ).toHaveLength(2);
  });
});
