import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import type { CheckContext } from "../../check-context";
import { parseRobotsTxt, isAllowed } from "./_robots-txt-helpers";
import { weightForGrade } from "../../scorer";

/**
 * One robots.txt read, five AI bot tokens, one score.
 *
 * Consolidates the five per-bot audits v1 shipped as separate checks
 * (Bytespider 2.9, cohere-ai 2.10, YouBot 2.11, Diffbot 2.12, AI2Bot 2.13).
 * Each of them weighted a single low-signal user-agent token as heavily as
 * GPTBot, which inflated the category with checks whose pass state confers no
 * measurable benefit.
 *
 * The consolidation follows the evidence: only the bots whose operator
 * publishes crawler documentation — a *documented-active* consumer path —
 * move the score. The rest are reported in an informational table so the user
 * still sees their robots.txt stance, without a blocked long-tail scraper
 * costing them points. See
 * `docs/evidence/audits/access-crawl-control/ai-bot-directives.md`.
 */

/** A bot's robots.txt stance for the site root. */
type Stance = "explicitly allowed" | "allowed by default" | "blocked";

interface DirectiveBot {
  /** The robots.txt product token, matched per RFC 9309. */
  botName: string;
  /** Label used in the report table. */
  displayName: string;
  /**
   * True when the operator publishes crawler documentation naming this token,
   * i.e. the directive has a documented consumer. Only these bots score.
   */
  documentedActive: boolean;
  /** One-line justification carried into the per-bot table. */
  note: string;
}

/**
 * The five tokens this audit reports on, strongest evidence first.
 *
 * `documentedActive` is a claim about the *evidence*, not about crawl volume:
 * You.com and the Allen Institute both publish a crawler page naming their
 * token, so a directive aimed at them has a documented reader. ByteDance,
 * Cohere and Diffbot publish none, and Bytespider is additionally measured
 * fetching disallowed URLs — so their rows are reported, never scored.
 */
const DIRECTIVE_BOTS: DirectiveBot[] = [
  {
    botName: "YouBot",
    displayName: "YouBot",
    documentedActive: true,
    note: "scored — You.com publishes a crawler page and a robots.txt compliance claim (field measurement disputes it; see dossier)",
  },
  {
    botName: "AI2Bot",
    displayName: "AI2Bot",
    documentedActive: true,
    note: "scored — the Allen Institute publishes the user-agent so operators can filter it; feeds the open Dolma corpora",
  },
  {
    botName: "Bytespider",
    displayName: "Bytespider",
    documentedActive: false,
    note: "informational — no English vendor documentation, and measured fetching disallowed URLs; enforce at the edge, not in robots.txt",
  },
  {
    botName: "cohere-ai",
    displayName: "cohere-ai",
    documentedActive: false,
    note: "informational — undocumented legacy token with no verified consumer (Cohere's observed crawler is cohere-training-data-crawler)",
  },
  {
    botName: "Diffbot",
    displayName: "Diffbot",
    documentedActive: false,
    note: "informational — commercial extraction vendor with no published compliance statement; blocking it costs no AI-answer visibility",
  },
];

const SCORED_BOTS = DIRECTIVE_BOTS.filter((b) => b.documentedActive);

const EXPECTED =
  "An explicit User-agent group for each documented AI bot (YouBot, AI2Bot) stating the access policy you intend";

/** Resolve one bot's stance against the parsed robots.txt groups. */
function stanceFor(
  groups: ReturnType<typeof parseRobotsTxt>,
  bot: DirectiveBot,
): Stance {
  const { explicitly, allowed } = isAllowed(groups, bot.botName);
  if (!allowed) return "blocked";
  return explicitly ? "explicitly allowed" : "allowed by default";
}

/** Render the informational per-bot table shown in the report. */
function renderTable(rows: { bot: DirectiveBot; stance: Stance }[]): string {
  return rows
    .map(({ bot, stance }) => `${bot.displayName}: ${stance} (${bot.note})`)
    .join("\n");
}

