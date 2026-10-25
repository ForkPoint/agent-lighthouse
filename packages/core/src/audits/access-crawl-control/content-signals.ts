import { Audit } from "#core/audit";
import type { CheckContext } from "#core/check-context";
import {
  CONTENT_SIGNAL_NAMES,
  ContentSignalValue,
  parseContentSignals,
} from "#core/gatherers/content-signals";
import { isHtmlDocument, rootArtifactMiss } from "#core/gatherers/root-files";
import { isPathAllowed, parseRobots } from "#core/gatherers/robots";
import { weightForGrade } from "#core/scorer";
import {
  AuditTier,
  CheckPriority,
  EvidenceGrade,
  EvidenceKey,
  FixEffort,
  ScoreDisplayMode,
  type AuditMeta,
  type AuditResult,
} from "#core/types";

const EXAMPLES =
  "Optional examples, not defaults: to permit search and AI answers but decline training, use Content-Signal: search=yes, ai-input=yes, ai-train=no. To permit search only, use Content-Signal: search=yes, ai-input=no, ai-train=no. Choose each purpose independently; yes and no are both valid. Keep the intended bot group and path. Preserve all access rules.";
const CONFIRM =
  "Publish the change in the system that serves robots.txt, reload the public robots.txt, and rescan. A scan checks served syntax, bot/path scope and observed conflicts. It cannot prove external bots obeyed the policy or that a firewall enforces it. Compliance is voluntary.";
const MEANINGS: Record<string, string> = {
  search:
    "indexing, links and short excerpts; excludes AI-generated search summaries",
  "ai-input": "model input for answers, including retrieval and grounding",
  "ai-train":
    "training or fine-tuning; declining this does not decline search or AI input",
};

const MAX_EVIDENCE_ITEM = 1000;
const MAX_EVIDENCE_TOTAL = 20000;
const SHORTENED = " [Evidence shortened; not a complete source line.]";

/** Bound every emitted evidence string and their combined size. */
function boundedEvidence() {
  let remaining = MAX_EVIDENCE_TOTAL;
  return (items: string[], exact = false): string[] => {
    const result: string[] = [];
    for (const item of items) {
      const limit = Math.min(MAX_EVIDENCE_ITEM, remaining);
      if (limit < 100) break;
      const value =
        item.length <= limit
          ? item
          : exact
            ? "Exact edit omitted because its complete text exceeds the report limit. Review the full source line before editing."
            : item.slice(0, limit - SHORTENED.length) + SHORTENED;
      if (value.length > remaining) break;
      result.push(value);
      remaining -= value.length;
    }
    return result;
  };
}

