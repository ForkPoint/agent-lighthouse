import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import type { CheckContext } from "../../check-context";
import { weightForGrade } from "../../scorer";
import {
  parseRobots,
  directiveLines,
  decidingRule,
  isPathAllowed,
} from "../../gatherers/robots";
import { parseDictionary } from "../../gatherers/structured-fields";

/**
 * The categories the AIPREF vocabulary draft defines.
 *
 * `ai-input` is deliberately absent: it is Cloudflare's Content-Signal
 * vocabulary, not AIPREF's, and accepting it in a `Content-Usage` line would
 * pass exactly the migration mistake this audit exists to report.
 */
const AIPREF_CATEGORIES: ReadonlySet<string> = new Set(["train-ai", "search"]);

/** The two values the vocabulary defines. `y` allows, `n` disallows. */
const AIPREF_VALUES: ReadonlySet<string> = new Set(["y", "n"]);

/** Content-Signal's values, which look like AIPREF values but are not. */
const LEGACY_VALUES: ReadonlySet<string> = new Set(["yes", "no"]);

/** Findings named in the report. The rest are counted. */
const REPORTED = 20;

interface Declaration {
  /** Where it was read from, named the way the finding quotes it. */
  channel: string;
  /** Path prefix the declaration attaches to. */
  scope: string;
  /** The `User-agent` group it was written in, or `*`. */
  agent: string;
  category: string;
  value: string;
  source: string;
}

/** Split attach-05's optional leading path token off a `Content-Usage` value. */
function splitScope(raw: string): { scope: string; body: string } {
  const leading = /^(\/\S*)\s+(.*)$/.exec(raw.trim());
  if (!leading) return { scope: "/", body: raw.trim() };
  return { scope: leading[1]!, body: leading[2]! };
}