export class AiBotDirectivesAudit extends Audit {
  static override meta: AuditMeta = {
    id: "access-crawl-control/ai-bot-directives",
    category: "access-crawl-control",
    title: "AI bot directives are explicit",
    // Both non-pass paths render under this headline, and one of them is a warn
    // about an unstated policy, not a block. It has to be true of both.
    failureTitle: "AI bot directives need attention",
    description:
      "Reports your robots.txt stance on five long-tail AI bot tokens in one place. Only the bots whose operator publishes crawler documentation — YouBot (You.com) and AI2Bot (Allen Institute) — affect the score, because only those directives have a documented reader. Bytespider, cohere-ai and Diffbot are listed for information: blocking them is a legitimate operational choice that costs no AI-answer visibility.",
    scoreDisplayMode: "ternary",
    weight: weightForGrade("B", "scored"),
    evidenceGrade: "B",
    tier: "scored",
    dossier: "docs/evidence/audits/access-crawl-control/ai-bot-directives.md",
    // Gate exemption: being refused is what this category reports.
    requires: ["origin-reachable"],
    defaultPriority: "medium",
    guidance: {
      impact:
        "Blocking YouBot removes the site from You.com's live search index; blocking AI2Bot removes it from the Allen Institute's open training corpora while leaving closed commercial crawlers untouched. Leaving either to the wildcard rule means the policy silently flips the day a blanket block is added. The other three tokens carry no comparable consumer, so this audit never penalises blocking them.",
      fix: "Give YouBot and AI2Bot their own User-agent groups with Allow: / — that is the state this audit passes, because it keeps the documented consumer path open and pins it against a later blanket block. Leaving them to User-agent: * is a warning: the policy is unstated and flips the day a blanket block is added. An explicit Disallow: / for either bot is reported as a failure — it is a legitimate publisher decision, but it does close a documented consumer path, and this audit records that cost rather than hiding it; if that is what you intend, enforce it at the edge too, since robots.txt alone is not a reliable block. Bytespider, cohere-ai and Diffbot never affect the score, whatever you do with them.",
      code: "User-agent: YouBot\nAllow: /\n\nUser-agent: AI2Bot\nAllow: /",
      effort: "trivial",
      tags: ["robots-txt", "crawler-permissions", "ai-bots"],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const robotsFile = ctx.rootFiles["/robots.txt"];

    // No robots.txt at all: every bot is allowed by default, so nothing is
    // blocked — but no directive is explicit either, which is exactly the
    // "one blanket block away from silently flipping" state.
    if (!robotsFile || robotsFile.status !== 200 || !robotsFile.body) {
      return this.warn(
        "No robots.txt found — the documented AI bots are allowed by default, but no directive names them.",
        EXPECTED,
        "No robots.txt found",
        { priority: "medium" },
      );
    }

    // Parsed once for all five bots; the v1 audits re-parsed per bot.
    const groups = parseRobotsTxt(robotsFile.body);
    const rows = DIRECTIVE_BOTS.map((bot) => ({
      bot,
      stance: stanceFor(groups, bot),
    }));
    const table = renderTable(rows);

    const scoredRows = rows.filter((r) => r.bot.documentedActive);
    const blocked = scoredRows.filter((r) => r.stance === "blocked");
    const implicit = scoredRows.filter(
      (r) => r.stance === "allowed by default",
    );

    if (blocked.length > 0) {
      const names = blocked.map((r) => r.bot.displayName).join(", ");
      return this.fail(
        `${names} ${blocked.length === 1 ? "is" : "are"} blocked by robots.txt — the documented consumer path is closed.`,
        EXPECTED,
        table,
        { priority: "medium" },
      );
    }

    if (implicit.length > 0) {
      const names = implicit.map((r) => r.bot.displayName).join(", ");
      const verb = implicit.length === 1 ? "is" : "are";
      // "Allowed only through the wildcard rule" is false when there is no
      // wildcard group: those bots are allowed because nothing in robots.txt
      // mentions them at all. Both states warn, for the same reason — the
      // policy is unstated — but they are not the same state.
      const hasWildcard = groups.some((g) => g.userAgent === "*");
      return this.warn(
        hasWildcard
          ? `${names} ${verb} allowed only through the wildcard rule — no explicit directive.`
          : `${names} ${verb} allowed by default: robots.txt has no directive for them and no wildcard rule either.`,
        EXPECTED,
        table,
        { priority: "medium" },
      );
    }

    return this.pass(
      `${SCORED_BOTS.map((b) => b.displayName).join(" and ")} are explicitly allowed in robots.txt.`,
      EXPECTED,
      table,
    );
  }
}