export class ContentSignalsAudit extends Audit {
  static override meta: AuditMeta = {
    id: "access-crawl-control/content-signals",
    category: "access-crawl-control",
    title: "Content Signals choices and optional setup",
    failureTitle: "Content Signals declarations need review",
    description:
      "Explains declared search, AI-input and AI-training preferences by bot and path, with syntax findings and optional client choices.",
    tier: AuditTier.Informative,
    evidenceGrade: EvidenceGrade.C,
    weight: weightForGrade(EvidenceGrade.C, AuditTier.Informative),
    scoreDisplayMode: ScoreDisplayMode.Informative,
    defaultPriority: CheckPriority.Low,
    dossier: "docs/evidence/audits/access-crawl-control/content-signals.md",
    requires: [EvidenceKey.OriginReachable, EvidenceKey.UnblockedFetches],
    guidance: {
      impact:
        "Content Signals state use preferences, not crawl access. Omission means not declared, not no. No universal vendor consumption or ranking gain is established.",
      fix: `${EXAMPLES} ${CONFIRM}`,
      effort: FixEffort.Trivial,
      docsUrl: "https://contentsignals.org/",
      tags: ["robots", "content-signals", "licensing"],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const robots = ctx.rootFiles["/robots.txt"];
    const missing = robots?.status === 404 || robots?.status === 410;
    const readable =
      robots?.status === 200 && !robots.error && !isHtmlDocument(robots.body);
    const expected =
      "Optional use preferences with valid syntax and explicit bot/path scope";
    if (!missing && !readable) {
      return this.notApplicable(
        "Could not check Content Signals declarations.",
        expected,
        rootArtifactMiss(robots),
      );
    }
    const body = readable ? robots.body : "";
    const parsed = parseContentSignals(body);
    if (!parsed.complete) {
      return {
        ...this.warn(
          "Content Signals analysis is incomplete (unscored).",
          expected,
          parsed.limitation ?? "Analysis limit reached.",
          "Review the full robots.txt manually. No absence, effective policy, or exact edit can be inferred from this incomplete analysis.",
        ),
        details: {
          optionalGuidance: true,
          analysisComplete: false,
          decisionNotes: [parsed.limitation ?? "Analysis limit reached."],
          verification: [
            "This scan did not check every declaration. Review the full file before choosing or changing a policy.",
          ],
        },
      };
    }
    const source =
      robots?.url ||
      new URL("/robots.txt", ctx.targetUrl ?? "https://unknown.invalid/").href;
    if (parsed.declarations.length === 0) {
      return {
        ...this.notApplicable(
          "No Content Signals preferences declared. Setup is optional.",
          expected,
          missing
            ? "robots.txt is confirmed missing."
            : "Readable robots.txt contains no Content-Signal directive.",
        ),
        remediation: `${EXAMPLES} ${CONFIRM}`,
        details: {
          optionalGuidance: true,
          declarations: CONTENT_SIGNAL_NAMES.map(
            (name) => `${name}: Not declared — ${MEANINGS[name]}`,
          ),
          source,
          decisionNotes: [
            "Policy comments alone are not declarations. There is no score penalty for omission.",
            parsed.managed
              ? "Explicit Cloudflare managed-block markers are present. Review Bot Preference Sync settings: https://developers.cloudflare.com/bots/additional-configurations/managed-robots-txt/"
              : "Edit the system that serves robots.txt; this scan cannot identify its CMS or owner.",
          ],
          verification: [CONFIRM],
        },
      };
    }
    const facts: string[] = [];
    const notes: string[] = [];
    const edits: string[] = [];
    const groups = parseRobots(body);
    const rawLines = body
      .replace(/^\uFEFF/, "")
      .replace(/\r\n?/g, "\n")
      .split("\n");
    const scopeValues = new Map<string, Set<string>>();
    for (const declaration of parsed.declarations) {
      for (const entry of declaration.entries) {
        if (!entry.valid || !entry.known) continue;
        const key = JSON.stringify([
          declaration.agent.toLowerCase(),
          declaration.path,
          entry.name,
        ]);
        const values = scopeValues.get(key) ?? new Set<string>();
        values.add(entry.value);
        scopeValues.set(key, values);
      }
    }
    // Bound the report work as well as its output on attacker-controlled files.
    const reported = parsed.declarations.slice(0, 20);
    if (reported.length < parsed.declarations.length)
      notes.push(
        `Showing the first ${reported.length} of ${parsed.declarations.length} declarations; syntax diagnostics cover the parsed file.`,
      );
    for (let i = 0; i < reported.length; i += 1) {
      const a = reported[i]!;
      for (const b of reported.slice(i + 1)) {
        const sameAgent = a.agent.toLowerCase() === b.agent.toLowerCase();
        if (
          (!sameAgent && a.agent !== "*" && b.agent !== "*") ||
          (!a.path.startsWith(b.path) && !b.path.startsWith(a.path)) ||
          (sameAgent && a.path === b.path)
        )
          continue;
        if (
          a.entries.some(
            (entry) =>
              entry.known &&
              entry.valid &&
              b.entries.some(
                (other) =>
                  other.valid &&
                  other.name === entry.name &&
                  other.value !== entry.value,
              ),
          )
        )
          notes.push(
            `Overlapping declarations for review: bot ${a.agent}, path ${a.path}, line ${a.line}; bot ${b.agent}, path ${b.path}, line ${b.line}. No effective precedence inferred.`,
          );
        if (notes.length >= 20) break;
      }
      if (notes.length >= 20) break;
    }
    for (const declaration of reported) {
      const { agent, path, line, entries } = declaration;
      const scope = `bot ${agent}, path ${path}, ${source}, line ${line}`;
      for (const name of CONTENT_SIGNAL_NAMES) {
        const values = [
          ...(scopeValues.get(
            JSON.stringify([agent.toLowerCase(), path, name]),
          ) ?? []),
        ];
        const state =
          values.length > 1
            ? "Conflicting"
            : values[0] === ContentSignalValue.Yes
              ? "Allowed (yes)"
              : values[0] === ContentSignalValue.No
                ? "Declined (no)"
                : entries.some((entry) => entry.name === name && !entry.valid)
                  ? "Could not check (invalid declaration)"
                  : "Not declared";
        facts.push(
          `${name}: ${state} — ${MEANINGS[name]}; ${scope}. Declared line: Content-Signal: ${declaration.raw}`,
        );
        if (
          !entries.some((entry) => entry.name === name) &&
          !values.length &&
          !parsed.diagnostics.some((fault) => fault.startsWith(`Line ${line},`))
        ) {
          const original =
            rawLines[line - 1] ?? `Content-Signal: ${declaration.raw}`;
          const hash = original.indexOf("#");
          const content = hash === -1 ? original : original.slice(0, hash);
          const comment = hash === -1 ? "" : original.slice(hash);
          const replacement = `${content.trimEnd()}, ${name}=yes${comment ? ` ${comment}` : ""}`;
          edits.push(
            `If you want to permit ${name === "ai-input" ? "use in AI answers" : name}, add ${name}=yes to this group (${scope}). Existing: ${original} Replacement: ${replacement}. To decline that use instead, choose ${name}=no.`,
          );
        }
      }
      for (const entry of entries.filter((item) => item.valid && !item.known)) {
        notes.push(
          entry.name === "use"
            ? `${scope}: use=${entry.value} is Cloudflare's optional test extension (immediate: no storage/reuse; reference: index, excerpt and link; full: summarize and reproduce). It does not replace ai-input or ai-train.`
            : `${scope}: ${entry.name}=${entry.value} is an unrecognized extension; preserved without a syntax error.`,
        );
      }
      if (
        entries.some(
          (entry) =>
            entry.known &&
            entry.valid &&
            entry.value === ContentSignalValue.Yes,
        ) &&
        !isPathAllowed(groups, agent, path)
      )
        notes.push(
          `${scope}: use is permitted, but an access rule blocks this path for this bot. Access and use are separate choices; review the access obstacle only if you intend to enable crawling.`,
        );
    }
    notes.push(
      "Declared values are shown separately; no effective precedence is inferred. Both yes and no are valid choices. There is no completeness target.",
    );
    notes.push(
      parsed.managed
        ? "Explicit Cloudflare managed-block markers are present. This block may come from Bot Preference Sync. Review the managed settings, not only the origin file: https://developers.cloudflare.com/bots/additional-configurations/managed-robots-txt/"
        : "Edit the system that serves robots.txt; this scan cannot identify its CMS or owner from line order or headers.",
    );
    const scopes = new Set(
      parsed.declarations.map((declaration) =>
        JSON.stringify([declaration.agent.toLowerCase(), declaration.path]),
      ),
    );
    const found = `${parsed.declarations.length} declaration(s). ${scopes.size > 1 ? "Rules differ by bot or path." : "One bot/path scope."}`;
    const attention = [...parsed.diagnostics, ...parsed.repeats];
    const bound = boundedEvidence();
    const verification = bound([CONFIRM]);
    const reportLimits = bound([
      "Evidence text is limited to 1000 characters per item and 20000 characters in total. Shortened excerpts carry a label. Further items or complete edits may be omitted; inspect the full robots.txt before editing.",
    ]);
    return {
      ...(attention.length
        ? this.warn(
            "Content Signals declarations need review (unscored).",
            expected,
            found,
            "Correct the named syntax faults. Review repeated declarations; do not infer precedence or change a valid no without choosing that policy.",
          )
        : this.pass(
            "Content Signals choices are readable (unscored).",
            expected,
            found,
          )),
      details: {
        optionalGuidance: true,
        reportLimits,
        declarations: bound(facts.slice(0, 60)),
        syntaxErrors: bound(parsed.diagnostics.slice(0, 30)),
        repeatedDeclarations: bound(parsed.repeats.slice(0, 30)),
        decisionNotes: bound([
          ...notes.slice(-2),
          ...notes.slice(0, -2).slice(0, 28),
        ]),
        conditionalEdits: bound(edits.slice(0, 30), true),
        verification,
      },
    };
  }
}
