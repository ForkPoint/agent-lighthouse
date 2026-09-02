import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import { weightForGrade } from "../../scorer";
import type { CheckContext } from "../../check-context";

/** Coerce an unknown JSON value to a string; non-strings → ''. */
function asString(val: unknown): string {
  return typeof val === "string" ? val : "";
}

/**
 * Walk all JSON-LD blocks (including @graph arrays) and return every
 * object whose @type matches at least one of the given types.
 */
function findJsonLdByType(
  jsonLd: object[],
  types: string[],
): Record<string, unknown>[] {
  const results: Record<string, unknown>[] = [];
  const lowerTypes = new Set(types.map((t) => t.toLowerCase()));

  function walk(obj: unknown): void {
    if (!obj || typeof obj !== "object") return;

    if (Array.isArray(obj)) {
      for (const item of obj) walk(item);
      return;
    }

    const record = obj as Record<string, unknown>;

    const objType = record["@type"];
    if (objType) {
      const typeArr = Array.isArray(objType) ? objType : [objType];
      for (const t of typeArr) {
        if (typeof t === "string" && lowerTypes.has(t.toLowerCase())) {
          results.push(record);
        }
      }
    }

    // Recurse into @graph
    if (record["@graph"] && Array.isArray(record["@graph"])) {
      for (const item of record["@graph"]) walk(item);
    }
  }

  for (const block of jsonLd) walk(block);
  return results;
}

const GENERIC_AUTHOR_NAMES = new Set([
  "staff",
  "admin",
  "administrator",
  "team",
  "editor",
  "guest",
  "contributor",
  "unknown",
  "author",
  "webmaster",
]);

export class NamedAuthorAudit extends Audit {
  static override meta: AuditMeta = {
    id: "answer-readiness/named-author",
    category: "answer-readiness",
    title: "Named author attribution",
    failureTitle: "Named author attribution",
    description:
      'AI systems assign higher confidence to content from named experts. Generic authors like "Staff" or "Admin" reduce trust scoring because agents cannot verify expertise.',
    scoreDisplayMode: "informative",
    weight: weightForGrade("C", "informative"),
    evidenceGrade: "C",
    tier: "informative",
    dossier: "docs/evidence/audits/answer-readiness/named-author.md",
    requires: [
      "origin-reachable",
      "unblocked-fetches",
      "rendered-body",
      "sample-adequate",
    ],
    applicablePageTypes: ["content"],
    defaultPriority: "high",
    guidance: {
      impact:
        'AI systems assign higher confidence to content from named experts. Generic authors like "Staff" or "Admin" reduce trust scoring because agents cannot verify expertise, causing your content to rank lower in AI-generated recommendations.',
      fix: "Replace generic author names with real person names in your JSON-LD author property, meta author tag, and visible byline. Include a jobTitle for additional authority.",
      code: '"author": {\n  "@type": "Person",\n  "name": "Jane Smith",\n  "jobTitle": "Senior Engineer"\n}',
      effort: "easy",
      tags: ["trust", "e-e-a-t", "json-ld", "generative-engine"],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const page = ctx.pages[0];
    if (!page) {
      return this.fail(
        "No pages scanned.",
        'JSON-LD author or visible byline with a named person (not "Staff", "Admin", "Team")',
        "No pages scanned",
        {
          priority: "high",
          description:
            'AI systems assign higher confidence to content from named experts. Generic authors like "Staff" or "Admin" reduce trust scoring because agents cannot verify expertise.',
          code: '"author": { "@type": "Person", "name": "Jane Smith" }',
        },
      );
    }

    // Check JSON-LD author across all pages
    for (const p of ctx.pages) {
      const articles = findJsonLdByType(p.jsonLd, [
        "Article",
        "BlogPosting",
        "NewsArticle",
        "WebPage",
        "TechArticle",
      ]);

      for (const article of articles) {
        const author = article["author"] as
          | Record<string, unknown>
          | Record<string, unknown>[]
          | string
          | undefined;
        if (!author) continue;

        const authors = Array.isArray(author) ? author : [author];
        for (const a of authors) {
          const name =
            typeof a === "string"
              ? a
              : typeof a === "object" && a !== null
                ? asString((a as Record<string, unknown>)["name"])
                : "";
          const lower = name.trim().toLowerCase();
          if (lower && !GENERIC_AUTHOR_NAMES.has(lower)) {
            return this.pass(
              `Named author found in JSON-LD: "${name.trim()}".`,
              'JSON-LD author or visible byline with a named person (not "Staff", "Admin", "Team")',
              name.trim(),
              p.url,
            );
          }
        }
      }
    }

    // Check meta author tag
    for (const p of ctx.pages) {
      const metaAuthor = (p.meta?.["author"] ?? "").trim();
      if (metaAuthor && !GENERIC_AUTHOR_NAMES.has(metaAuthor.toLowerCase())) {
        return this.pass(
          `Named author found in meta tag: "${metaAuthor}".`,
          'JSON-LD author or visible byline with a named person (not "Staff", "Admin", "Team")',
          metaAuthor,
          p.url,
        );
      }
    }

    // Check visible byline patterns
    for (const p of ctx.pages) {
      const $ = p.$;
      const bylineEl =
        $('[class*="author"]').first().text().trim() ||
        $('[class*="byline"]').first().text().trim() ||
        $('[rel="author"]').first().text().trim();
      if (bylineEl && !GENERIC_AUTHOR_NAMES.has(bylineEl.toLowerCase())) {
        return this.pass(
          `Named author found in visible byline: "${bylineEl}".`,
          'JSON-LD author or visible byline with a named person (not "Staff", "Admin", "Team")',
          bylineEl,
          p.url,
        );
      }
    }

    return this.fail(
      "No named author attribution found on any scanned page.",
      'JSON-LD author or visible byline with a named person (not "Staff", "Admin", "Team")',
      "Not found",
      {
        priority: "high",
        description:
          'AI systems assign higher confidence to content from named experts. Generic authors like "Staff" or "Admin" reduce trust scoring because agents cannot verify expertise. A named person with verifiable credentials lets AI RAG systems cross-reference the author across platforms for authority validation.',
        code: '"author": { "@type": "Person", "name": "Jane Smith", "jobTitle": "Senior Engineer" }',
      },
      page.url,
    );
  }
}