export class AiprefContentUsageDeclarationValidityAudit extends Audit {
  static override meta: AuditMeta = {
    id: "access-crawl-control/aipref-content-usage-declaration-validity",
    category: "access-crawl-control",
    title: "AIPREF Content-Usage declarations are valid and can be read",
    failureTitle:
      "The AI-usage preference this site publishes cannot be read as written",
    description:
      "Parses every `Content-Usage` declaration — in robots.txt at file scope and inside each group, and in the response header — as the RFC 8941 dictionary AIPREF defines, validates its categories and values, and checks that the paths it attaches to are actually crawlable. A preference attached to a disallowed path has no effect: attach-05 gives disallowed paths no usage preferences at all.",
    scoreDisplayMode: "ternary",
    tier: "scored",
    evidenceGrade: "B",
    weight: weightForGrade("B", "scored"),
    defaultPriority: "medium",
    dossier:
      "docs/evidence/audits/access-crawl-control/aipref-content-usage-declaration-validity.md",
    // Gate exemption: being refused is what this category reports.
    requires: ["origin-reachable", "rendered-body", "sample-adequate"],
    guidance: {
      impact:
        "AIPREF is the one AI-usage vocabulary on the IETF standards track, so a declaration written in it is the one a future crawler is most likely to read. A crawler that cannot parse the line ignores it, and the site is then treated as having no preference at all — the same outcome as publishing nothing, after the work of publishing something. The costliest version is invisible: a preference attached to a path robots.txt disallows is discarded by the spec itself, so the line looks right and does nothing.",
      fix: "Write `Content-Usage: train-ai=n` — an RFC 8941 dictionary of `y`/`n` values against the `train-ai` and `search` categories. Use `yes`/`no` only in a Cloudflare `Content-Signal:` line, which is a different directive. Attach preferences to paths a crawler is allowed to fetch, and keep the robots.txt line and the response header saying the same thing for the same path.",
      effort: "moderate",
      docsUrl:
        "https://forkpoint.github.io/agent-lighthouse/audits/access-crawl-control/aipref-content-usage-declaration-validity/",
      tags: ["aipref", "robots", "headers", "licensing"],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const robots = ctx.rootFiles["/robots.txt"];
    const robotsBody = robots?.status === 200 ? robots.body : "";
    const groups = robotsBody === "" ? [] : parseRobots(robotsBody);

    const declarations: Declaration[] = [];
    const errors: string[] = [];
    const inert: string[] = [];
    const legacyOnly: string[] = [];

    const readDictionary = (
      raw: string,
      channel: string,
      agent: string,
      source: string,
    ): void => {
      const { scope, body } = splitScope(raw);
      const parsed = parseDictionary(body);
      if (!parsed.ok) {
        errors.push(`${source}: ${parsed.error}`);
        return;
      }
      if (parsed.value.size === 0) {
        errors.push(`${source}: declares no category`);
        return;
      }
      for (const [category, value] of parsed.value) {
        if (LEGACY_VALUES.has(value)) {
          errors.push(
            `${source}: "${category}=${value}" is legacy Content-Signal syntax in an AIPREF directive; AIPREF values are y and n`,
          );
          continue;
        }
        if (!AIPREF_CATEGORIES.has(category)) {
          errors.push(`${source}: "${category}" is not an AIPREF category`);
          continue;
        }
        if (!AIPREF_VALUES.has(value)) {
          errors.push(`${source}: "${category}=${value}" is not one of y or n`);
          continue;
        }
        declarations.push({ channel, scope, agent, category, value, source });
      }
    };

    if (robotsBody !== "") {
      for (const line of directiveLines(robotsBody, "content-usage")) {
        readDictionary(
          line.value,
          "robots.txt",
          line.group === "" ? "*" : line.group,
          `robots.txt line ${line.line}`,
        );
      }
      for (const line of directiveLines(robotsBody, "content-signal")) {
        legacyOnly.push(
          `robots.txt line ${line.line}: Content-Signal: ${line.value}`,
        );
      }
    }

    for (const page of ctx.pages) {
      const header = page.fetchResult.headers?.["content-usage"];
      if (!header) continue;
      readDictionary(
        header,
        "response header",
        "*",
        `Content-Usage header on ${page.url}`,
      );
    }

    // attach-05: "Disallowed paths have no associated usage preferences." A
    // declaration attached to a path the same group disallows is discarded by
    // the spec, so it is a defect however well-formed it is.
    for (const declaration of declarations) {
      if (declaration.channel !== "robots.txt" || groups.length === 0) continue;
      const token = declaration.agent === "*" ? "*" : declaration.agent;
      const probe = declaration.scope === "/" ? "/" : declaration.scope;
      if (isPathAllowed(groups, token, probe)) continue;
      const rule = decidingRule(groups, token, probe);
      inert.push(
        `${declaration.source}: ${declaration.category}=${declaration.value} attaches to ${probe}, which ${
          rule ? `"${rule.type}: ${rule.path}"` : "robots.txt"
        } disallows for ${token}`,
      );
    }

    // The same path declared in both channels must say the same thing, or a
    // crawler's answer depends on which channel it happens to read.
    const disagreements: string[] = [];
    for (const a of declarations) {
      for (const b of declarations) {
        if (a.channel === b.channel) continue;
        if (a.category !== b.category) continue;
        if (a.scope !== b.scope) continue;
        if (a.value === b.value) continue;
        const finding = `${a.category} over ${a.scope}: ${a.source} says ${a.value} while ${b.source} says ${b.value}`;
        if (!disagreements.includes(finding)) disagreements.push(finding);
      }
    }

    const inertScopes = new Set(inert.map((line) => line.split(":")[0]));
    const effective = declarations.filter((d) => !inertScopes.has(d.source));

    if (
      declarations.length === 0 &&
      errors.length === 0 &&
      legacyOnly.length === 0
    ) {
      return this.notApplicable(
        "This site publishes no AIPREF Content-Usage declaration.",
        "A Content-Usage declaration in robots.txt or a response header",
        robotsBody === ""
          ? "No robots.txt and no Content-Usage header"
          : "No Content-Usage directive",
      );
    }

    const findings = [...errors, ...inert, ...disagreements];
    const displayValue = `${effective.length} valid, ${findings.length} problem(s)`;
    const expected =
      "Every Content-Usage declaration parses as an RFC 8941 dictionary of AIPREF categories, attaches to a crawlable path, and agrees with the other channel";
    const found =
      `${declarations.length} declaration(s) parsed, ${errors.length} syntax or vocabulary error(s), ` +
      `${inert.length} attached to a disallowed path, ${disagreements.length} channel disagreement(s), ` +
      `${legacyOnly.length} legacy Content-Signal line(s).`;
    const details = {
      declarations: declarations.length,
      effectiveDeclarations: effective.length,
      syntaxErrors: errors.slice(0, REPORTED),
      inertDeclarations: inert.slice(0, REPORTED),
      channelDisagreements: disagreements.slice(0, REPORTED),
      legacyContentSignalLines: legacyOnly.slice(0, REPORTED),
    };

    if (
      errors.length > 0 ||
      disagreements.length > 0 ||
      (declarations.length > 0 && effective.length === 0)
    ) {
      return {
        ...this.fail(
          errors.length > 0
            ? `${errors.length} Content-Usage declaration(s) cannot be read as AIPREF writes them.`
            : disagreements.length > 0
              ? `robots.txt and the response header declare different preferences for the same path.`
              : "Every Content-Usage declaration attaches to a path robots.txt disallows, so none of them applies.",
          expected,
          found,
          errors.length > 0
            ? "Write the value as an RFC 8941 dictionary of y and n against train-ai and search; yes and no belong to Content-Signal."
            : "Attach the preference to a path crawlers may fetch, and say the same thing in robots.txt and in the header.",
        ),
        displayValue,
        details,
      };
    }

    if (declarations.length === 0 && legacyOnly.length > 0) {
      return {
        ...this.warn(
          "This site declares its AI-usage preference only in the legacy Content-Signal syntax.",
          expected,
          found,
          "Keep the Content-Signal line if your CDN needs it, and add the AIPREF equivalent: `Content-Usage: train-ai=n`.",
        ),
        displayValue,
        details,
      };
    }

    if (inert.length > 0) {
      return {
        ...this.warn(
          `${inert.length} Content-Usage declaration(s) attach to a path robots.txt disallows, so they have no effect.`,
          expected,
          found,
          "Move the preference onto a crawlable path, or drop the Disallow that makes it inert.",
        ),
        displayValue,
        details,
      };
    }

    return {
      ...this.pass(
        `${effective.length} valid Content-Usage declaration(s), all attached to crawlable paths and consistent across channels.`,
        expected,
        found,
      ),
      displayValue,
      details,
    };
  }
}
