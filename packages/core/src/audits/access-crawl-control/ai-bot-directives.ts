import type { AuditMeta, AuditResult } from "../../types";
import { Audit } from "../../audit";
import type { CheckContext } from "../../check-context";
import { parseRobotsFile, type RobotsGroup } from "../../gatherers/robots";
import { isAllowed } from "./_robots-txt-helpers";
import { weightForGrade } from "../../scorer";
import {
  AuditTier,
  CheckPriority,
  EvidenceGrade,
  EvidenceKey,
  FixEffort,
  ScoreDisplayMode,
} from "../../types";

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
const Stance = {
  ExplicitlyAllowed: "explicitly allowed",
  AllowedByDefault: "allowed by default",
  Blocked: "blocked",
} as const;

type Stance = (typeof Stance)[keyof typeof Stance];

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
  "No robots.txt rule that disallows / for a documented AI bot (YouBot, AI2Bot)";

/** Resolve one bot's stance against the parsed robots.txt groups. */
function stanceFor(groups: RobotsGroup[], bot: DirectiveBot): Stance {
  const { explicitly, allowed } = isAllowed(groups, bot.botName);
  if (!allowed) return Stance.Blocked;
  return explicitly ? Stance.ExplicitlyAllowed : Stance.AllowedByDefault;
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
    title: "Documented AI bots allowed by robots.txt",
    // A block is the only failing state, so the failure headline names it.
    failureTitle: "A documented AI bot is blocked in robots.txt",
    description:
      "Reports your robots.txt stance on five long-tail AI bot tokens in one place. Only the bots whose operator publishes crawler documentation — YouBot (You.com) and AI2Bot (Allen Institute) — affect the score, because only those directives have a documented reader. Bytespider, cohere-ai and Diffbot are listed for information: blocking them is a legitimate operational choice that costs no AI-answer visibility.",
    scoreDisplayMode: ScoreDisplayMode.Ternary,
    weight: weightForGrade(EvidenceGrade.B, AuditTier.Scored),
    evidenceGrade: EvidenceGrade.B,
    tier: AuditTier.Scored,
    dossier: "docs/evidence/audits/access-crawl-control/ai-bot-directives.md",
    // Gate exemption: being refused is what this category reports.
    requires: [EvidenceKey.OriginReachable, EvidenceKey.UnblockedFetches],
    defaultPriority: CheckPriority.Medium,
    guidance: {
      impact:
        "Blocking YouBot removes the site from You.com's live search index; blocking AI2Bot removes it from the Allen Institute's open training corpora while leaving closed commercial crawlers untouched. The other three tokens carry no comparable consumer, so this audit never penalises blocking them.",
      fix: "Nothing to do while YouBot and AI2Bot are allowed, whether through their own groups or through User-agent: *, which under RFC 9309 §2.2.1 grants the same access. A Disallow: / that reaches either bot is reported as a failure: a legitimate publisher decision, but one that closes a documented consumer path. If the block is unintended, remove it. A named group with Allow: / also lifts it, but a named group replaces the catch-all for that bot, so copy into it every catch-all Disallow line it should still obey. If the block is intended, enforce it at the edge too, since robots.txt alone is not a reliable block. Bytespider, cohere-ai and Diffbot never affect the score, whatever you do with them.",
      code: "User-agent: YouBot\nAllow: /\n\nUser-agent: AI2Bot\nAllow: /",
      effort: FixEffort.Trivial,
      tags: ["robots-txt", "crawler-permissions", "ai-bots"],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const robotsFile = ctx.rootFiles["/robots.txt"];

    // Absent artifact, absent verdict. With no robots.txt every bot may fetch
    // everything (RFC 9309 §2.3.1.3), the same access an open catch-all
    // grants, so there is no rule to grade and no cost to report.
    if (!robotsFile || robotsFile.status !== 200 || !robotsFile.body) {
      return this.notApplicable(
        "No robots.txt to read, so there are no directives to evaluate for YouBot or AI2Bot.",
        EXPECTED,
        "No robots.txt found",
      );
    }

    // Parsed once for all five bots; the v1 audits re-parsed per bot.
    const { groups, sitemaps } = parseRobotsFile(robotsFile.body);

    // A 200 that carries no groups, no sitemaps and no directives is a soft 404
    // — an HTML error page served at /robots.txt — not a permissive rules file.
    if (groups.length === 0 && sitemaps.length === 0) {
      return this.notApplicable(
        "The response at /robots.txt carries no crawl rules, so there is nothing to evaluate for YouBot or AI2Bot.",
        EXPECTED,
        "robots.txt contains no user-agent groups and no directives",
      );
    }

    const rows = DIRECTIVE_BOTS.map((bot) => ({
      bot,
      stance: stanceFor(groups, bot),
    }));
    const table = renderTable(rows);

    const scoredRows = rows.filter((r) => r.bot.documentedActive);
    const blocked = scoredRows.filter((r) => r.stance === Stance.Blocked);

    if (blocked.length > 0) {
      const names = blocked.map((r) => r.bot.displayName).join(", ");
      return this.fail(
        `${names} ${blocked.length === 1 ? "is" : "are"} blocked by robots.txt — the documented consumer path is closed.`,
        EXPECTED,
        table,
        { priority: CheckPriority.Medium },
      );
    }

    const allNames = SCORED_BOTS.map((b) => b.displayName).join(" and ");
    const inherited = scoredRows.filter(
      (r) => r.stance === Stance.AllowedByDefault,
    );
    if (inherited.length === 0) {
      return this.pass(
        `${allNames} are allowed by their own robots.txt groups.`,
        EXPECTED,
        table,
      );
    }

    // Under RFC 9309 §2.2.1 a bot with no group of its own obeys the
    // catch-all, so inherited access is the same access a named group grants.
    // The message still says which rule applied, and does not claim a
    // catch-all where the file has none.
    const names = inherited.map((r) => r.bot.displayName).join(", ");
    const verb = inherited.length === 1 ? "is" : "are";
    const hasCatchAll = groups.some((g) => g.userAgent.trim() === "*");
    return this.pass(
      hasCatchAll
        ? `${allNames} are allowed. ${names} ${verb} named by no group, so under RFC 9309 §2.2.1 the catch-all group applies, and it permits /.`
        : `${allNames} are allowed. ${names} ${verb} named by no group and robots.txt has no catch-all group, so nothing restricts ${inherited.length === 1 ? "it" : "them"}.`,
      EXPECTED,
      table,
    );
  }
}
