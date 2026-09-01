import { describe, it, expect } from "vitest";
import { defaultConfig } from "../audit-config";
import { AuditResultSchema } from "../schemas";
import {
  mockCheckContext,
  mockFetchResult,
  mockPageContext,
} from "../__tests__/test-utils";
import { auditSources } from "./audit-sources";
import type { CheckContext } from "../check-context";

/**
 * Absent artifact, absent verdict.
 *
 * An audit about an artifact's *contents* has observed nothing about a site
 * that publishes no such artifact. It returns `notApplicable`; only a
 * present-and-defective artifact may `fail`. `CLAUDE.md` states the rule; this
 * suite holds the one family that broke it.
 *
 * `agent-interfaces/openapi-servers`, `openapi-endpoints`, `openapi-schemas`
 * and `openapi-operation-ids` each returned `fail` — the first two at
 * `priority: 'high'`, the other two at `'medium'` — on every site with no
 * OpenAPI document. 2.4 combined weight telling a bakery to add a `servers`
 * array to a spec it had never written.
 *
 * `openapi-description-quality` is held here too, though it never broke the
 * rule. It is the audit every dossier cites as proof that a *scored* audit may
 * decline, so leaving it out would let someone flip its branch to `fail` with
 * this suite still green.
 *
 * Registry-driven, and the marker is the import rather than a list: an audit
 * that reads `NO_OPENAPI_SPEC` from `gatherers/openapi.ts` has declared that
 * its verdict is about the document's contents, so it is held here. Adding a
 * sixth such audit enrols it automatically.
 *
 * Why only this family. The general rule needs to know which artifact each
 * audit is *about*, and no syntactic test answers that:
 * `agent-interfaces/search-endpoint` and `operability-safety/contact-form`
 * both read the same document, and both are right to keep judging a site that
 * publishes none — they have other evidence. The shared precondition constant
 * is the closest thing to a declaration, so a family pins its own instance by
 * exporting one and importing it. The next artifact to adopt the pattern
 * copies this block.
 */

const registrations = Object.values(defaultConfig.audits).flat();
const sources = auditSources();

/** Audits that declared themselves to be about the OpenAPI document's contents. */
const openApiContentAudits = registrations.filter((r) =>
  (sources.get(r.meta.id) ?? "").includes("NO_OPENAPI_SPEC"),
);

/**
 * A site that answers everything it is asked for and publishes no OpenAPI
 * document. Not an empty scan: a page arrived, `robots.txt` arrived, and the
 * only thing missing is the artifact. That isolates the absence from every
 * other reason an audit might decline.
 */
function siteWithoutASpec(
  overrides: Record<string, ReturnType<typeof mockFetchResult>> = {},
): CheckContext {
  return mockCheckContext(
    [
      mockPageContext(
        "https://example.com/",
        '<html lang="en"><body><h1>Bakery</h1></body></html>',
      ),
    ],
    {
      "/robots.txt": mockFetchResult("User-agent: *\nAllow: /", 200),
      ...overrides,
    },
  );
}

describe("absent artifact, absent verdict — the OpenAPI document", () => {
  it("finds the audits that read the shared precondition", () => {
    expect(openApiContentAudits.map((r) => r.meta.id).sort()).toEqual([
      "agent-interfaces/openapi-description-quality",
      "agent-interfaces/openapi-endpoints",
      "agent-interfaces/openapi-operation-ids",
      "agent-interfaces/openapi-schemas",
      "agent-interfaces/openapi-servers",
    ]);
  });

  const states: Array<[string, CheckContext]> = [
    ["no /openapi.json was fetched at all", siteWithoutASpec()],
    [
      "/openapi.json answers 404",
      siteWithoutASpec({ "/openapi.json": mockFetchResult("", 404) }),
    ],
    [
      "/openapi.json answers 200 with an unreadable body",
      siteWithoutASpec({
        "/openapi.json": mockFetchResult("<!doctype html><p>Docs</p>", 200),
      }),
    ],
  ];

  for (const registration of openApiContentAudits) {
    const { id } = registration.meta;

    it(`${id}: declines a site that publishes no OpenAPI document`, async () => {
      for (const [label, ctx] of states) {
        const result = await registration.create().audit(ctx);
        expect(AuditResultSchema.safeParse(result).success).toBe(true);
        expect(
          result.status,
          `${label}: reported "${result.status}" about a document the site never published — ` +
            `"${result.message}". Absence is notApplicable; only a present-and-defective ` +
            `document may fail.`,
        ).toBe("na");
      }
    });
  }
});

/** Audits that declared themselves to be about the sitemap's contents. */
const sitemapContentAudits = registrations.filter((r) =>
  (sources.get(r.meta.id) ?? "").includes("NO_SITEMAP"),
);

function siteWithoutASitemap(): CheckContext {
  return mockCheckContext(
    [
      mockPageContext(
        "https://example.com/",
        '<html lang="en"><body><h1>Bakery</h1></body></html>',
      ),
    ],
    { "/robots.txt": mockFetchResult("User-agent: *\nAllow: /", 200) },
  );
}

describe("absent artifact, absent verdict — the sitemap", () => {
  it("finds the audits that read the shared sitemap precondition", () => {
    expect(sitemapContentAudits.map((r) => r.meta.id).sort()).toEqual([
      "machine-discovery/sitemap-absolute-urls",
      "machine-discovery/sitemap-lastmod",
    ]);
  });

  for (const registration of sitemapContentAudits) {
    const { id } = registration.meta;

    it(`${id}: declines a site that publishes no sitemap`, async () => {
      const ctx = siteWithoutASitemap();
      const result = await registration.create().audit(ctx);
      expect(AuditResultSchema.safeParse(result).success).toBe(true);
      expect(
        result.status,
        `${id}: reported "${result.status}" about a sitemap the site never published — ` +
          `"${result.message}". Absence is notApplicable; only a present-and-defective ` +
          `sitemap may fail.`,
      ).toBe("na");
    });
  }
});
