// Graduated from proposal 2026-08-22 (Plan 5, Task 13).
// Evidence dossier: docs/evidence/audits/content-extraction/hydration-payload-share.md
//
// Scope note: `content-extraction/token-ratio` measures the whole markup-to-text
// ratio of a page. This audit isolates one named component of that ratio —
// serialized framework state — because it is the component with a targeted fix
// and a vendor-published size ceiling.
import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import { weightForGrade } from "../../scorer";
import type { CheckContext, PageContext } from "../../check-context";
import { getMainContentText } from "../../parser";

/** The repo-wide rough token estimator; no tokenizer dependency is carried. */
const CHARS_PER_TOKEN = 4;
/** Next.js flags a single serialized payload above this size as a defect. */
const SINGLE_PAYLOAD_BYTES = 128_000;
/** Total state above this share of the document fails. */
const SHARE_FAIL = 0.3;
/** Total state above this share of the document warns. */
const SHARE_WARN = 0.15;
/** Above this fraction of repeated main-content shingles, the body ships twice. */
const DUPLICATION_FAIL = 0.5;
/** Word count of a shingle used for the duplication comparison. */
const SHINGLE_N = 5;
/** How much of one payload to scan for repeated strings. */
const MAX_SCAN_CHARS = 512 * 1024;

/** Framework state globals, matched on the assignment rather than a mention. */
const GLOBALS: ReadonlyArray<{ name: string; pattern: RegExp }> = [
  { name: "window.__NUXT__", pattern: /__NUXT__\s*=/ },
  { name: "window.__APOLLO_STATE__", pattern: /__APOLLO_STATE__\s*=/ },
  { name: "__remixContext", pattern: /__remixContext\s*=/ },
  { name: "window.__INITIAL_STATE__", pattern: /__INITIAL_STATE__\s*=/ },
  { name: "window.__NEXT_REDUX_STATE__", pattern: /__NEXT_REDUX_STATE__\s*=/ },
  {
    name: "window.__SVELTEKIT_DATA__",
    pattern: /__sveltekit_[\w]+\s*=|__SVELTEKIT_DATA__\s*=/,
  },
];

interface Payload {
  pageUrl: string;
  name: string;
  bytes: number;
  /** Every source chunk, kept for the duplication comparison. */
  source: string;
}

interface Survey {
  documentChars: number;
  payloads: Payload[];
  /** Fraction of main-content shingles that also appear inside the state. */
  duplication: number;
}

/** Five-word shingles, punctuation and case folded away. */
function shingles(text: string): Set<string> {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  const out = new Set<string>();
  for (let i = 0; i + SHINGLE_N <= words.length; i += 1) {
    out.add(words.slice(i, i + SHINGLE_N).join(" "));
  }
  return out;
}

/**
 * Every JSON string value in a payload, unescaped and stripped of markup.
 *
 * The duplication question is about the prose inside the state, not about the
 * keys and type metadata around it, so only string literals are read.
 */
