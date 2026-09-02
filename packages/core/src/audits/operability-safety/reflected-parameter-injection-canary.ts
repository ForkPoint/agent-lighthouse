import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import type { CheckContext } from "../../check-context";
import type { FetchResult } from "../../fetcher";

import { probeSecurityUrl } from "../../gatherers/security";
import { parseHtml, extractJsonLd, allJsonLdNodes } from "../../parser";
import { weightForGrade } from "../../scorer";

/**
 * The probe budget, as a hard cap rather than an average.
 *
 * Five read-only GETs is enough to cover the parameter names a search or
 * tracking template actually reads back. Anything beyond that stops being a
 * detection and starts being traffic the site owner did not ask for.
 */
const PROBE_PARAMS = ["q", "s", "utm_source"] as const;

/** Where the canary carries angle brackets, so escaping can be measured. */
const BRACKET_MARKER = "ignore-previous-instructions";

/** The bracketed marker as it looks once a template escapes it. */
const ESCAPED_MARKER = `&lt;${BRACKET_MARKER}&gt;`;

/** The bracketed marker as it looks when it survives raw. */
const RAW_MARKER = `<${BRACKET_MARKER}>`;

/** Where a reflection was found, in the order an answer engine trusts them. */
type Sink =
  "title" | "meta description" | "canonical link" | "JSON-LD" | "rendered text";

/** The four sinks lifted verbatim into an AI answer. Reflection there fails. */
const HIGH_TRUST: readonly Sink[] = [
  "title",
  "meta description",
  "canonical link",
  "JSON-LD",
];

/**
 * A detection token that is unique per scan and impossible to hit by accident.
 *
 * Random rather than fixed so a site that once cached a probe response cannot
 * make a later scan report a reflection it did not produce.
 */
function mintCanary(): string {
  let token = "AGLH";
  for (let i = 0; i < 8; i += 1)
    token += Math.floor(Math.random() * 16).toString(16);
  return token;
}

/** Does this response carry a noindex directive, by header or by meta tag? */
function isNoindex(result: FetchResult, html: string): boolean {
  const header = result.headers["x-robots-tag"] ?? "";
  if (/noindex/i.test(header)) return true;
  const $ = parseHtml(html);
  return $('meta[name="robots"], meta[name="googlebot"]')
    .toArray()
    .some((el) => {
      return /noindex/i.test(el.attribs?.["content"] ?? "");
    });
}

/** Every string value anywhere inside the page's JSON-LD blocks. */
function jsonLdStrings(html: string): string[] {
  const nodes = allJsonLdNodes(extractJsonLd(parseHtml(html)));
  const out: string[] = [];
  const walk = (value: unknown): void => {
    if (typeof value === "string") out.push(value);
    else if (Array.isArray(value)) value.forEach(walk);
    else if (value && typeof value === "object")
      Object.values(value).forEach(walk);
  };
  nodes.forEach(walk);
  return out;
}

/** Which sinks of one response echoed the canary back. */
function sinksFor(html: string, canary: string): Sink[] {
  const $ = parseHtml(html);
  const found: Sink[] = [];

  if ($("title").text().includes(canary)) found.push("title");

  const metaDescription = $(
    'meta[name="description"], meta[property="og:description"]',
  )
    .toArray()
    .map((el) => el.attribs?.["content"] ?? "")
    .join(" ");
  if (metaDescription.includes(canary)) found.push("meta description");

  if (($('link[rel="canonical"]').attr("href") ?? "").includes(canary)) {
    found.push("canonical link");
  }

  if (jsonLdStrings(html).some((value) => value.includes(canary)))
    found.push("JSON-LD");

  // Script and style hold code, not prose an agent reads back as content.
  const body = $("body").clone();
  body.find("script, style, noscript, title").remove();
  if (body.text().includes(canary)) found.push("rendered text");

  return found;
}

export class ReflectedParameterInjectionCanaryAudit extends Audit {
  static override meta: AuditMeta = {
    id: "operability-safety/reflected-parameter-injection-canary",
    category: "operability-safety",
    title: "Reflected-Parameter Injection Canary",
    failureTitle:
      "URL input is reflected into fields agents read as the page speaking",
    description:
      "Sends at most five read-only GET probes carrying a random per-scan token, then reports whether the site echoes that token back into its title, meta description, canonical link, JSON-LD, or rendered text — the fields an answer engine lifts verbatim, which would let any third party mint a URL on this domain that shows a visiting agent arbitrary text.",
    scoreDisplayMode: "ternary",
    tier: "scored",
    evidenceGrade: "B",
    weight: weightForGrade("B", "scored"),
    defaultPriority: "critical",
    dossier:
      "docs/evidence/audits/operability-safety/reflected-parameter-injection-canary.md",
    requires: [
      "origin-reachable",
      "unblocked-fetches",
      "rendered-body",
      "sample-adequate",
    ],
    guidance: {
      impact:
        "Agents and answer engines weight a source by domain authority, and a reflected-input URL passes human inspection because the hostname is genuine. If attacker-controlled query or path input lands in the page's own title, meta description, canonical link, or JSON-LD strings, the domain becomes a self-serve injection host: the attacker does not need to compromise anything, only to share a link. Reflection into rendered text is the same defect one step down, and it is only contained while the page stays out of an index.",
      fix: 'Escape URL-derived input before it reaches any template, and keep it out of `<title>`, `<meta name="description">`, `og:description`, `rel="canonical"` and JSON-LD entirely — those fields should describe the page, not the request. Where a search page must echo the query back to the visitor, render it as escaped text inside the body and mark the page `noindex`.',
      code: `<!-- Reflected into the fields an answer engine quotes -->
<title>Results for {{ query }}</title>
<link rel="canonical" href="/search?q={{ query }}">

<!-- Fixed: a fixed title, a self-referential canonical, escaped body echo -->
<title>Search results</title>
<link rel="canonical" href="/search">
<meta name="robots" content="noindex">
<p>Results for <span>{{ query | escape }}</span></p>`,
      effort: "moderate",
      docsUrl:
        "https://forkpoint.github.io/agent-lighthouse/audits/operability-safety/reflected-parameter-injection-canary/",
      tags: ["injection-safety", "security", "agent-trust"],
    },
  };

