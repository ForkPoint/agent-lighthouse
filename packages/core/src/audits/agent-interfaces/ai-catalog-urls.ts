import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import { weightForGrade } from "../../scorer";
import type { CheckContext } from "../../check-context";
import { isSafeUrl } from "../../url-utils";
import { sharedProbeUrl } from "../../gatherers/discovery";
import { AI_CATALOG_PATH, entryLabel, readAiCatalog } from "./_ard";
import type { ArdEntry } from "./_ard";

/**
 * How many probes run at once.
 *
 * The pre-rewrite audit fired one unthrottled `Promise.all` per listed URL at
 * the site's own API, which on a large catalog is a burst load that can trip
 * the target's own rate limiting — and then be reported as the site's fault.
 */
const MAX_CONCURRENCY = 5;

/** How many broken URLs are named in the message before it is summarised. */
const MAX_LISTED = 3;

/**
 * A URL is *reachable* when something answers for it, not only when it answers
 * 200. Catalog entries point at MCP servers, agent cards and API descriptions:
 * an OAuth-protected endpoint answers 401, a POST-only endpoint answers 405 to
 * our GET, and both are correctly deployed. Demanding 200 reported healthy
 * catalogs as broken.
 */
const REACHABLE_NON_2XX = new Set([401, 403, 405, 429]);

function isReachable(status: number): boolean {
  if (status >= 200 && status < 400) return true;
  return REACHABLE_NON_2XX.has(status);
}

interface Probe {
  label: string;
  url: string;
  /** HTTP status, 0 for a transport failure, -1 when the URL was refused. */
  status: number;
}

function describeProbe(probe: Probe): string {
  const reason =
    probe.status === -1
      ? "refused"
      : probe.status === 0
        ? "unreachable"
        : `HTTP ${probe.status}`;
  return `${probe.label} (${reason})`;
}

/** Run `worker` over `items` with a bounded number of concurrent calls. */
async function pooled<T, R>(
  items: readonly T[],
  limit: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const runners = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      for (;;) {
        const index = next++;
        if (index >= items.length) return;
        results[index] = await worker(items[index]!);
      }
    },
  );
  await Promise.all(runners);
  return results;
}

const EXPECTED =
  "Every entries[].url in the AI catalog resolves to a live endpoint (2xx/3xx, or an auth-gated 401/403/405)";

const SAMPLE = `// /.well-known/ai-catalog.json — each entry links or embeds its artifact
{
  "specVersion": "1.0",
  "host": { "displayName": "Your Site" },
  "entries": [
    {
      "identifier": "urn:air:yoursite.com:server:search",
      "displayName": "Product Search",
      "type": "application/mcp-server-card+json",
      "url": "https://yoursite.com/mcp/search.json"
    },
    {
      "identifier": "urn:air:yoursite.com:skill:returns",
      "displayName": "Returns Policy Skill",
      "type": "text/markdown",
      "data": "# Returns\\nItems can be returned within 30 days."
    }
  ]
}`;

export class AiCatalogUrlsAudit extends Audit {
  static override meta: AuditMeta = {
    id: "agent-interfaces/ai-catalog-urls",
    category: "agent-interfaces",
    title: "AI Catalog entry URLs valid",
    failureTitle: "AI Catalog entry URLs valid",
    description:
      "Every AI catalog entry either embeds its artifact inline or points at one with a url. Consumers dereference those urls to load MCP server cards, agent cards and nested catalogs, so a dead url silently truncates a whole branch of discovery and breaks any agent that trusted the manifest.",
    scoreDisplayMode: "ternary",
    weight: weightForGrade("B", "scored"),
    evidenceGrade: "B",
    tier: "scored",
    dossier: "docs/evidence/audits/agent-interfaces/ai-catalog-urls.md",
    requires: ["origin-reachable"],
    defaultPriority: "medium",
    guidance: {
      impact:
        "A broken entry url makes an agent fail mid-task: it read your manifest, followed the link you published, and got nothing. Entries whose url points at a nested catalog or registry cut off everything behind them as well.",
      fix: "Check every entries[].url in your ai-catalog.json against your live deployment, use absolute HTTPS URLs, and remove or update stale entries. Entries that embed their artifact in `data` instead of `url` need no endpoint at all.",
      code: SAMPLE,
      effort: "trivial",
      docsUrl: "https://github.com/ards-project/ard-spec/blob/main/spec/ard.md",
      tags: ["ai-catalog", "validation", "agent-protocol", "ard"],
    },
  };

