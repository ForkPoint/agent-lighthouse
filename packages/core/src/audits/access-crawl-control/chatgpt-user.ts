import type { AuditMeta, AuditResult } from "#core/types";
import { Audit } from "#core/audit";
import type { CheckContext } from "#core/check-context";
import { parseRobotsFile, hasNamedGroup } from "#core/gatherers/robots";
import { weightForGrade } from "#core/scorer";
import {
  AuditTier,
  CheckPriority,
  EvidenceGrade,
  EvidenceKey,
  FixEffort,
  NoticeKind,
  ScoreDisplayMode,
} from "#core/types";

const SOURCE_URL = "https://developers.openai.com/api/docs/bots";
const TOKEN = "ChatGPT-User";

export class ChatgptUserAudit extends Audit {
  static override meta: AuditMeta = {
    id: "access-crawl-control/chatgpt-user",
    category: "access-crawl-control",
    // The audit speaks only when the owner wrote the group, so both titles
    // describe the group.
    title: "ChatGPT-User robots.txt group (may not apply)",
    failureTitle:
      "A ChatGPT-User robots.txt group that OpenAI says may not apply",
    description:
      "Reports a `User-agent: ChatGPT-User` group in robots.txt. OpenAI documents that ChatGPT-User fetches pages on a user's request, that robots.txt rules may not apply to those fetches, and that OAI-SearchBot is the token for managing search opt-outs.",
    scoreDisplayMode: ScoreDisplayMode.Informative,
    weight: weightForGrade(EvidenceGrade.C, AuditTier.Informative),
    evidenceGrade: EvidenceGrade.C,
    // Informative, not obsolete: OpenAI says the rules "may not apply", a
    // hedge rather than a documented refusal, so the group is reported with
    // that qualifier and never costs anything.
    tier: AuditTier.Informative,
    deprecated: {
      kind: NoticeKind.Unconsumed,
      notice:
        "No vendor documents obeying a ChatGPT-User group: OpenAI says robots.txt rules may not apply to ChatGPT-User, because a user initiates its fetches. OAI-SearchBot is the token OpenAI documents for search opt-outs.",
      link: SOURCE_URL,
      replacement:
        "Use a User-agent: OAI-SearchBot group to manage ChatGPT search, and control user-initiated fetches at the server or CDN if needed.",
    },
    dossier: "docs/evidence/audits/access-crawl-control/chatgpt-user.md",
    // Gate exemption: being refused is what this category reports.
    requires: [EvidenceKey.OriginReachable, EvidenceKey.UnblockedFetches],
    defaultPriority: CheckPriority.Low,
    guidance: {
      impact:
        "The group may have no effect. OpenAI documents that robots.txt rules may not apply to user-initiated ChatGPT-User fetches, so it is not a reliable control.",
      fix: "Nothing is required; the group can stay. To manage ChatGPT search, write a User-agent: OAI-SearchBot group. To limit user-initiated fetches, act at the server or CDN.",
      effort: FixEffort.Trivial,
      docsUrl: SOURCE_URL,
      tags: ["robots-txt", "openai", "unconsumed"],
    },
  };

  audit(ctx: CheckContext): AuditResult {
    const robotsFile = ctx.rootFiles["/robots.txt"];
    const expected = `A User-agent: ${TOKEN} group is optional: OpenAI says robots.txt rules may not apply to it`;

    // Absent artifact, absent verdict: no robots.txt, a soft 404 or a file
    // with no group for this token is not a group the owner relies on.
    // Access through the catch-all is the business of the other per-bot
    // audits, not of this one.
    const groups =
      robotsFile && robotsFile.status === 200 && robotsFile.body
        ? parseRobotsFile(robotsFile.body).groups
        : [];
    if (!hasNamedGroup(groups, TOKEN)) {
      return this.notApplicable(
        `robots.txt has no User-agent: ${TOKEN} group.`,
        expected,
        robotsFile && robotsFile.status === 200
          ? `No User-agent: ${TOKEN} group`
          : "No robots.txt found",
      );
    }

    return this.pass(
      `robots.txt has a User-agent: ${TOKEN} group. OpenAI says that because ChatGPT-User fetches are "initiated by a user, robots.txt rules may not apply", and asks sites to "use OAI-SearchBot in robots.txt for managing Search opt outs". This group may not be honoured.`,
      expected,
      `User-agent: ${TOKEN} group present`,
    );
  }
}