  async audit(ctx: CheckContext): Promise<AuditResult> {
    if (ctx.pages.length === 0) {
      return this.notApplicable(
        "No page was fetched, so no probe origin could be established.",
        "At least one fetched page",
        "None",
      );
    }

    const primary = ctx.pages[0];
    if (!primary || primary.$("body").text().trim().length === 0) {
      return this.notApplicable(
        "The primary page rendered no text content, so input reflection cannot be evaluated.",
        "A page with rendered text content",
        "0 rendered characters",
      );
    }

    const canary = mintCanary();
    // The instruction-shaped variant exists so the audit can tell a raw
    // reflection from an escaped one. It is a detection string: the site is
    // asked to echo it, and nothing acts on it.
    const payload = `${canary} ${RAW_MARKER}`;
    const origin = new URL(ctx.baseUrl).origin;

    const probes = [
      ...PROBE_PARAMS.map(
        (param) => `${origin}/?${param}=${encodeURIComponent(payload)}`,
      ),
      `${origin}/search?q=${encodeURIComponent(payload)}`,
      `${origin}/${encodeURIComponent(canary)}`,
    ];

    const reflections = new Map<Sink, string>();
    let reachable = 0;
    let raw = false;
    let escaped = false;
    let indexableReflection = false;

    for (const url of probes) {
      // Read-only GET, same origin, SSRF-gated like every other outbound fetch.
      const result = await probeSecurityUrl(ctx, url, { method: "GET" });
      if (!result || result.status < 200) continue;
      reachable += 1;

      const html = result.body;
      const sinks = sinksFor(html, canary);
      if (sinks.length === 0) continue;

      if (html.includes(RAW_MARKER)) raw = true;
      if (html.includes(ESCAPED_MARKER)) escaped = true;
      if (!isNoindex(result, html)) indexableReflection = true;
      for (const sink of sinks)
        if (!reflections.has(sink)) reflections.set(sink, url);
    }

    if (reachable === 0) {
      return this.notApplicable(
        "No probe reached the site, so reflection could not be measured.",
        `Up to ${probes.length} probe responses`,
        "No probe connected",
      );
    }

    const escaping = raw
      ? "the canary came back raw and its angle brackets survived"
      : escaped
        ? "the canary came back HTML-escaped and its angle brackets did not survive"
        : "no angle bracket from the canary reached the response";
    const sinkList = [...reflections.keys()];
    const expected =
      "No probe token reflected into title, meta, canonical, JSON-LD or page text";

    if (sinkList.length === 0) {
      return {
        ...this.pass(
          `${reachable} probe responses echoed none of the canary back.`,
          expected,
          `No reflection across ${reachable} probes; ${escaping}`,
        ),
        details: {
          probes: reachable,
          sinks: [],
          raw,
          indexable: indexableReflection,
        },
      };
    }

    const highTrust = sinkList.filter((sink) => HIGH_TRUST.includes(sink));
    const found = `Reflected into ${sinkList.join(", ")} across ${reachable} probes; ${escaping}`;
    const details = {
      probes: reachable,
      sinks: sinkList,
      raw,
      indexable: indexableReflection,
      example: reflections.get(sinkList[0] as Sink) ?? "",
    };

    if (highTrust.length > 0) {
      return {
        ...this.fail(
          `URL input is reflected into ${highTrust.join(", ")} — fields an answer engine quotes as the page's own words.`,
          expected,
          found,
          "Keep URL-derived input out of the title, meta description, canonical link and JSON-LD, and escape it everywhere else.",
        ),
        details,
      };
    }

    // Rendered text only. Contained while the page stays out of an index;
    // an indexable page that renders arbitrary text is the same defect served
    // to every agent that finds it.
    if (indexableReflection) {
      return {
        ...this.fail(
          "URL input is reflected into the rendered text of an indexable page.",
          expected,
          found,
          "Escape the echoed query and mark the reflecting page `noindex`.",
        ),
        details,
      };
    }

    return {
      ...this.warn(
        "URL input is reflected into rendered text, on a page marked noindex.",
        expected,
        found,
        "Escape the echoed query so markup cannot be injected, and keep the noindex directive in place.",
      ),
      details,
    };
  }
}