  private recommendation() {
    return {
      priority: "medium" as const,
      description: AiCatalogUrlsAudit.meta.description,
      code: SAMPLE,
    };
  }

  async audit(ctx: CheckContext): Promise<AuditResult> {
    const read = readAiCatalog(ctx);

    // Liveness check on a manifest ai-catalog-exists already scores: with no
    // ARD manifest there is nothing to dereference, and a second zero for the
    // same absence would penalize one missing file three times over.
    if (!read.ok) {
      return this.notApplicable(
        `No ARD manifest to traverse: ${AI_CATALOG_PATH} ${read.reason === "absent" ? "is not served" : "is not a valid ARD manifest"} — see the AI Catalog exists check.`,
        EXPECTED,
        read.found,
      );
    }

    const { entries } = read.manifest;
    // ARD §4.2: an entry carries exactly one of `url` or `data`. Inline
    // entries are fully conformant and have no endpoint to probe.
    const inline = entries.filter((e) => !e.url && e.hasData);
    const linked = entries.filter((e): e is ArdEntry & { url: string } =>
      Boolean(e.url),
    );

    if (linked.length === 0) {
      return this.notApplicable(
        inline.length > 0
          ? `All ${inline.length} catalog entr${inline.length === 1 ? "y embeds its" : "ies embed their"} artifact inline, so there is no url to dereference.`
          : "No catalog entry carries a url to dereference.",
        EXPECTED,
        `0 linked entries (${inline.length} inline)`,
      );
    }

    const probes = await pooled(
      linked,
      MAX_CONCURRENCY,
      async (entry): Promise<Probe> => {
        // Entry urls SHOULD be absolute; resolve relatives rather than scoring
        // them as unreachable, which is what the pre-rewrite audit did.
        let url: string;
        try {
          url = new URL(entry.url, ctx.baseUrl).href;
        } catch {
          return { label: entryLabel(entry), url: entry.url, status: -1 };
        }

        // The url comes out of a site-controlled file and we are about to fetch
        // it, which is SSRF-adjacent. Validate the target first.
        if (!(await isSafeUrl(url))) {
          return { label: entryLabel(entry), url, status: -1 };
        }

        const response = await sharedProbeUrl(ctx, url);
        return { label: entryLabel(entry), url, status: response?.status ?? 0 };
      },
    );

    const broken = probes.filter((p) => !isReachable(p.status));
    const live = probes.length - broken.length;
    const inlineNote =
      inline.length > 0
        ? `; ${inline.length} inline entr${inline.length === 1 ? "y" : "ies"} skipped`
        : "";
    const found = `${live}/${probes.length} entry urls reachable${inlineNote}`;

    if (broken.length === 0) {
      return this.pass(
        `All ${probes.length} catalog entry url(s) resolve to a live endpoint${
          inline.length > 0
            ? `; ${inline.length} inline entr${inline.length === 1 ? "y was" : "ies were"} skipped`
            : ""
        }.`,
        EXPECTED,
        found,
      );
    }

    const listed = broken.slice(0, MAX_LISTED).map(describeProbe).join(", ");
    const rest =
      broken.length > MAX_LISTED
        ? `, and ${broken.length - MAX_LISTED} more`
        : "";
    const refused = broken.some((p) => p.status === -1)
      ? ' Entries marked "refused" are not safe to probe (non-HTTP scheme, malformed URL, or a private address).'
      : "";

    if (live > 0) {
      return this.warn(
        `${broken.length} of ${probes.length} catalog entry urls do not resolve: ${listed}${rest}.${refused}`,
        EXPECTED,
        found,
        this.recommendation(),
      );
    }

    return this.fail(
      `None of the ${probes.length} catalog entry url(s) resolve: ${listed}${rest}.${refused}`,
      EXPECTED,
      found,
      this.recommendation(),
    );
  }
}
