import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import type { CheckContext } from "../../check-context";
import { weightForGrade } from "../../scorer";
import { pageRendersText } from "../../scan-evidence";

/**
 * Attach measurement details to a result the base helpers built.
 *
 * `pass`/`warn`/`fail` take no details argument, and `warn`/`fail` already use
 * that field for the fix snippet, so the two are merged rather than replaced.
 */
function withDetails(
  result: AuditResult,
  details: Record<string, string | number | boolean | string[]>,
): AuditResult {
  return { ...result, details: { ...(result.details ?? {}), ...details } };
}

export class ServerRenderedAudit extends Audit {
  static override meta: AuditMeta = {
    id: "content-extraction/server-rendered",
    category: "content-extraction",
    title: "Server-rendered content",
    failureTitle: "Server-rendered content",
    description:
      "AI crawlers like GPTBot and ClaudeBot do not execute JavaScript. Content only visible after JS execution is completely invisible to them, meaning your site effectively has no content in AI knowledge bases. Use SSR (server-side rendering) or SSG (static site generation) to serve content in the initial HTML response.",
    scoreDisplayMode: "ternary",
    weight: weightForGrade("B", "scored"),
    evidenceGrade: "B",
    tier: "scored",
    dossier: "docs/evidence/audits/content-extraction/server-rendered.md",
    // Gate exemption: A shell is what this audit reports. Gating it would delete the finding.
    requires: ["origin-reachable", "unblocked-fetches"],
    defaultPriority: "critical",
    guidance: {
      impact:
        "AI crawlers (GPTBot, ClaudeBot, PerplexityBot) do not execute JavaScript. If your content is only rendered client-side, these crawlers see an empty or near-empty page. Your products, articles, and brand information are completely absent from AI knowledge bases, meaning AI-generated answers never reference your site.",
      fix: "Switch from client-side rendering to server-side rendering (SSR) or static site generation (SSG). Frameworks like Next.js, Nuxt, SvelteKit, and Astro all support SSR/SSG. Ensure your homepage and key landing pages return meaningful HTML content in the initial response.",
      code: "// Next.js App Router (server component by default):\nexport default async function Page() {\n  const data = await fetchProducts();\n  return <ProductList items={data} />;\n}\n\n// Or with getServerSideProps (Pages Router):\nexport async function getServerSideProps() {\n  const data = await fetchProducts();\n  return { props: { data } };\n}",
      effort: "complex",
      docsUrl: "https://web.dev/articles/rendering-on-the-web",
      tags: ["rendering", "ssr", "critical"],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const pages = ctx.pages ?? [];

    if (pages.length === 0) {
      return this.notApplicable(
        "The scan fetched no page, so there is no served HTML to judge.",
        "Every fetched page serves > 50 words or > 200 characters of readable text",
        "No page fetched",
      );
    }

    // The scan already decided this, per page, before any audit ran. Reading
    // its record keeps one rule in one place, and keeps the verdict tied to
    // what the fetch actually returned. A page the scan has no record for is
    // judged by the same shared rule.
    const rendered = ctx.evidence.renderedByPage;
    const emptyPages = pages
      .filter((page) => !(rendered[page.url] ?? pageRendersText(page)))
      .map((page) => page.url);

    const total = pages.length;
    const renderedCount = total - emptyPages.length;
    const expected =
      "Every fetched page serves > 50 words or > 200 characters of readable text";
    const found = `${renderedCount} of ${total} page(s) served readable text`;

    if (emptyPages.length === 0) {
      return withDetails(
        this.pass(
          `All ${total} fetched page(s) serve their content in the HTML response.`,
          expected,
          found,
          pages[0].url,
        ),
        { pagesChecked: total, renderedPages: renderedCount },
      );
    }

    const failGuidance = {
      priority: "critical" as const,
      description:
        "AI crawlers like GPTBot and ClaudeBot do not execute JavaScript. Content only visible after JS execution is completely invisible to them, meaning your site effectively has no content in AI knowledge bases. Use SSR (server-side rendering) or SSG (static site generation) to serve content in the initial HTML response.",
      code: "// Next.js SSR example:\nexport async function getServerSideProps() {\n  const data = await fetchData();\n  return { props: { data } };\n}",
    };

    if (renderedCount === 0) {
      return withDetails(
        this.fail(
          `None of the ${total} fetched page(s) serve readable content in the HTML response. AI agents cannot read client-side-only rendered content.`,
          expected,
          found,
          failGuidance,
          pages[0].url,
        ),
        { pagesChecked: total, renderedPages: 0, emptyPages },
      );
    }

    return withDetails(
      this.warn(
        `${emptyPages.length} of ${total} fetched page(s) serve no readable content in the HTML response. AI agents read nothing on those pages.`,
        expected,
        found,
        failGuidance,
        emptyPages[0],
      ),
      { pagesChecked: total, renderedPages: renderedCount, emptyPages },
    );
  }
}