function unescapedStrings(source: string): string {
  const parts: string[] = [];
  const re = /"((?:[^"\\]|\\.)*)"/g;
  let match: RegExpExecArray | null;
  const text = source.slice(0, MAX_SCAN_CHARS);
  while ((match = re.exec(text)) !== null) {
    const raw = match[1]!;
    try {
      parts.push(JSON.parse(`"${raw}"`) as string);
    } catch {
      parts.push(raw);
    }
  }
  return parts
    .join(" ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Add a chunk to the named payload, merging repeat frames of one stream. */
function record(
  into: Map<string, Payload>,
  pageUrl: string,
  name: string,
  source: string,
): void {
  const existing = into.get(name);
  if (existing) {
    existing.bytes += source.length;
    existing.source += ` ${source}`;
    return;
  }
  into.set(name, { pageUrl, name, bytes: source.length, source });
}

function collect(page: PageContext, into: Map<string, Payload>): void {
  const $ = page.$;

  $("script").each((_i, el) => {
    const $s = $(el);
    const source = $s.html() ?? "";
    if (!source.trim()) return;
    const id = $s.attr("id") ?? "";
    const type = ($s.attr("type") ?? "").toLowerCase();

    if (id === "__NEXT_DATA__") {
      record(into, page.url, "__NEXT_DATA__", source);
      return;
    }
    // The RSC flight stream arrives as many pushes; the cost is their sum.
    if (source.includes("self.__next_f.push(")) {
      record(into, page.url, "self.__next_f (RSC flight)", source);
      return;
    }
    const global = GLOBALS.find(({ pattern }) => pattern.test(source));
    if (global) {
      record(into, page.url, global.name, source);
      return;
    }
    if (type === "application/json" || type === "application/ld+json;island") {
      record(
        into,
        page.url,
        id
          ? `<script type="application/json" id="${id}">`
          : '<script type="application/json">',
        source,
      );
    }
  });

  // Astro serializes island props into an attribute rather than a script body.
  $("astro-island[props]").each((_i, el) => {
    record(into, page.url, "<astro-island props>", $(el).attr("props") ?? "");
  });
}

function survey(ctx: CheckContext): Survey {
  const byName = new Map<string, Payload>();
  let documentChars = 0;
  const mainShingles = new Set<string>();

  for (const page of ctx.pages) {
    documentChars += page.fetchResult.body?.length ?? 0;
    collect(page, byName);
    for (const shingle of shingles(getMainContentText(page.$)))
      mainShingles.add(shingle);
  }

  const payloads = [...byName.values()].sort((a, b) => b.bytes - a.bytes);
  const stateShingles = shingles(
    payloads.map((p) => unescapedStrings(p.source)).join(" "),
  );
  let repeated = 0;
  for (const shingle of mainShingles)
    if (stateShingles.has(shingle)) repeated += 1;

  return {
    documentChars,
    payloads,
    duplication: mainShingles.size === 0 ? 0 : repeated / mainShingles.size,
  };
}

const EXPECTED =
  "Serialized framework state stays under 128 kB per payload, under 30% of the document, and does not repeat the main content";

const SAMPLE = `// Ship identifiers, not the rendered body: the HTML already carries it.
export async function getServerSideProps() {
  const article = await getArticle(id);
  return { props: { id: article.id, title: article.title } }; // not article.body
}`;

export class HydrationPayloadShareAudit extends Audit {
  static override meta: AuditMeta = {
    id: "content-extraction/hydration-payload-share",
    category: "content-extraction",
    title: "Inlined hydration-state payload share",
    failureTitle: "Inlined hydration-state payload share",
    description:
      'Detect and size serialized framework state inlined in the HTML document: <script id="__NEXT_DATA__">, self.__next_f.push( flight chunks, window.__NUXT__, __remixContext, window.__APOLLO_STATE__, window.__INITIAL_STATE__, <script type="application/json"> islands, and Astro/Svelte island props. Three independent failure conditions: (1) any single state payload > 128 kB, (2) total state payload > 30% of document tokens, (3) state payload duplicates > 50% of the main-content text (content shipped twice in one response).',
    scoreDisplayMode: "ternary",
    weight: weightForGrade("A", "scored"),
    evidenceGrade: "A",
    tier: "scored",
    dossier:
      "docs/evidence/audits/content-extraction/hydration-payload-share.md",
    requires: [
      "origin-reachable",
      "unblocked-fetches",
      "rendered-body",
      "sample-adequate",
    ],
    defaultPriority: "medium",
    guidance: {
      impact:
        "These blobs are inlined into every HTML response by design, and the framework vendor itself flags > 128 kB as a defect. A browser parses them and throws them away after hydration; a non-rendering AI crawler cannot — it tokenizes the JSON verbatim, including escaped HTML, CDN image variants, GraphQL type metadata and the full body text a second time. The causal claim is falsifiable per page: strip these script nodes, re-tokenize, and the delta is the exact context cost that carries zero incremental information, since duplicate #3 is byte-identical content the agent already has.",
      fix: "Return identifiers and view-model fields from the server data function, not the rendered body — the HTML already carries the text. Move large lists behind a client fetch or a route segment, drop GraphQL cache normalization metadata from the serialized store, and keep image variant tables out of props. Where a framework inlines the payload unconditionally, split the route so the heavy data loads on interaction instead of on first paint.",
      code: SAMPLE,
      effort: "moderate",
      docsUrl:
        "https://forkpoint.github.io/agent-lighthouse/audits/content-extraction/hydration-payload-share/",
      tags: ["token-economics", "hydration", "framework", "duplication"],
    },
  };

  private recommendation() {
    return {
      priority: "medium" as const,
      description: HydrationPayloadShareAudit.meta.description,
      code: SAMPLE,
    };
  }

  audit(ctx: CheckContext): AuditResult {
    const s = survey(ctx);

    if (s.payloads.length === 0) {
      return this.notApplicable(
        "No inlined framework state on the scanned pages, so there is no hydration payload to size.",
        EXPECTED,
        "No inlined hydration state found",
      );
    }

    const totalBytes = s.payloads.reduce((sum, p) => sum + p.bytes, 0);
    const tokens = Math.round(totalBytes / CHARS_PER_TOKEN);
    const share = s.documentChars === 0 ? 0 : totalBytes / s.documentChars;
    const pct = `${(share * 100).toFixed(1)}%`;
    const worst = s.payloads[0]!;
    const named = s.payloads
      .slice(0, 4)
      .map((p) => `${p.name} ${(p.bytes / 1000).toFixed(1)} kB`)
      .join("; ");
    const found = `${s.payloads.length} state payload(s), ${tokens} est. tokens, ${pct} of the document (${named})`;

    const reasons: string[] = [];
    if (worst.bytes > SINGLE_PAYLOAD_BYTES) {
      reasons.push(
        `${worst.name} inlines ${(worst.bytes / 1000).toFixed(1)} kB of serialized state, over the 128 kB single-payload ceiling the framework vendor itself flags as a defect.`,
      );
    }
    if (share > SHARE_FAIL) {
      reasons.push(
        `Serialized state is ${pct} of the document (${tokens} est. tokens), over the 30% ceiling.`,
      );
    }
    if (s.duplication > DUPLICATION_FAIL) {
      reasons.push(
        `State payloads duplicate the visible body: ${(s.duplication * 100).toFixed(1)}% of the main-content 5-gram shingles also appear inside them, so the response ships that text twice.`,
      );
    }

    if (reasons.length > 0) {
      return this.fail(
        reasons.join(" "),
        EXPECTED,
        found,
        this.recommendation(),
        worst.pageUrl,
      );
    }

    if (share > SHARE_WARN) {
      return this.warn(
        `Serialized state is ${pct} of the document (${tokens} est. tokens) — under the 30% ceiling, but every crawler pays for it on every fetch. Largest: ${worst.name}.`,
        EXPECTED,
        found,
        this.recommendation(),
        worst.pageUrl,
      );
    }

    return this.pass(
      `Serialized state is ${pct} of the document (${tokens} est. tokens) and does not repeat the main content.`,
      EXPECTED,
      found,
      worst.pageUrl,
    );
  }
}
